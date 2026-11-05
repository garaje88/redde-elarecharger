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

## Catálogo de vehículos y cargadores

```bash
# Importa Open EV Data, EPA y Open Charge Map al Supabase indicado (local o remoto).
SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_SERVICE_ROLE_KEY=<secret key de `supabase status`> pnpm catalog:import
pnpm catalog:import open-ev-data   # solo una fuente: open-ev-data, epa u ocm
```

- Las reimportaciones actualizan por `source_ref` y nunca pisan un campo cuya fuente sea `"manual"`.
- El workflow `Catalog sync` lo corre cada lunes si existen los secretos `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`.
- «No encuentro mi carro» busca la ficha en la web con Claude si `ANTHROPIC_API_KEY` está definida (modelo en `AI_MODEL_EXTRACTION`, límite diario en `AI_DAILY_LIMIT_EXTRACTIONS`). Sin llave, la búsqueda queda registrada y el usuario completa la ficha. Los aportes quedan `pending` hasta que un administrador los verifica.

## Trayectos y mapa

- `ORS_API_KEY` (gratuita en openrouteservice.org) activa rutas con elevación, búsqueda de direcciones y nombres de puntos en `/trip`. El servidor la usa detrás de `/api/v1/routing/*`, con caché de 24 h por par A→B redondeado y límite de 30 rutas/min y 300/día por usuario.
- `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN` (opcionales) hacen que ese límite se comparta entre instancias; sin ellos se lleva en memoria.
- `NEXT_PUBLIC_MAP_STYLE_URL` (opcional, p. ej. MapTiler) cambia el estilo del mapa; por defecto usa OpenFreeMap, sin llave.
- Las pruebas E2E usan un OpenRouteService simulado (`tests/e2e/mocks/ors-server.mjs`) y las unitarias, MSW; ninguna llama al servicio real.

## Motor de cálculo

```bash
pnpm calc:demo                              # escenarios de carga y trayecto con resultados en tablas
pnpm --filter @elacharger/calc test         # pruebas y cobertura (incluye los 6 casos del PLAN)
```

Edita los escenarios en `packages/calc/scripts/demo.ts` (vehículo, voltaje, amperaje, %, tarifa, segmentos con subida y bajada) y vuelve a correr el demo.

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

Las pruebas E2E con sesión (garaje, API con Bearer) crean un usuario de prueba en Supabase local sin pasar por Google: agrega `E2E_SUPABASE_SECRET_KEY` (la secret key de `supabase status`) a `apps/web/.env.local`. Sin ella se omiten.

Los commits siguen Conventional Commits (validados por commitlint); una fase por rama.
