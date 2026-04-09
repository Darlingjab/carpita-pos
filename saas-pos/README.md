# Carpita POS · SaaS (Next.js)

Aplicación POS multi-modo: **mostrador**, **mesas (restaurante)**, **cocina (KDS)**, **caja / arqueos**, **clientes y puntos**, **informes**, **admin y equipo**.  
Stack: **Next.js (App Router)**, **TypeScript**, **Tailwind CSS**, datos demo en memoria + esquema **Supabase** listo para cuando conectes BD real.

📌 **Despliegue:** [docs/DEPLOY.md](./docs/DEPLOY.md) · **Arquitectura:** [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) · **Seguridad:** [docs/SECURITY.md](./docs/SECURITY.md)  
📌 **Índice:** [docs/README.md](./docs/README.md) · **Node 20:** [`.nvmrc`](./.nvmrc)

---

## Requisitos

- **Node.js 20+** (recomendado; alinea con imágenes Docker habituales)

---

## Instalación y desarrollo

Siempre desde esta carpeta (`saas-pos`):

```bash
npm install
npm run dev
```

La app queda en **[http://127.0.0.1:3000](http://127.0.0.1:3000)** (puerto 3000; `localhost` también suele funcionar). Ejecutá **`npm run dev` solo desde la carpeta `saas-pos`**. Si el puerto está ocupado, Next avisará: cerrá el otro proceso o matá el PID que indique.

Si ves **404 en todas las rutas** en desarrollo, no vuelvas a poner `turbopack.root` en `next.config.ts` (rompe el mapa de rutas con Turbopack). Los avisos **EMFILE / too many open files** en macOS se pueden aliviar con `ulimit -n 10240` en la misma terminal antes de `npm run dev`.

### Scripts útiles

| Comando | Uso |
|---------|-----|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción |
| `npm run start` | Servidor tras `build` (puerto 3000 por defecto) |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript sin emitir JS |
| `npm run check` | `lint` + `typecheck` |
| `npm run verify` | `check` + `build` (recomendado antes de subir a producción) |
| `npm run import:exports` | Lee `exports/sales_history_5_years_clean.csv` (u otra ruta vía `SALES_CSV_PATH`) y genera `lib/data/*`. Ver comentarios en `.env.example`. |
| `npm run import:exports:full` | Como arriba pero empaqueta todas las ventas en el bundle (muy pesado). |
| `npm run import:productos` | Menú desde `exports/productos 2.xls` → `imported-catalog-menu.ts`. |
| `npm run import:fudo-md` | Menú alternativo desde markdown en `exports/`. |
| `npm run env:setup` | Crea `.env.local` desde `.env.example` (sin sobrescribir si ya existe). |

**Antes de publicar:** `npm run verify` (ver [docs/DEPLOY.md](./docs/DEPLOY.md)).

---

## Autenticación (demo)

- **Admin:** `admin@carpita` / `1234` (acceso amplio)
- **Cajero:** `cajero@carpita` / `1234` (restaurante, ventas, caja)

La sesión usa la cookie **`pos_demo_user`**. Sustituir por sistema real antes de producción pública.

---

## Rutas principales

| Ruta | Descripción |
|------|-------------|
| `/` | Inicio + login (redirige a `/mesas` si ya hay sesión) |
| `/login` | Login pantalla completa |
| `/mesas` | Restaurante: mapa de mesas y pedido |
| `/pos` | POS mostrador |
| `/ventas` | Ventas (incluye arqueos de caja) |
| `/finanzas` | Finanzas (informes y exportaciones) |
| `/cocina` | Pantalla cocina (KDS) |
| `/clientes` | Clientes y recompensas |
| `/products` | Productos (subpestaña inventario) |
| `/gastos` | Gastos |
| `/config` | Ajustes (admin y equipo) |
| `/register` | Redirige a `/ventas?tab=arqueos` |

API bajo `/api/*` (ventas, caja, cocina, clientes, auth, exportaciones CSV/PDF).

---

## Supabase (opcional, producción)

1. Crear proyecto en [Supabase](https://supabase.com/).
2. Ejecutar en el SQL Editor la migración `supabase/migrations/20250408120000_pos_runtime_state.sql` (y el esquema que uses de `supabase/` si aplica).
3. Copiar claves del panel **Settings → API** a `.env.local` (plantilla: **`.env.example`**):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (solo servidor; no la subas al cliente ni a repositorios públicos).

Sin esas variables, la app funciona en **modo demo** (`lib/store.ts` en memoria). Con **service role** configurada, el runtime se sincroniza con la tabla `pos_runtime_state`. Detalle: [docs/DATOS-Y-NUBE.md](./docs/DATOS-Y-NUBE.md).

---

## Estructura de carpetas (resumen)

```
app/           # Rutas App Router + API routes
lib/           # Tipos, mock, store, auth, locale (es), componentes compartidos
public/        # Estáticos (ej. logo)
supabase/      # SQL de esquema y seed
docs/          # DEPLOY, arquitectura, datos en nube, legacy
exports/       # CSV/XLS de importación (no versionar archivos enormes si no hace falta)
```

Arquitectura resumida: [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md).

---

## Workspace padre

Si abriste el repo como carpeta **`SAAS pos`**, la app ejecutable es **`saas-pos/`**. El [README del nivel superior](../README.md) resume el workspace (sin dependencias en la raíz).
