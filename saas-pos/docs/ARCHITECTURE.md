# Arquitectura (resumen)

Aplicación **monolito Next.js** (App Router): las páginas y las **API routes** viven en el mismo proceso o en funciones serverless según el hosting.

## Capas

| Capa | Ubicación | Rol |
|------|-----------|-----|
| **UI** | `app/(dashboard)/*`, `lib/components/*` | Pantallas POS, mesas, ventas, finanzas, etc. |
| **API** | `app/api/*` | JSON para ventas, caja, cocina, clientes, auth, exportaciones |
| **Estado demo** | `lib/store.ts` | Memoria de proceso: ventas recientes, movimientos de caja, tickets cocina |
| **Datos seed** | `lib/mock-data.ts`, `lib/data/imported-*` | Catálogo y ventas históricas generadas por scripts desde `exports/` |
| **Persistencia opcional** | `lib/cloud-sync.ts`, `lib/supabase/*` | Si hay `SUPABASE_SERVICE_ROLE_KEY`, el estado demo se guarda en `pos_runtime_state` |
| **Auth demo** | `lib/auth.ts`, `middleware.ts`, cookie `pos_demo_user` | Login fijo; sustituir en producción real |

## Flujo típico

1. El usuario inicia sesión → cookie → `middleware` deja pasar rutas protegidas.
2. El POS cobra → `POST /api/sales` → `lib/store` + opcional push a Supabase.
3. Los informes mezclan **ventas en memoria** + **histórico importado** (`lib/sales-merge.ts`).

## Importación de datos

- Scripts en `scripts/` (Node + `xlsx`) escriben TypeScript en `lib/data/` (`npm run import:exports`, `import:productos`, etc.).
- No se ejecutan en Vercel en cada request: corren en local o CI antes del deploy si querés empaquetar un catálogo fijo.

## Escalado futuro

- Sustituir `store` en memoria por tablas Supabase/Postgres por entidad.
- Auth real (Supabase Auth, Clerk, etc.) y eliminar credenciales demo.
- Si el tráfico API crece, extraer servicios a workers o colas según necesidad.

Más detalle de despliegue: [DEPLOY.md](./DEPLOY.md). Datos en nube vs memoria: [DATOS-Y-NUBE.md](./DATOS-Y-NUBE.md).
