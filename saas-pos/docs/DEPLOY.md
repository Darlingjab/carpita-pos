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
| `NEXT_PUBLIC_SUPABASE_URL` | No* (demo en memoria) | Necesaria cuando conectes Supabase real |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | No* | Igual |

\* La demo usa datos en memoria y cookies de sesión mock; para clientes reales debes persistir en BD y endurecer auth.

### HTTPS y cookies

El login demo usa la cookie `pos_demo_user`. En producción debe servirse **solo por HTTPS** y revisar `SameSite` / duración si cambias el flujo de auth.

---

## 4. VPS / Docker con `output: "standalone"`

`next.config.ts` define `output: "standalone"`. Tras `npm run build`:

- El servidor Node está en **`.next/standalone/`** (ejecutar `node server.js` desde esa estructura según la [documentación oficial de Next.js](https://nextjs.org/docs/app/building-your-application/deploying#manual-self-hosting)).
- Debes copiar también **`public/`** y **`.next/static`** al despliegue, o los assets y el logo fallan.

Ejemplo de idea (ajusta rutas en tu `Dockerfile`):

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
```

(Verifica que `server.js` exista en `standalone` y el `WORKDIR` coincida con la doc de tu versión de Next.)

---

## 5. Limitaciones actuales (importante)

- **Vercel / serverless:** cada **instancia** de función puede tener memoria distinta y reinicios en “cold start”. Lo que vive en **`lib/store.ts`** y **`lib/user-accounts.ts`** (memoria de proceso) **no es fiable** en producción multi-instancia: datos pueden desaparecer o no verse entre usuarios. Para uso real en la nube necesitas **base de datos** (p. ej. Supabase) y auth persistente.
- **APIs y sesión**: el **middleware** bloquea `/api/*` sin cookie (respuesta **401** JSON), salvo `POST /api/auth/login` y `POST /api/auth/logout` y peticiones `OPTIONS`. Las rutas siguen validando usuario con `getSessionUserOrNull()` por si la cookie no corresponde a un usuario demo.
- **Ventas por rol**: `GET /api/sales` y exportes con fuente **sesión** limitan al **cajero** a ventas donde es `createdBy` o `serverId`. El histórico **importado** solo exporta quien tenga `reports.read` (p. ej. admin).
- **Datos**: gran parte del negocio vive en **`lib/store.ts`** (memoria de proceso). En un solo **VPS con un proceso Node** los datos duran hasta reiniciar el servicio; en **Vercel** no debes asumir memoria compartida. Para producción: migrar a Supabase u otra BD.
- **Auth**: credenciales demo (`admin@carpita` / `cajero@carpita`). Sustituir por auth real antes de exponer a usuarios finales.
- **Next.js 16**: puede aparecer aviso de deprecación de **`middleware`** a favor de **`proxy`**; planifica migración cuando actualices según la guía de Next.

---

## 6. Checklist rápido el día del go-live

- [ ] `npm run check` y `npm run build` verdes en CI o local
- [ ] Root directory del hosting = **`saas-pos`** si el monorepo tiene capa superior
- [ ] Variables Supabase (si ya no usas solo mock)
- [ ] HTTPS activo
- [ ] Probar login, mesas, venta, cocina y cierre de caja en el dominio final
- [ ] Decisión tomada: **mock vs BD** para no perder datos en el primer reinicio

---

## 7. Referencias internas

- Estructura y desarrollo local: [README.md](../README.md)
- Otros documentos: [docs/README.md](./README.md)
