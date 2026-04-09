# Despliegue en producción (Carpita POS)

Guía para publicar la app Next.js que vive en **`saas-pos/`**.

### Qué necesitas (mínimo)

| Necesitas | Para qué |
|-----------|-----------|
| **Cuenta en Git** (GitHub, GitLab, etc.) | Subir el código y conectarlo al hosting |
| **Vercel** (recomendado) o **VPS** con Node 20 | Alojar la app en Internet con HTTPS |
| **Proyecto en la carpeta correcta** | En Vercel, **Root Directory = `saas-pos`** si tu repo es la carpeta `SAAS pos` que contiene `saas-pos/` |

No hace falta servidor local encendido: la nube ejecuta `npm run build` y sirve la app.

---

## 1. Antes de subir código

En tu máquina (o CI):

```bash
cd saas-pos
npm ci
npm run check    # lint + TypeScript
npm run build
```

Si el build falla por caché: `rm -rf .next` y vuelve a ejecutar `npm run build`.  
Con poca RAM: `NODE_OPTIONS=--max-old-space-size=3072 npm run build`.

---

## 2. Elegir modo de alojamiento

| Opción | Cuándo usarla |
|--------|----------------|
| **Vercel** | Rápido, integración nativa con Next.js, HTTPS y previews |
| **VPS + Docker** (o Node directo) | Control total; usar salida **`standalone`** ya configurada en `next.config.ts` |

---

## 3. Vercel (recomendado para empezar)

1. Sube el repo a GitHub/GitLab/Bitbucket.
2. En Vercel: **New Project** → importa el repo.
3. **Root Directory**: `saas-pos` (si el repo raíz es la carpeta `SAAS pos` que contiene `saas-pos/`).
4. **Build Command**: `npm run build` (por defecto).
5. **Output**: dejar automático (Vercel ignora `output: "standalone"` para su propio runtime).
6. **Install Command**: `npm ci` o `npm install`.

### Variables de entorno (Vercel → Settings → Environment Variables)

| Variable | Obligatoria hoy | Notas |
|----------|-----------------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | No (solo memoria) | Con URL + **service role** activa persistencia en Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | No | Puede seguir vacía si solo usas sync servidor con service role |
| `SUPABASE_SERVICE_ROLE_KEY` | No | **Solo servidor** (Vercel env, nunca en el cliente). Sin ella no hay `pull`/`push` a la tabla `pos_runtime_state` |

**Persistencia en la nube:** ejecuta en el SQL Editor de Supabase el contenido de `supabase/migrations/20250408120000_pos_runtime_state.sql` (crea la tabla y la fila `default`). Con las tres variables anteriores, cada petición autenticada sincroniza ventas, caja, cocina, clientes y usuarios contra esa fila.

**Seguridad:** la *service role* ignora RLS; no la expongas en `NEXT_PUBLIC_*` ni en el navegador.

Sin Supabase configurado, la app sigue en modo demo (memoria de proceso / cold starts en Vercel).

### HTTPS y cookies

El login demo usa la cookie `pos_demo_user`. En producción debe servirse **solo por HTTPS** y revisar `SameSite` / duración si cambias el flujo de auth.

---

## 4. VPS / Docker con `output: "standalone"`

En el repo hay un **`Dockerfile`** listo en la raíz de `saas-pos/` (multi-stage, usuario no root). Desde `saas-pos/`:

```bash
docker build -t carpita-pos .
docker run -p 3000:3000 --env-file .env.production.local carpita-pos
```

`.dockerignore` excluye `node_modules`, `.next`, CSV enormes en `exports/`, etc., para acelerar el contexto.

`next.config.ts` define `output: "standalone"`. Tras `npm run build` sin Docker:

- El servidor Node está en **`.next/standalone/`** (ejecutar `node server.js` según la [documentación oficial de Next.js](https://nextjs.org/docs/app/building-your-application/deploying#manual-self-hosting)).
- Debes copiar también **`public/`** y **`.next/static`** al despliegue manual, o los assets fallan (el `Dockerfile` del repo ya los copia).

### Cabeceras de seguridad

En `next.config.ts` se envían `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` y `Permissions-Policy` en todas las rutas.

---

## 5. Limitaciones actuales (importante)

- **Vercel / serverless:** sin Supabase + `SUPABASE_SERVICE_ROLE_KEY`, cada **instancia** puede tener memoria distinta. Con persistencia activa, el estado vive en **`pos_runtime_state`** y se lee/escribe en cada request relevante (última escritura gana si dos instancias escriben a la vez; para mucha concurrencia conviene evolucionar el modelo).
- **APIs y sesión**: el **middleware** bloquea `/api/*` sin cookie (respuesta **401** JSON), salvo `POST /api/auth/login` y `POST /api/auth/logout` y peticiones `OPTIONS`. Las rutas siguen validando usuario con `getSessionUserOrNull()` por si la cookie no corresponde a un usuario demo.
- **Ventas por rol**: `GET /api/sales` y exportes con fuente **sesión** limitan al **cajero** a ventas donde es `createdBy` o `serverId`. El histórico **importado** solo exporta quien tenga `reports.read` (p. ej. admin).
- **Datos**: con env de Supabase + migración aplicada, el runtime se sincroniza con la nube; sin eso, **`lib/store.ts`** sigue siendo solo memoria de proceso.
- **Auth**: credenciales demo (`admin@carpita` / `cajero@carpita`). Sustituir por auth real antes de exponer a usuarios finales.
- **Next.js 16**: puede aparecer aviso de deprecación de **`middleware`** a favor de **`proxy`**; planifica migración cuando actualices según la guía de Next.

---

## 6. Checklist rápido el día del go-live

- [ ] `npm run verify` (o `npm run check` + `npm run build`) verdes en CI o local
- [ ] Revisión rápida de [SECURITY.md](./SECURITY.md) (secretos y variables)
- [ ] Root directory del hosting = **`saas-pos`** si el monorepo tiene capa superior
- [ ] Variables Supabase (si ya no usas solo mock)
- [ ] HTTPS activo
- [ ] Probar login, mesas, venta, cocina y cierre de caja en el dominio final
- [ ] Decisión tomada: **mock vs BD** para no perder datos en el primer reinicio

---

## 7. Referencias internas

- Estructura y desarrollo local: [README.md](../README.md)
- Otros documentos: [docs/README.md](./README.md)
