# Despliegue en Vercel

Este documento explica cómo se publica Paradise Kiss en Vercel, por qué el
despliegue fallaba desde el 28 de septiembre de 2026 y qué se cambió el 5 de
octubre de 2026 para arreglarlo.

## Resumen

| | Antes | Después |
|---|---|---|
| Estado en GitHub | "Vercel – Deployment failed" en cada commit desde `79a1fcb` | Despliegue correcto |
| `vercel.json` | `experimentalServices` (ya no admitido) | `services` + `rewrites` |
| Ruta `/api/...` | Llegaba a Django con el prefijo `/api` | Vercel quita `/api` antes de Django |
| Base de datos | Django no encontraba la conexión | Usa `POSTGRES_URL` de la integración Supabase–Vercel |
| `DJANGO_SECRET_KEY` | No existía en Vercel | Creada (solo para Vercel) |
| Región de las funciones | Washington (`iad1`) | Dublín (`dub1`), junto a Supabase (`eu-west-1`) |

## Cómo está montado

Un solo proyecto de Vercel con dos **servicios** que se despliegan juntos:

```
navegador ──► Vercel
               ├─ /api/*  ──► servicio "api"       (Django, carpeta backend/)
               │              Vercel quita "/api": /api/tables/resources/ → /tables/resources/
               └─ /*      ──► servicio "frontend"  (Angular, raíz del repositorio)
                              rutas como /inventory devuelven index.html (SPA)
Django ──► Supabase Postgres (pooler de transacciones, eu-west-1)
```

Frontend y API comparten dominio, así que las cookies de sesión y la protección
CSRF funcionan sin configurar CORS.

## Qué fallaba y por qué

### 1. `experimentalServices` ya no existe (causa principal)

`vercel.json` se añadió en el commit `79a1fcb` ("Integrate Django resource
backend", 28-09-2026) con la clave `experimentalServices`. Vercel rechazaba la
configuración antes de compilar, por eso GitHub mostraba "Deployment failed"
sin enlace a ningún log. Pidiendo el despliegue por la API de Vercel apareció el
error real:

```
experimental_services_restricted: The `experimentalServices` property is no
longer available for new projects. Use the `services` property instead.
```

**Arreglo:** `vercel.json` usa ahora `services` (cada servicio con su `root`) y
las rutas públicas en `rewrites`. El archivo se validó contra el schema oficial
`https://openapi.vercel.sh/vercel.json`.

### 2. Django no conoce el prefijo `/api`

Vercel entrega al servicio la ruta original (`/api/tables/resources/`), pero las
URLs de Django son `/tables/...` y `/auth/...`. En local el proxy de Angular ya
quitaba `/api` (`proxy.conf.json`); en Vercel lo hace la regla del servicio
`api`: `"/api/:path(.*)?" → "/:path"`.

### 3. Faltaban variables de entorno

Al arreglar lo anterior, la compilación falló con
`RuntimeError: DJANGO_SECRET_KEY is required when DJANGO_DEBUG is false`.
Vercel solo tenía las variables de la integración Supabase (`POSTGRES_URL`, …),
y únicamente para *Production*.

**Arreglo:**

- Se creó `DJANGO_SECRET_KEY` en Vercel (tipo *sensitive*, Production y
  Preview). Es una clave **nueva y aleatoria, distinta de la de los `.env`
  locales**; Vercel no permite volver a leerla.
- `POSTGRES_URL` se activó también para *Preview*, para probar cada branch.
- `backend/backend/settings.py` usa `POSTGRES_URL` cuando no hay `DATABASE_URL`.
  La integración añade parámetros propios a la URL (por ejemplo `supa=...`) que
  el driver `psycopg` rechaza; Django solo conserva los de PostgreSQL
  (`sslmode`, `sslrootcert`, `connect_timeout`, `application_name`).
- Django acepta también el dominio de cada branch (`VERCEL_BRANCH_URL`), además
  de `VERCEL_URL` y `VERCEL_PROJECT_PRODUCTION_URL`.

### 4. Mejora: región de las funciones

Las funciones corrían en Washington mientras Supabase está en Irlanda, así que
cada consulta cruzaba el Atlántico. `"regions": ["dub1"]` las ejecuta en Dublín.

## Variables de entorno en Vercel

| Variable | Origen | Necesaria | Entornos |
|---|---|---|---|
| `POSTGRES_URL` | Integración Supabase–Vercel | Sí | Production, Preview |
| `DJANGO_SECRET_KEY` | Creada el 05-10-2026 | Sí | Production, Preview |
| `GEMINI_API_KEY` | Google AI Studio | No: sin ella el KI-Assistent usa la Basis-Analyse | — (pendiente) |
| `DJANGO_DEBUG` | — | No definir (en Vercel debe ser `false`) | — |
| `EMAIL_HOST_USER` / `EMAIL_HOST_PASSWORD` | Gmail | Solo para enviar avisos por correo | — (pendiente) |

Para añadir una variable: Vercel → proyecto `paradise-kiss` → Settings →
Environment Variables. Después hay que volver a desplegar (Deployments → ⋯ →
Redeploy), porque Vercel lee las variables al compilar.

## Cómo comprobar un despliegue

| URL | Respuesta esperada |
|---|---|
| `/` y `/inventory` | La aplicación Angular |
| `/api/auth/session/` | `{"authenticated": false, "user": null}` (o el usuario con sesión) |
| `/api/tables/resources/` sin sesión | 403 `Authentication credentials were not provided.` |

## A tener en cuenta

- **Migraciones:** Vercel no ejecuta `migrate`. Las migraciones se aplican desde
  un equipo del equipo con `python manage.py migrate` contra Supabase (la base es
  la misma para local y Vercel).
- **Enlaces de activación:** dependen de `DJANGO_SECRET_KEY`. Un enlace generado
  en local no sirve en Vercel y al revés, porque las claves son distintas.
- **Protección de despliegues:** el proyecto tiene activada la protección de
  Vercel (*Vercel Authentication*) para las URLs `*.vercel.app`. Quien abra la web
  necesita una cuenta de Vercel con acceso al proyecto. Se puede desactivar en
  Settings → Deployment Protection si la web debe ser pública (por ejemplo para
  el profesor).
- **Archivos:** la configuración está en `vercel.json`; la lógica de dominios y
  base de datos, en `backend/backend/settings.py`.
