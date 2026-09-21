import json
import tempfile
from io import StringIO
from pathlib import Path
from unittest.mock import patch
from django.conf import settings
from django.test import SimpleTestCase, override_settings
from django.core.management import call_command, CommandError
from .alerts import pending_alerts
from .errors import InventoryError
from .normalization import normalize_snapshot
from .repository import SupabaseRepository, load_sources
from .validation import validate_command

class ApiTests(SimpleTestCase):
    def test_no_database_and_empty_unconfigured_sources(self):
        self.assertEqual(settings.DATABASES['default']['ENGINE'], 'django.db.backends.dummy')
        with tempfile.TemporaryDirectory() as directory, override_settings(DATA_SOURCES_FILE=Path(directory)/'missing.json'):
            response = self.client.get('/api/sources/')
            self.assertEqual(response.json(), {'sources': []})
        self.assertEqual(self.client.get('/api/status/').json()['database_created'], False)

    def test_frontend_and_modules_have_correct_types(self):
        response = self.client.get('/')
        self.assertEqual(response.status_code, 200)
        response.close()
        response = self.client.get('/js/app.js')
        self.assertIn('text/javascript', response['Content-Type'])
        response.close()
        self.assertEqual(self.client.get('/assets/../../backend/manage.py').status_code, 404)

    def test_no_key_or_table_configuration_is_exposed(self):
        with patch('inventory.views.load_sources', return_value=[{'id':'warehouse','label':'Warehouse','command_rpc':'secret_rpc','key_env':'PRIVATE_ENV','entities':{'private':{}}}]):
            response = self.client.get('/api/sources/')
        self.assertEqual(response.json(), {'sources':[{'id':'warehouse','label':'Warehouse','writable':True}]})
        self.assertEqual(response['Cache-Control'], 'no-store')

    def test_invalid_requests_and_cross_origin_are_rejected(self):
        self.assertEqual(self.client.get('/api/command/').status_code, 405)
        self.assertEqual(self.client.post('/api/command/', '{}', content_type='text/plain').status_code, 415)
        self.assertEqual(self.client.post('/api/command/', '{bad', content_type='application/json').status_code, 400)
        self.assertEqual(self.client.post('/api/command/', '{}', content_type='application/json', HTTP_ORIGIN='https://other.example').status_code, 403)

    def test_no_token_does_not_return_fake_empty_inventory(self):
        source={'id':'warehouse','url_env':'QA_URL','key_env':'QA_KEY'}
        with patch('inventory.views.get_source',return_value=source), patch.dict('os.environ',{'QA_URL':'https://project.supabase.co','QA_KEY':'sb_publishable_test'}):
            response=self.client.get('/api/snapshot/?source=warehouse')
        self.assertEqual(response.status_code,401)

    def test_command_only_forwards_allowlisted_values(self):
        payload={'product_id':'abc','type':'sale','quantity':2,'note':'','reference':'','admin':True}
        with patch('inventory.views.repo') as factory:
            factory.return_value.command.return_value={'id':'movement'}
            response=self.client.post('/api/command/?source=warehouse',json.dumps({'action':'book_movement','payload':payload}),content_type='application/json')
        self.assertEqual(response.status_code,200)
        self.assertNotIn('admin',factory.return_value.command.call_args.args[1])

    def test_login_preserves_password_whitespace(self):
        with patch('inventory.views.repo') as factory:
            factory.return_value.login.return_value={'access_token':'test'}
            self.client.post('/api/login/?source=warehouse',json.dumps({'email':' user@example.com ','password':' spaces '}),content_type='application/json')
        factory.return_value.login.assert_called_once_with('user@example.com',' spaces ')

class ContractTests(SimpleTestCase):
    def test_invalid_quantities_and_missing_correction_reason(self):
        for quantity in (-1, 0, 1.5, True, 'NaN', 'Infinity'):
            with self.assertRaises(InventoryError):
                validate_command('book_movement',{'product_id':'abc','type':'sale','quantity':quantity})
        with self.assertRaises(InventoryError):
            validate_command('book_movement',{'product_id':'abc','type':'correction','quantity':0})

    def test_metadata_update_cannot_write_quantity_or_location(self):
        values={'id':'abc','sku':'X','name':'X','size':'M','material':'Cotton','gender':'Unisex','manufacturer':'X','min_stock':0,'quantity':100,'location_id':'elsewhere'}
        result=validate_command('update_product',values)
        self.assertNotIn('quantity',result)
        self.assertNotIn('location_id',result)

    def test_pagination_follows_total_even_when_upstream_caps_page_size(self):
        source={'url_env':'QA_URL','key_env':'QA_KEY','entities':{'locations':{'table':'rooms','fields':{'id':'room_id','name':'label'}}}}
        with patch.dict('os.environ',{'QA_URL':'https://project.supabase.co','QA_KEY':'sb_publishable_test'}):
            repo=SupabaseRepository(source,'jwt')
        with patch.object(repo,'request',side_effect=[([{'id':1}],{'Content-Range':'0-0/2'}),([{'id':2}],{'Content-Range':'1-1/2'})]) as request:
            self.assertEqual(len(repo.rows('locations')),2)
            self.assertIn('offset=1',request.call_args.args[0])

    def test_missing_count_is_not_silently_accepted(self):
        source={'url_env':'QA_URL','key_env':'QA_KEY','entities':{'locations':{'table':'rooms','fields':{'id':'id'}}}}
        with patch.dict('os.environ',{'QA_URL':'https://project.supabase.co','QA_KEY':'sb_publishable_test'}):
            repo=SupabaseRepository(source,'jwt')
        with patch.object(repo,'request',return_value=([],{})),self.assertRaises(InventoryError):
            repo.rows('locations')

    def test_read_only_source_has_no_unsafe_write_fallback(self):
        with patch.dict('os.environ',{'QA_URL':'https://project.supabase.co','QA_KEY':'sb_publishable_test'}):
            repo=SupabaseRepository({'url_env':'QA_URL','key_env':'QA_KEY'},'jwt')
        with self.assertRaises(InventoryError):
            repo.command('create_product',{})

    def test_alerts_only_report_new_low_stock_and_rearm_after_recovery(self):
        products=[{'id':'a','quantity':2,'min_stock':5,'archived':False},{'id':'b','quantity':10,'min_stock':3,'archived':False}]
        pending,ids=pending_alerts(products,{'b'})
        self.assertEqual([p['id'] for p in pending],['a'])
        self.assertEqual(ids,{'a'})
        self.assertEqual(pending_alerts(products,ids)[0],[])

    def test_normalization_converts_numeric_ids_without_fabricating_products(self):
        result=normalize_snapshot({'locations':[{'id':7,'name':'A','shelf':'A'}]})
        self.assertEqual(result['locations'][0]['id'],'7')
        self.assertEqual(result['products'],[])

class AlertCommandTests(SimpleTestCase):
    @override_settings(EMAIL_HOST='smtp.invalid', DEFAULT_FROM_EMAIL='warehouse@example.com', INVENTORY_ALERT_RECIPIENTS=['team@example.com'])
    def test_mail_command_dry_run_then_deduplicates_successful_delivery(self):
        data = {'products':[{'id':'a','sku':'QA','name':'QA','size':'M','quantity':2,'min_stock':5,'archived':False}]}
        with tempfile.TemporaryDirectory() as directory, patch('inventory.management.commands.check_stock_alerts.get_source', return_value={}), patch('inventory.management.commands.check_stock_alerts.SupabaseRepository') as factory, patch('inventory.management.commands.check_stock_alerts.send_mail', return_value=1) as mail, patch.dict('os.environ', {'INVENTORY_ALERT_TOKEN':'qa-token'}):
            factory.return_value.snapshot.return_value = data
            state = str(Path(directory)/'alerts.json')
            call_command('check_stock_alerts', source='warehouse', state=state, stdout=StringIO())
            self.assertFalse(Path(state).exists())
            mail.assert_not_called()
            call_command('check_stock_alerts', source='warehouse', state=state, send=True, stdout=StringIO())
            self.assertEqual(json.loads(Path(state).read_text())['notified'], ['a'])
            call_command('check_stock_alerts', source='warehouse', state=state, send=True, stdout=StringIO())
            self.assertEqual(mail.call_count, 1)

    @override_settings(EMAIL_HOST='smtp.invalid', DEFAULT_FROM_EMAIL='warehouse@example.com', INVENTORY_ALERT_RECIPIENTS=['team@example.com'])
    def test_mail_failure_never_marks_an_article_as_notified(self):
        data = {'products':[{'id':'a','sku':'QA','name':'QA','size':'M','quantity':0,'min_stock':1,'archived':False}]}
        with tempfile.TemporaryDirectory() as directory, patch('inventory.management.commands.check_stock_alerts.get_source', return_value={}), patch('inventory.management.commands.check_stock_alerts.SupabaseRepository') as factory, patch('inventory.management.commands.check_stock_alerts.send_mail', return_value=0), patch.dict('os.environ', {'INVENTORY_ALERT_TOKEN':'qa-token'}):
            factory.return_value.snapshot.return_value = data
            state = Path(directory)/'alerts.json'
            with self.assertRaises(CommandError):
                call_command('check_stock_alerts', source='warehouse', state=str(state), send=True, stdout=StringIO())
            self.assertFalse(state.exists())
            self.assertFalse(state.with_suffix('.json.lock').exists())
