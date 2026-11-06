# Despliegue en Cloudflare Workers

La app corre como un Cloudflare Worker generado por OpenNext (`@opennextjs/cloudflare`). La configuración está en `apps/web/wrangler.jsonc`, `apps/web/open-next.config.ts` y `apps/web/worker.ts` (la entrada del Worker, envuelta por Sentry).

## Lista para salir a producción

En orden. «Tú» = necesita tus cuentas; «Claude» = lo hago con el acceso que me des.

1. **Supabase** (tú: `supabase login`; Claude: el resto, con tu confirmación antes de `db push`)
   - `supabase link --project-ref <project-ref>` y `supabase db push` (crea tablas, RLS y el bucket `ai-uploads`).
   - Catálogo inicial: `SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… pnpm catalog:import` (una vez; después lo mantiene `catalog-sync.yml`).
   - Auth → URL Configuration y proveedor Google (sección 1).
2. **Google Cloud** (tú): pantalla de consentimiento OAuth en «En producción» (solo pide nombre, correo y foto, no necesita verificación de Google) y la URI de redirección de Supabase.
3. **Upstash Redis** (tú): crear una base gratuita y pasar `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN`. Obligatorio en Cloudflare: sin Redis el límite de peticiones no protege la cuota de OpenRouteService ni de la IA.
4. **Cloudflare** (tú): plan Workers Paid, conectar el repositorio con Workers Builds (sección 2), variables de build y secretos del Worker, dominio.
5. **GitHub** (tú o Claude con `gh`): secretos `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` del repositorio para `catalog-sync.yml` y `ai-uploads-purge.yml`.
6. **Orígenes permitidos** (tú): agregar el dominio en MapTiler (Allowed HTTP Origins) y en Supabase (Redirect URLs).
7. **Verificación** (Claude): `node scripts/smoke-prod.mjs https://<tu-dominio>` (cabeceras, CSP con nonce, rutas públicas, 401 de la API) y Lighthouse en móvil.
8. **Primer uso real** (tú): iniciar sesión con Google, crear un vehículo, calcular carga y trayecto, registrar una recarga con foto y preguntarle al asistente.

Antes de abrir al público: revisión legal de `/privacidad` y `/terminos`, y `NEXT_PUBLIC_PRIVACY_CONTACT_EMAIL` con un buzón que alguien lea (Ley 1581).

## 1. Supabase de producción

1. Crea el proyecto en Supabase (región `us-east-1` o la más cercana a tus usuarios).
2. Vincula y sube las migraciones desde tu máquina:
   ```bash
   supabase link --project-ref <project-ref>
   supabase db push
   ```
3. Auth → Providers → Google: Client ID y Secret de Google Cloud.
4. Auth → URL Configuration:
   - Site URL: `https://<tu-dominio>`
   - Redirect URLs: `https://<tu-dominio>/auth/callback` y, mientras no tengas dominio propio, `https://elacharger.<tu-subdominio>.workers.dev/auth/callback`.
5. Google Cloud → Credenciales → cliente OAuth: agrega `https://<project-ref>.supabase.co/auth/v1/callback` como URI de redirección autorizada.

## 2. Cloudflare

### Plan

El Worker pesa unos 3,8 MiB comprimido (Next.js, Sentry, Zod, el SDK de Anthropic). El plan gratuito de Workers admite 3 MiB y el plan pago (Workers Paid, desde USD 5/mes) admite 10 MiB, así que se necesita el plan pago. `wrangler deploy --dry-run` muestra el tamaño (`Total Upload … gzip`).

### Despliegue desde GitHub (recomendado): Workers Builds

Cloudflare compila en una máquina limpia, sin archivos `.env`, que es lo que exige el despliegue (ver «Secretos»).

1. Dashboard → Workers & Pages → Create → Import a repository → elige el repositorio.
2. Configuración de build:
   - Root directory: `/` (la raíz del monorepo, donde está `pnpm-lock.yaml`).
   - Build command: `pnpm --filter @elacharger/web exec opennextjs-cloudflare build && node apps/web/scripts/check-worker-env.mjs`
   - Deploy command: `pnpm --filter @elacharger/web exec wrangler deploy`
   - El nombre del Worker debe ser `elacharger` (el de `wrangler.jsonc`).
3. Build variables (Settings → Build → Variables): las `NEXT_PUBLIC_*` de la tabla. Next las incrusta en el código del navegador durante el build, así que tienen que existir en ese momento.
4. Variables and Secrets del Worker (Settings → Variables and Secrets): las de servidor de la tabla, como **Secret**.
5. Settings → Domains & Routes: agrega tu dominio propio si lo tienes.

Cada push a `main` despliega. Las ramas pueden generar versiones de vista previa (Settings → Build → Branch control).

### Variables

| Variable | Dónde | Obligatoria | Nota |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Build | Sí | Proyecto de producción, `https://` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Build | Sí | |
| `NEXT_PUBLIC_PRIVACY_CONTACT_EMAIL` | Build | Sí | Ley 1581: canal para solicitudes de datos |
| `NEXT_PUBLIC_MAP_STYLE_URL` | Build | Opcional | URL del estilo de MapTiler con su llave; sin ella, OpenFreeMap |
| `NEXT_PUBLIC_SENTRY_DSN` | Build | Opcional | Errores del navegador |
| `ORS_API_KEY` | Secret | Sí | Llave de OpenRouteService (cuenta HeiGIT). Sin ella, Trayecto responde 503 |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Secret | Sí | Sin Redis, el límite de peticiones vive en la memoria de cada instancia del Worker y casi no limita |
| `SENTRY_DSN` | Secret | Opcional | Errores del servidor, sin datos personales |
| `SENTRY_ENVIRONMENT` | Variable | Opcional | Por defecto `production` |
| `ANTHROPIC_API_KEY` | Secret | Opcional | IA: búsqueda de fichas, importar ficha, recarga con foto y asistente. Sin ella, esas funciones responden 503 |
| `AI_MODEL_EXTRACTION` | Variable | Opcional | Lectura de fichas y fotos; por defecto `claude-haiku-5-5` |
| `AI_MODEL_LOOKUP` | Variable | Opcional | Búsqueda web de fichas faltantes; por defecto `claude-sonnet-5-5` (~USD 0,15 por búsqueda) |
| `AI_MODEL_ASSISTANT` | Variable | Opcional | Asistente; por defecto `claude-opus-5-5` |
| `AI_DAILY_LIMIT_EXTRACTIONS`, `AI_DAILY_LIMIT_MESSAGES` | Variable | Opcional | Por usuario y día; por defecto 20 y 50 |
| `AI_MONTHLY_BUDGET_USD` | Variable | Opcional | Tope global de gasto estimado en IA por mes; por defecto 50 |

Nunca configures `SUPABASE_SERVICE_ROLE_KEY` ni `E2E_SUPABASE_SECRET_KEY` en el Worker: la app no las usa.

### Secretos: por qué no se despliega desde tu máquina

OpenNext copia dentro del código del Worker todos los valores de los archivos `.env` que encuentra (`apps/web/.env*` y los de la raíz del monorepo), y Next incrusta en el navegador las `NEXT_PUBLIC_*` de esos archivos. Un build hecho en tu máquina llevaría tus llaves dentro del script y apuntaría al Supabase local.

`apps/web/scripts/check-worker-env.mjs` revisa el build y falla si encuentra una variable de servidor salida de un `.env` o la URL del Supabase local. Lo ejecutan la CI, el build de Workers Builds y `pnpm --filter @elacharger/web deploy:cf`. Por eso `deploy:cf` solo funciona en una copia limpia del repositorio (sin `.env`), con las `NEXT_PUBLIC_*` exportadas en la terminal y los secretos cargados con:

```bash
pnpm --filter @elacharger/web exec wrangler login
pnpm --filter @elacharger/web exec wrangler secret put ORS_API_KEY
```

## 3. Probar el Worker en tu máquina

```bash
pnpm --filter @elacharger/web preview:cf          # build + Worker local en http://localhost:8787
E2E_RUNTIME=cloudflare PORT=8787 pnpm test:e2e     # la suite E2E contra el Worker
```

En local sí se usan tus `.env` (es tu máquina). Para variables puntuales: `pnpm --filter @elacharger/web exec opennextjs-cloudflare preview --var CLAVE:valor`.

## 4. Verificación después de desplegar

`node scripts/smoke-prod.mjs https://<tu-dominio>` revisa automáticamente lo que no necesita sesión. Además:

- `GET /api/v1/meta` responde 200.
- La cabecera `Content-Security-Policy` de `/login` trae `'nonce-…'` y `upgrade-insecure-requests`; `/sw.js` y `/icons/icon-192.png` traen `Strict-Transport-Security`.
- Inicia sesión con Google, crea un vehículo, calcula una carga y un trayecto.
- Chrome → Lighthouse (móvil) en `/login`, `/`, `/trip`, `/charge`: ≥ 90 en las cuatro categorías.
- Registros en vivo: `pnpm --filter @elacharger/web exec wrangler tail`.
- MapTiler → Allowed HTTP Origins: agrega el dominio del Worker.

## Notas

- Todas las páginas se renderizan por petición: la CSP lleva un nonce por petición, que una página prerenderizada no puede tener. Por eso `cacheComponents` está desactivado y la caché incremental solo sirve los archivos estáticos (manifest, robots).
- Los archivos de `public/` y `/_next/static` los sirve Cloudflare sin pasar por el Worker; sus cabeceras salen de `apps/web/public/_headers` (una prueba la mantiene igual a `src/lib/security-headers.ts`).
- El `proxy.ts` de Next 16 corre en el runtime de Node; OpenNext lo soporta desde 1.20.3 y lo marca como experimental. La CI corre toda la suite E2E sobre el Worker para detectar regresiones.
- Las cachés en memoria (rutas, catálogo) son por instancia del Worker: funcionan, pero comparten menos.
- `global_fetch_strictly_public` impide que el Worker llame a direcciones privadas.
- El catálogo se sincroniza con `.github/workflows/catalog-sync.yml` cuando el repositorio tiene los secretos `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`.
- IA (fase 8): la migración crea el bucket privado `ai-uploads`. La app borra cada ficha o foto apenas la lee; `.github/workflows/ai-uploads-purge.yml` borra cada hora lo que quede con más de 24 h (mismos secretos del repositorio). El gasto estimado queda en la tabla `ai_usage`.
