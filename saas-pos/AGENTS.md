# Guía para asistentes (Cursor / agentes)

## Proyecto activo

- **Raíz del código desplegable:** esta carpeta `saas-pos/` (no el `package.json` suelto del directorio padre `SAAS pos`).
- Antes de cambiar convenciones de Next.js en esta versión, revisa la documentación empaquetada en `node_modules/next` y los avisos de deprecación (p. ej. migración `middleware` → `proxy` en Next 16+).

## Documentación humana

| Archivo | Contenido |
|---------|-----------|
| [docs/README.md](./docs/README.md) | Índice de documentos |
| [docs/DEPLOY.md](./docs/DEPLOY.md) | Publicación: Vercel, standalone, variables, checklist |
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | Capas: UI, API, store, Supabase |
| [README.md](./README.md) | Desarrollo local, rutas, scripts |

## Calidad antes de entregar

- `npm run verify` (lint + TypeScript + build de producción)
- O por pasos: `npm run check` y `npm run build`

## Contexto histórico

- Hubo una SPA anterior (Vite + Firebase); el código legacy ya no está en este repo. Notas: [docs/CODIGO-ORIGEN-LEGACY.md](./docs/CODIGO-ORIGEN-LEGACY.md).
