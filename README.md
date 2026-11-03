# Elacharger

Calculadora para carros eléctricos: consumo de batería de un trayecto A→B y tiempo de carga hasta un % objetivo. La especificación completa está en [docs/PLAN.md](docs/PLAN.md).

## Requisitos

- Node 24 (ver `.nvmrc`; mínimo 20.9) y pnpm 11
- Docker y Supabase CLI (desde la fase 1)

## Primeros pasos

```bash
pnpm install
cp .env.example apps/web/.env.local   # completa las llaves de Supabase
pnpm dev                               # http://localhost:3000
```

## Base de datos (Supabase local)

```bash
pnpm db:start     # levanta Supabase en Docker y aplica supabase/migrations + seed.sql
pnpm db:test      # pruebas pgTAP (RLS, CHECKs, triggers)
pnpm db:reset     # recrea la base desde cero
pnpm db:types     # regenera packages/types desde el esquema (CI falla si queda desactualizado)
```

Para iniciar sesión con Google en local, copia `supabase/.env.example` a `supabase/.env` con el Client ID y el Secret de tu cliente OAuth, y agrega `http://127.0.0.1:54321/auth/v1/callback` como URI de redirección autorizada en Google Cloud. Los administradores del catálogo se marcan con `app_metadata.role = "admin"` (solo con la service role).

## Estructura

| Ruta                  | Contenido                                                   |
| --------------------- | ----------------------------------------------------------- |
| `apps/web`            | Next.js 16 (App Router), UI y API REST `/api/v1`            |
| `packages/calc`       | Motor de cálculo puro (sin Next, DOM ni red)                |
| `packages/schemas`    | Esquemas Zod compartidos y generación del OpenAPI           |
| `packages/types`      | Tipos generados de Supabase                                 |
| `packages/api-client` | Cliente tipado de `/api/v1`, generado desde el OpenAPI      |
| `supabase`            | Migraciones, seed de desarrollo y pruebas pgTAP             |
| `tests/e2e`           | Playwright: API solo con Bearer (sin cookies) y UI en móvil |

## API

- `GET /api/v1/health`: requiere `Authorization: Bearer <access token de Supabase>` o la cookie de sesión; responde 401 `application/problem+json` sin credenciales.
- `GET /api/v1/meta`: versión del servidor y versión mínima del cliente.
- `GET /api/v1/openapi.json`: contrato OpenAPI 3.1 generado desde los Zod.

Tras cambiar un esquema, regenera el cliente con `pnpm --filter @elacharger/api-client gen` (CI falla si queda desactualizado).

## Comandos

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build
pnpm test:e2e     # levanta `next start` en el puerto 3100; requiere build previo
```

Los commits siguen Conventional Commits (validados por commitlint); una fase por rama.
