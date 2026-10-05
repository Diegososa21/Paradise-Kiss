# ParadiseKiss

Schulprojekt desarrollado con Angular.

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 22.1.8.

## Arquitectura

- `src/`: frontend Angular.
- `backend/`: API Django REST.
- Supabase: base de datos PostgreSQL usada por Django.
- `/api/tables/resources/`: listado y creación de prendas con nombre, descripción,
  talla, categoría, fabricante, material, género, lugar de almacén, fecha de compra
  y umbral de reposición.
- `/api/tables/resources/<id>/sell/`: registra una venta y descuenta el stock de
  forma atómica.
- `/api/tables/resources/<id>/restock/`: registra una reposición, actualiza el
  stock y conserva el movimiento en el historial.
- `/api/tables/resources/<id>/inventory-settings/`: modifica el estante, el
  compartimento y el stock mínimo sin alterar la cantidad disponible.
- `/api/tables/inventory-sales/` y `/api/tables/stock-movements/`: historial real
  y auditable con usuario, fecha y existencias antes/después del movimiento.
- `/api/auth/`: sesión Django protegida por CSRF para Diego, Nico y Fabian.

## Desarrollo local

Requisitos: Node.js 26+ y Python 3.12+.

### Windows (PowerShell)

Im Projekt-Hauptordner ausführen. Die Datenbankzugangsdaten müssen bereits
in `backend/.env` konfiguriert sein.

```powershell
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r .\backend\requirements.txt
$env:DJANGO_DEBUG = "true"
.\.venv\Scripts\python.exe .\backend\manage.py runserver 127.0.0.1:8000
```

In einem zweiten PowerShell-Terminal im Projekt-Hauptordner:

```powershell
npm start
```

Öffne `http://localhost:4200/`. Der API-Proxy ist auch bei `ng serve`
standardmäßig aktiv. PowerShell unterstützt die Linux-Schreibweise
`DJANGO_DEBUG=true python ...` nicht; unter Windows liegt die Python-Datei
der virtuellen Umgebung in `Scripts`, nicht in `bin`.

VS Code lädt über `python.terminal.useEnvFile` die Variablen aus `backend/.env`
in neue Terminals. Mit `DJANGO_DEBUG=true` in dieser lokalen Datei reicht dort
`.\.venv\Scripts\python.exe .\backend\manage.py runserver` zum Backend-Start.

### Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -e .
cp .env.example .env
python manage.py migrate
python manage.py check_team_setup
python manage.py runserver
```

Antes de ejecutar `migrate`, pide al propietario del proyecto por un canal
privado estos dos valores y reemplázalos en `backend/.env`:

- `DJANGO_SECRET_KEY`: debe ser el mismo para los tres miembros, porque firma
  los enlaces de primera contraseña.
- `DB_PASSWORD`: contraseña del Transaction Pooler de Supabase.

El host, usuario, puerto `6543` y el resto de la configuración compartida ya
están en `.env.example`. Nunca subas `.env` ni esos dos secretos al repositorio.
`check_team_setup` confirma que la laptop ve la base compartida, los productos y
los tres usuarios; el servidor ya no cambia silenciosamente a una SQLite vacía.

### Primera contraseña del equipo

Los usuarios `sosa.diego`, `friedrich.nico` y `tebben.fabian` pertenecen al
grupo Django `team` y se activan mediante enlaces firmados de un solo uso. El
administrador genera los enlaces en su terminal y envía cada uno por un canal
privado:

```bash
cd backend
source .venv/bin/activate
python manage.py activation_links
```

Cada enlace caduca en 24 horas y deja de funcionar inmediatamente después de
crear la contraseña. No publiques estos enlaces ni los guardes en Git.

Después de la activación, en otra laptop no se vuelve a usar el enlace. Se abre
`http://localhost:4200/` y se inicia sesión con `sosa.diego`, `friedrich.nico` o
`tebben.fabian` y la contraseña personal configurada.

### Contraseña olvidada

Si alguien olvidó su contraseña, el administrador genera un enlace nuevo. Esto
invalida la contraseña anterior y permite elegir una nueva con el enlace:

```bash
python manage.py activation_links --username friedrich.nico --reset
```

Quien tiene acceso a la terminal con el `backend/.env` compartido también puede
cambiarla directamente:

```bash
python manage.py changepassword sosa.diego
```

### Frontend

```bash
npm install
npm start
```

Abre `http://localhost:4200/`. El proxy local envía las solicitudes `/api` a
Django en `http://127.0.0.1:8000`.

Las páginas `Bestand`, `Verkäufe` y `Analyse` trabajan con las operaciones
guardadas en PostgreSQL. Los gráficos no usan datos simulados: aparecerán y se
actualizarán después de registrar ventas reales desde la aplicación.

### Notificaciones de inventario por correo

Cada venta, reposición, modificación, eliminación o artículo nuevo genera una
notificación para cada usuario activo que tenga un correo registrado en la base
de Supabase (tabla `auth_user`). Las direcciones no están escritas en el código:
para agregar o quitar destinatarios basta con cambiar el correo del usuario.

En desarrollo, si no se configura SMTP, Django imprime los correos en la
terminal del backend. Para entrega real configura el SMTP en `backend/.env` y
en las variables del despliegue. Con Gmail solo hacen falta la cuenta y una
contraseña de aplicación:

```dotenv
EMAIL_HOST_USER=tu.cuenta@gmail.com
EMAIL_HOST_PASSWORD=CONTRASEÑA_DE_APLICACION
```

Para comprobar la configuración y ver a quién se enviarán los avisos:

```bash
python manage.py check_email_setup          # muestra backend, remitente y destinatarios
python manage.py check_email_setup --send   # envía un correo de prueba a todos
```

También se puede usar otro proveedor SMTP, por ejemplo Resend:

```dotenv
DJANGO_EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.resend.com
EMAIL_PORT=587
EMAIL_HOST_USER=resend
EMAIL_HOST_PASSWORD=REPLACE_WITH_SECRET
EMAIL_USE_TLS=true
EMAIL_USE_SSL=false
DEFAULT_FROM_EMAIL=Paradise Kiss <lager@example.com>
INVENTORY_EMAIL_NOTIFICATIONS_ENABLED=true
```

El dominio de `DEFAULT_FROM_EMAIL` debe estar verificado por el proveedor. Los
secretos SMTP nunca deben subirse a Git. La configuración SMTP de Supabase Auth
solo envía mensajes propios de autenticación; Django necesita las mismas
credenciales configuradas como variables para enviar eventos de inventario.

### Pruebas locales aisladas

Para que las pruebas no escriban en Supabase, fuerza SQLite:

```bash
DJANGO_USE_SQLITE=true backend/.venv/bin/python backend/manage.py test \
  resources.tests resources.tests_auth
npm test -- --watch=false
npm run build
```

## Producción en Vercel

`vercel.json` define dos servicios: Angular en `/` y Django en `/api`. En el
proyecto de Vercel hay que seleccionar el Framework Preset `Services` y añadir
estas variables de entorno:

- `DATABASE_URL`
- `DJANGO_SECRET_KEY`
- `DJANGO_ALLOWED_HOSTS`
- `DJANGO_CORS_ALLOWED_ORIGINS`
- `DJANGO_CSRF_TRUSTED_ORIGINS`
- `FRONTEND_URL`
- `DB_POOL_MODE=transaction`
- `DB_CONN_MAX_AGE=0`

La contraseña que estuvo escrita en `Sandbox` debe rotarse antes de desplegar.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
