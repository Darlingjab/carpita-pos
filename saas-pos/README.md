# Carpita POS · SaaS (Next.js)

Aplicación POS multi-modo: **mostrador**, **mesas (restaurante)**, **cocina (KDS)**, **caja / arqueos**, **clientes y puntos**, **informes**, **admin y equipo**.  
Stack: **Next.js (App Router)**, **TypeScript**, **Tailwind CSS**, datos demo en memoria + esquema **Supabase** listo para cuando conectes BD real.

📌 **Documentación de despliegue:** [docs/DEPLOY.md](./docs/DEPLOY.md)  
📌 **Índice de docs:** [docs/README.md](./docs/README.md)

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

La terminal mostrará la URL (típicamente [http://localhost:3000](http://localhost:3000)). Si el puerto 3000 está ocupado, Next usará otro (3001, …): usa exactamente la que indique el log.

### Scripts útiles

| Comando | Uso |
|---------|-----|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción |
| `npm run start` | Servidor tras `build` (puerto 3000 por defecto) |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript sin emitir JS |
| `npm run check` | `lint` + `typecheck` |
| `npm run import:exports` | Regenera datos desde CSV en `exports/` |

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
2. Ejecutar SQL: `supabase/schema.sql` y luego `supabase/seed.sql` si aplica.
3. Variables de entorno:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

Hoy buena parte del flujo demo usa **`lib/mock-data.ts`** y **`lib/store.ts`** (memoria); conectar la app a Supabase requiere trabajo adicional de capa de datos.

---

## Estructura de carpetas (resumen)

```
app/           # Rutas App Router + API routes
lib/           # Tipos, mock, store, auth, locale (es), componentes compartidos
public/        # Estáticos (ej. logo)
supabase/      # SQL de esquema y seed
docs/          # DEPLOY, arquitectura, legacy
exports/       # CSV de importación (Fu.do / históricos) para scripts
```

---

## Workspace padre

Si abriste el repo como carpeta **`SAAS pos`**, la app ejecutable es **`saas-pos/`**. El [README del nivel superior](../README.md) resume el workspace (sin dependencias en la raíz).
