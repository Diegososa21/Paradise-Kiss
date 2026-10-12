# Paradise Kiss

[English](README.md) | **Español**

Proyecto escolar: sistema de inventario para una tienda de moda. Frontend en
Angular, API en Django REST y base de datos PostgreSQL en Supabase.

## Funciones

- **Inventario:** productos con GTIN-13 automática, precios WHS (compra) y RT
  (venta), talla, material, categoría, proveedor (Lieferant) y lugar en el almacén.
- **Produktübersicht:** búsqueda por GTIN o por características y filtros por
  categoría, Lieferant, género, talla y nivel de stock.
- **Verwaltung:** ventas, reposiciones, ubicación, precios y detalles de cada
  producto, con historial de movimientos de stock.
- **Ventas:** registro de ventas y anulación ("Stornieren") que devuelve el stock.
- **Analyse:** gráfico trimestral desde 2023, ranking de artículos y KI-Assistent.
- **Dashboard:** indicadores y Gesamtumsatz por año.
- **Correo:** aviso al equipo en cada cambio de inventario.

## Arquitectura

- `src/`: frontend Angular.
- `backend/`: API Django REST.
- Supabase: base de datos PostgreSQL usada por Django.

Endpoints principales (en local y en Vercel van detrás del prefijo `/api`):

| Endpoint | Función |
|---|---|
| `/tables/resources/` | Listar (con `?search=`) y crear productos. La GTIN se asigna sola. |
| `/tables/resources/<id>/sell/` | Registrar una venta y descontar el stock de forma atómica. |
| `/tables/resources/<id>/restock/` | Registrar una reposición y guardar el movimiento. |
| `/tables/resources/<id>/details/` | Editar nombre, descripción, talla, material, categoría, Lieferant y género. |
| `/tables/resources/<id>/inventory-settings/` | Editar estante, compartimento, stock mínimo y precios. |
| `/tables/categories/`, `/tables/manufacturers/` | Listar y crear categorías y Lieferanten. |
| `/tables/inventory-sales/` | Historial de ventas; `DELETE /<id>/` anula una venta (Storno). |
| `/tables/stock-movements/` | Historial de movimientos de stock. |
| `/tables/sales-report/` | Unidades y Umsatz por trimestre y año. |
| `/tables/assistant/` | KI-Assistent (`POST`). |
| `/auth/` | Sesión Django protegida por CSRF para los miembros del grupo `team`. |

La edición genérica de productos (`PATCH /tables/resources/<id>/`) está
bloqueada a propósito: el stock solo cambia con ventas y reposiciones, para que
cada movimiento quede registrado.

## Desarrollo local

Requisitos: Node.js 22.22.3+, 24.15+ o 26+ (lo exige Angular 22) y Python 3.12+.

### Windows (PowerShell)

Inicio automático, en la carpeta del proyecto:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-local.ps1
```

El script actualiza la rama, crea `.venv`, instala las dependencias, revisa
`backend/.env` y la conexión con Supabase, y abre el backend (puerto 8000) y el
frontend (puerto 4200) en dos ventanas. Si falta algo, indica qué corregir.
Opciones: `-SkipGitSync` (no actualizar desde GitHub) y `-NoBrowser`.

Pasos manuales, en la carpeta del proyecto. Los datos de acceso a la base de
datos tienen que estar ya en `backend/.env`.

```powershell
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r .\backend\requirements.txt
$env:DJANGO_DEBUG = "true"
.\.venv\Scripts\python.exe .\backend\manage.py runserver 127.0.0.1:8000
```

En una segunda ventana de PowerShell, también en la carpeta del proyecto:

```powershell
npm start
```

Abre `http://localhost:4200/`. El proxy de la API está activo también con
`ng serve`. PowerShell no admite la forma de Linux `DJANGO_DEBUG=true python ...`,
y en Windows el Python del entorno virtual está en `Scripts`, no en `bin`.

VS Code carga las variables de `backend/.env` en las terminales nuevas
(`python.terminal.useEnvFile`). Con `DJANGO_DEBUG=true` en ese archivo basta con
`.\.venv\Scripts\python.exe .\backend\manage.py runserver` para arrancar el backend.

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

- `DJANGO_SECRET_KEY`: debe ser el mismo para todo el equipo, porque firma los
  enlaces de primera contraseña.
- `DB_PASSWORD`: contraseña del Transaction Pooler de Supabase.

El host, el usuario, el puerto `6543` y el resto de la configuración compartida
ya están en `.env.example`. Nunca subas `.env` ni esos dos secretos al
repositorio. `check_team_setup` confirma que el equipo ve la base compartida, los
productos y los usuarios; el servidor no cambia en silencio a una SQLite vacía.

### Primera contraseña del equipo

Los usuarios de la app pertenecen al grupo Django `team` y se activan con
enlaces firmados de un solo uso. El administrador genera los enlaces en su
terminal y envía cada uno por un canal privado:

```bash
cd backend
source .venv/bin/activate
python manage.py activation_links
```

Cada enlace caduca en 24 horas y deja de funcionar en cuanto se crea la
contraseña. No publiques estos enlaces ni los guardes en Git.

Después de la activación no se vuelve a usar el enlace: se abre
`http://localhost:4200/` y se inicia sesión con el usuario (por ejemplo
`sosa.diego`) y la contraseña personal.

### Contraseña olvidada

El administrador genera un enlace nuevo. Esto invalida la contraseña anterior y
permite elegir otra con el enlace:

```bash
python manage.py activation_links --username friedrich.nico --reset
```

Quien tenga una terminal con el `backend/.env` compartido también puede
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

Las páginas `Bestand`, `Verkäufe` y `Analyse` trabajan con los datos guardados
en PostgreSQL. El gráfico trimestral de `Analyse` y el Gesamtumsatz del
dashboard (`/api/tables/sales-report/`) combinan dos fuentes:

- 2023 a 2026 Q3: cifras trimestrales históricas de ejemplo por categoría
  (tabla `resources_salesdata`).
- 2026 Q4 en adelante: las ventas registradas en la aplicación. Cada venta guarda
  el RT-Preis de ese momento (`unit_price`), así que el Umsatz no cambia si
  después se modifica el precio.

Una venta se puede anular en `Verkäufe` ("Stornieren"): desaparece del informe,
el stock se devuelve y queda un movimiento "Storno" en el historial.

Las fotos de perfil son archivos estáticos en `public/profiles/`. La relación
entre usuario y foto está en `AVATAR_URLS`, en `backend/resources/auth_views.py`.

### KI-Assistent (Analyse)

En la página `Analyse` hay un chat que responde qué categorías y productos se
venden más, cómo evoluciona el Umsatz y qué tipo de productos conviene comprar.
También se llega desde el enlace "KI-Assistent" del sidebar.

Cómo funciona (`backend/resources/assistant.py`, endpoint `POST /api/tables/assistant/`):

1. El backend calcula un resumen **agregado y anónimo**: ventas por categoría y
   trimestre, ventas registradas por producto, stock, precios y márgenes. No
   incluye nombres de usuario, emails ni contraseñas.
2. Si `GEMINI_API_KEY` está configurada, envía la pregunta y ese resumen a Google
   Gemini (capa gratuita, modelo `gemini-3.8-flash`; si está saturado o sin
   cuota, prueba `gemini-3.5-flash-lite`) con `generate_content`, que no guarda
   la conversación en Google. Gemini solo recibe datos: no puede leer ni
   modificar la base de datos.
3. Sin clave, o si Gemini falla o se agota la cuota gratuita, responde la
   **Basis-Analyse**: reglas fijas en el backend, sin enviar nada fuera.

Regla de compra: se compara el % de la demanda de cada categoría (último año
completo) con su % del stock actual. Si la demanda es mayor que el stock, se
recomienda comprar. También cuentan los artículos bajo la Meldeschwelle y la
temporada (el Q4 es el trimestre más fuerte).

Seguridad: solo usuarios del grupo `team`, máximo 30 preguntas por hora y
usuario (`ASSISTANT_RATE_LIMIT`). La clave solo vive en `backend/.env` y nunca
llega al navegador. En la UE/EEE, Google no usa los datos de la capa gratuita
para entrenar sus modelos (Gemini API Additional Terms).

Activar Gemini: crea una clave gratuita en https://aistudio.google.com/apikey,
añade `GEMINI_API_KEY=...` en `backend/.env` y reinicia el backend.

### Notificaciones de inventario por correo

Cada venta, reposición, modificación, anulación, eliminación o artículo nuevo
genera un aviso para cada usuario activo que tenga un correo registrado en la
base de Supabase (tabla `auth_user`). Las direcciones no están escritas en el
código: para añadir o quitar destinatarios basta con cambiar el correo del
usuario.

En desarrollo, si no se configura SMTP, Django imprime los correos en la
terminal del backend. Para enviarlos de verdad, configura el SMTP en
`backend/.env` y en las variables del despliegue. Con Gmail solo hacen falta la
cuenta y una contraseña de aplicación:

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

El dominio de `DEFAULT_FROM_EMAIL` tiene que estar verificado en el proveedor.
Los secretos SMTP nunca deben subirse a Git. El SMTP configurado en Supabase
Auth solo envía los correos de autenticación de Supabase; Django necesita sus
propias credenciales para los avisos de inventario.

### Pruebas locales aisladas

Para que las pruebas no escriban en Supabase, fuerza SQLite:

```bash
DJANGO_USE_SQLITE=true DJANGO_DEBUG=true backend/.venv/bin/python backend/manage.py test resources
npm test -- --watch=false
npm run build
```

## Producción en Vercel

`vercel.json` define dos servicios en un solo proyecto: Angular (`frontend`) en
`/` y Django (`api`) en `/api`. Vercel quita el prefijo `/api` antes de llegar a
Django, y las funciones corren en Dublín (`dub1`), junto a Supabase.

Variables necesarias en Vercel: `POSTGRES_URL` (de la integración
Supabase–Vercel) y `DJANGO_SECRET_KEY`. Opcionales: `GEMINI_API_KEY`
(KI-Assistent) y las de correo.

Detalles, causa del fallo de despliegue de septiembre/octubre de 2026 y cómo
comprobar un despliegue: [docs/despliegue-vercel.md](docs/despliegue-vercel.md).

## Angular CLI

El proyecto se generó con [Angular CLI](https://github.com/angular/angular-cli)
22.1.8.

| Tarea | Comando |
|---|---|
| Servidor de desarrollo (recarga automática) | `ng serve` |
| Nuevo componente | `ng generate component nombre` |
| Ver todos los generadores | `ng generate --help` |
| Compilar en `dist/` | `ng build` |
| Tests unitarios ([Vitest](https://vitest.dev/)) | `ng test` |

Angular CLI no incluye un framework de pruebas end-to-end; se puede añadir uno y
ejecutarlo con `ng e2e`. Referencia completa:
[Angular CLI Overview and Command Reference](https://angular.dev/tools/cli).
