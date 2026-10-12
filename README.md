# Paradise Kiss

**English** | [Español](README.es.md)

School project: an inventory system for a fashion store. Angular frontend,
Django REST API and a PostgreSQL database on Supabase.

## Features

- **Inventory:** products with an automatic GTIN-13, WHS (purchase) and RT
  (retail) prices, size, material, category, supplier (Lieferant) and storage
  location.
- **Produktübersicht (product overview):** search by GTIN or by characteristics,
  with filters for category, supplier, gender, size and stock level.
- **Verwaltung (management):** sales, restocks, location, prices and product
  details, with a stock movement history.
- **Sales:** register sales and cancel them ("Stornieren"), which returns the
  units to stock.
- **Analyse:** quarterly chart since 2023, product ranking and the KI-Assistent
  (AI assistant).
- **Dashboard:** key figures and total revenue (Gesamtumsatz) per year.
- **E-mail:** the team is notified about every inventory change.

## Architecture

- `src/`: Angular frontend.
- `backend/`: Django REST API.
- Supabase: PostgreSQL database used by Django.

Main endpoints (locally and on Vercel they sit behind the `/api` prefix):

| Endpoint | Purpose |
|---|---|
| `/tables/resources/` | List (with `?search=`) and create products. The GTIN is assigned automatically. |
| `/tables/resources/<id>/sell/` | Register a sale and reduce the stock atomically. |
| `/tables/resources/<id>/restock/` | Register a restock and record the movement. |
| `/tables/resources/<id>/details/` | Edit name, description, size, material, category, supplier and gender. |
| `/tables/resources/<id>/inventory-settings/` | Edit shelf, bin, reorder threshold and prices. |
| `/tables/categories/`, `/tables/manufacturers/` | List and create categories and suppliers. |
| `/tables/inventory-sales/` | Sales history; `DELETE /<id>/` cancels a sale (storno). |
| `/tables/stock-movements/` | Stock movement history. |
| `/tables/sales-report/` | Units and revenue per quarter and per year. |
| `/tables/assistant/` | KI-Assistent (`POST`). |
| `/auth/` | CSRF-protected Django session for members of the `team` group. |

Generic product editing (`PATCH /tables/resources/<id>/`) is blocked on purpose:
stock only changes through sales and restocks, so every movement is recorded.

## Local development

Requirements: Node.js 22.22.3+, 24.15+ or 26+ (required by Angular 22) and
Python 3.12+.

### Windows (PowerShell)

Automatic start, from the project folder:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-local.ps1
```

The script updates the branch, creates `.venv`, installs the dependencies,
checks `backend/.env` and the Supabase connection, and opens the backend
(port 8000) and the frontend (port 4200) in two windows. If something is
missing, it says what to fix. Options: `-SkipGitSync` (do not update from
GitHub) and `-NoBrowser`.

Manual steps, from the project folder. The database credentials must already be
in `backend/.env`.

```powershell
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r .\backend\requirements.txt
$env:DJANGO_DEBUG = "true"
.\.venv\Scripts\python.exe .\backend\manage.py runserver 127.0.0.1:8000
```

In a second PowerShell window, also in the project folder:

```powershell
npm start
```

Open `http://localhost:4200/`. The API proxy is also active with `ng serve`.
PowerShell does not support the Linux form `DJANGO_DEBUG=true python ...`, and
on Windows the virtual environment's Python lives in `Scripts`, not `bin`.

VS Code loads the variables from `backend/.env` into new terminals
(`python.terminal.useEnvFile`). With `DJANGO_DEBUG=true` in that file,
`.\.venv\Scripts\python.exe .\backend\manage.py runserver` is enough to start
the backend.

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

Before running `migrate`, ask the project owner for these two values through a
private channel and replace them in `backend/.env`:

- `DJANGO_SECRET_KEY`: must be the same for the whole team, because it signs the
  first-password links.
- `DB_PASSWORD`: password of the Supabase Transaction Pooler.

The host, user, port `6543` and the rest of the shared configuration are already
in `.env.example`. Never commit `.env` or those two secrets. `check_team_setup`
confirms that the machine sees the shared database, the products and the users;
the server never silently falls back to an empty SQLite database.

### First password for the team

App users belong to the Django group `team` and are activated with signed,
single-use links. The administrator generates the links in their terminal and
sends each one through a private channel:

```bash
cd backend
source .venv/bin/activate
python manage.py activation_links
```

Each link expires after 24 hours and stops working as soon as the password is
set. Do not publish these links or store them in Git.

After activation the link is not needed again: open `http://localhost:4200/` and
sign in with the username (for example `sosa.diego`) and the personal password.

### Forgotten password

The administrator generates a new link. This invalidates the old password and
lets the user choose a new one through the link:

```bash
python manage.py activation_links --username friedrich.nico --reset
```

Anyone with a terminal and the shared `backend/.env` can also change it
directly:

```bash
python manage.py changepassword sosa.diego
```

### Frontend

```bash
npm install
npm start
```

Open `http://localhost:4200/`. The local proxy forwards `/api` requests to Django
at `http://127.0.0.1:8000`.

The `Bestand`, `Verkäufe` and `Analyse` pages work with the data stored in
PostgreSQL. The quarterly chart on `Analyse` and the dashboard's total revenue
(`/api/tables/sales-report/`) combine two sources:

- 2023 to 2026 Q3: historical example figures per category and quarter
  (table `resources_salesdata`).
- 2026 Q4 onwards: the sales registered in the app. Each sale stores the RT price
  at that moment (`unit_price`), so revenue does not change if the price is
  edited later.

A sale can be cancelled on `Verkäufe` ("Stornieren"): it disappears from the
report, the stock is returned and a "Storno" movement stays in the history.

Profile pictures are static files in `public/profiles/`. The mapping from user to
picture is `AVATAR_URLS` in `backend/resources/auth_views.py`.

### KI-Assistent (Analyse)

The `Analyse` page has a chat that answers which categories and products sell
best, how revenue develops and which kinds of products to buy. It can also be
opened from the "KI-Assistent" link in the sidebar.

How it works (`backend/resources/assistant.py`, endpoint `POST /api/tables/assistant/`):

1. The backend builds an **aggregated, anonymous** summary: sales per category
   and quarter, registered sales per product, stock, prices and margins. It
   contains no usernames, e-mail addresses or passwords.
2. If `GEMINI_API_KEY` is set, it sends the question and that summary to Google
   Gemini (free tier, model `gemini-3.8-flash`; if it is overloaded or out of
   quota, `gemini-3.5-flash-lite`) using `generate_content`, which does not store
   the conversation at Google. Gemini only receives data: it cannot read or
   change the database.
3. Without a key, or if Gemini fails or the free quota runs out, the
   **Basis-Analyse** answers instead: fixed rules in the backend, nothing leaves
   the server.

Purchase rule: each category's share of demand (last complete year) is compared
with its share of the current stock. If demand is higher than stock, buying is
recommended. Products below the reorder threshold (Meldeschwelle) and the season
(Q4 is the strongest quarter) are taken into account as well.

Security: only users in the `team` group, at most 30 questions per hour and user
(`ASSISTANT_RATE_LIMIT`). The key lives only in `backend/.env` and never reaches
the browser. In the EU/EEA, Google does not use free-tier data to train its
models (Gemini API Additional Terms).

To enable Gemini: create a free key at https://aistudio.google.com/apikey, add
`GEMINI_API_KEY=...` to `backend/.env` and restart the backend.

### Inventory e-mail notifications

Every sale, restock, change, cancellation, deletion or new product sends a
notification to every active user with an e-mail address registered in the
Supabase database (table `auth_user`). No addresses are hard-coded: to add or
remove recipients, change the user's e-mail address.

In development, without SMTP settings, Django prints the e-mails in the backend
terminal. For real delivery, configure SMTP in `backend/.env` and in the
deployment's environment variables. Gmail only needs the account and an app
password:

```dotenv
EMAIL_HOST_USER=your.account@gmail.com
EMAIL_HOST_PASSWORD=APP_PASSWORD
```

To check the configuration and see who will receive the notifications:

```bash
python manage.py check_email_setup          # shows backend, sender and recipients
python manage.py check_email_setup --send   # sends a test e-mail to everyone
```

Any other SMTP provider works too, for example Resend:

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

The domain of `DEFAULT_FROM_EMAIL` must be verified with the provider. SMTP
secrets must never be committed to Git. The SMTP settings in Supabase Auth only
send Supabase's own authentication e-mails; Django needs its own credentials for
the inventory notifications.

### Isolated local tests

To keep tests from writing to Supabase, force SQLite:

```bash
DJANGO_USE_SQLITE=true DJANGO_DEBUG=true backend/.venv/bin/python backend/manage.py test resources
npm test -- --watch=false
npm run build
```

## Production on Vercel

`vercel.json` defines two services in one project: Angular (`frontend`) at `/`
and Django (`api`) at `/api`. Vercel strips the `/api` prefix before the request
reaches Django, and the functions run in Dublin (`dub1`), next to Supabase.

Required variables on Vercel: `POSTGRES_URL` (from the Supabase–Vercel
integration) and `DJANGO_SECRET_KEY`. Optional: `GEMINI_API_KEY`
(KI-Assistent) and the e-mail settings.

Details, the cause of the failed deployments in September/October 2026 and how
to verify a deployment: [docs/despliegue-vercel.md](docs/despliegue-vercel.md)
(in Spanish).

## Angular CLI

The project was generated with [Angular CLI](https://github.com/angular/angular-cli)
22.1.8.

| Task | Command |
|---|---|
| Development server (live reload) | `ng serve` |
| New component | `ng generate component component-name` |
| List all schematics | `ng generate --help` |
| Build into `dist/` | `ng build` |
| Unit tests ([Vitest](https://vitest.dev/)) | `ng test` |

Angular CLI does not include an end-to-end testing framework; add one and run it
with `ng e2e`. Full reference:
[Angular CLI Overview and Command Reference](https://angular.dev/tools/cli).
