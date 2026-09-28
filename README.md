# ParadiseKiss

Schulprojekt desarrollado con Angular.

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 22.1.8.

## Arquitectura

- `src/`: frontend Angular.
- `backend/`: API Django REST.
- Supabase: base de datos PostgreSQL usada por Django.
- `/api/resources/`: listado y creación de prendas con nombre, descripción,
  talla, categoría, fabricante, material y género.

## Desarrollo local

Requisitos: Node.js 26+ y Python 3.12+.

### Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -e .
cp .env.example .env
python manage.py migrate
python manage.py runserver
```

Antes de usar Supabase, reemplaza `DATABASE_URL` en `backend/.env` con la URL
del Session Pooler y una contraseña de base de datos nueva. Nunca subas `.env`
al repositorio.

### Frontend

```bash
npm install
npm start
```

Abre `http://localhost:4200/`. El proxy local envía las solicitudes `/api` a
Django en `http://127.0.0.1:8000`.

## Producción en Vercel

`vercel.json` define dos servicios: Angular en `/` y Django en `/api`. En el
proyecto de Vercel hay que seleccionar el Framework Preset `Services` y añadir
estas variables de entorno:

- `DATABASE_URL`
- `DJANGO_SECRET_KEY`
- `DJANGO_ALLOWED_HOSTS`
- `DJANGO_CORS_ALLOWED_ORIGINS`
- `DJANGO_CSRF_TRUSTED_ORIGINS`

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
