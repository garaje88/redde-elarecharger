# Despliegue en Vercel

## 1. Supabase de producción

1. Crea el proyecto en Supabase (región `us-east-1` o la más cercana a Vercel).
2. Vincula y sube las migraciones desde tu máquina:
   ```bash
   supabase link --project-ref <project-ref>
   supabase db push
   ```
3. Auth → Providers → Google: Client ID y Secret de Google Cloud.
4. Auth → URL Configuration:
   - Site URL: `https://<tu-dominio>`
   - Redirect URLs: `https://<tu-dominio>/auth/callback` (y `https://*-<equipo>.vercel.app/auth/callback` para previews).
5. Google Cloud → Credenciales → cliente OAuth: agrega `https://<project-ref>.supabase.co/auth/v1/callback` como URI de redirección autorizada.

## 2. Proyecto en Vercel

1. Importa el repositorio. Root Directory: `apps/web` (Vercel detecta pnpm y Turborepo).
2. Variables de entorno (Production y Preview):

| Variable | Obligatoria | Nota |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Sí | |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Sí | |
| `ORS_API_KEY` | Sí | Sin ella, Trayecto responde 503 |
| `NEXT_PUBLIC_PRIVACY_CONTACT_EMAIL` | Sí | Ley 1581: canal para solicitudes de datos |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Recomendada | Rate limit compartido entre instancias |
| `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN` | Opcional | Errores sin datos personales |
| `NEXT_PUBLIC_MAP_STYLE_URL` | Opcional | Por defecto OpenFreeMap |
| `ANTHROPIC_API_KEY` | Opcional | Búsqueda con IA de fichas faltantes |

Nunca configures `SUPABASE_SERVICE_ROLE_KEY` ni `E2E_SUPABASE_SECRET_KEY` en Vercel: la app no las usa.

## 3. Verificación después de desplegar

- `GET /api/v1/meta` responde 200.
- La cabecera `Content-Security-Policy` de `/login` trae `'nonce-…'` y `upgrade-insecure-requests`.
- Inicia sesión con Google, crea un vehículo, calcula una carga y un trayecto.
- Chrome → Lighthouse (móvil) en `/login`, `/`, `/trip`, `/charge`: ≥ 90 en las cuatro categorías.

## Notas

- Todas las páginas se renderizan por petición: la CSP lleva un nonce por petición, que una página prerenderizada no puede tener. Por eso `cacheComponents` está desactivado.
- El catálogo se sincroniza con `.github/workflows/catalog-sync.yml` cuando el repositorio tiene los secretos `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`.
