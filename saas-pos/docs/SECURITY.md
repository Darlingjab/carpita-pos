# Seguridad (checklist)

## Secretos

- **Nunca** subas `.env.local` ni `SUPABASE_SERVICE_ROLE_KEY` a Git (están en `.gitignore`; usá `.env.example` solo como plantilla).
- En Vercel u otro hosting, marca las variables **service role** como solo entorno servidor.
- Rotá claves si alguna vez se filtraron (p. ej. en un commit o issue público).

## App

- Cabeceras HTTP duras en `next.config.ts` (`nosniff`, `X-Frame-Options`, etc.).
- Las rutas `/api/*` exigen cookie de sesión salvo login/logout (`middleware.ts`).
- Sustituí el **login demo** antes de exponer la app a clientes reales.

## Supabase

- La **service role** ignora RLS: usala solo en el servidor Next, no en el navegador.
- Ejecutá migraciones desde `supabase/migrations/` en un proyecto dedicado por entorno (staging / producción).

## Build / CI

- Comando recomendado antes de publicar: `npm run verify` (lint + types + build).
