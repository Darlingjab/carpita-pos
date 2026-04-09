# Poner el POS en Internet (desde GitHub)

Tu código ya está en GitHub. Para abrirlo **desde cualquier computadora con Internet** usa **Vercel** (gratis para empezar y va muy bien con Next.js).

---

## Paso 1 — Entrar a Vercel con tu GitHub

1. Abre **[vercel.com](https://vercel.com)**.
2. Pulsa **Sign Up** (registrarse) o **Log In**.
3. Elige **Continue with GitHub** y autoriza a Vercel a ver tus repositorios.

---

## Paso 2 — Crear el proyecto desde tu repo

1. En el panel de Vercel: **Add New…** → **Project**.
2. Busca el repositorio **`carpita-pos`** (o como lo hayas llamado) y pulsa **Import**.
3. **Muy importante — ajustar la carpeta raíz:**
   - En **Root Directory**, pulsa **Edit**.
   - Escribe **`saas-pos`** (es la carpeta donde está el `package.json` de Next.js).
   - Confirma / **Continue**.

4. Deja el resto como está (Framework: Next.js, Build: `npm run build`, Install: `npm install`).
5. Pulsa **Deploy** y espera 1–3 minutos.

---

## Paso 3 — Abrir el POS desde otra PC

Cuando termine el deploy, Vercel te muestra un enlace tipo:

`https://carpita-pos-xxx.vercel.app`

Ese es tu POS en Internet. Desde **cualquier navegador** (otra laptop, celular, etc.) entras ahí.

**Inicio de sesión demo (igual que en tu Mac):**

- Admin: **`admin@carpita`** / **`1234`**
- Cajero: **`cajero@carpita`** / **`1234`**

---

## Si algo falla

- **Build error:** revisa que **Root Directory** sea exactamente **`saas-pos`**.
- **Página en blanco:** abre la consola del navegador (F12) o prueba en ventana privada.

---

## Qué debes saber (breve)

En la nube el servidor **no es tu Mac**: lo que guarda el POS hoy en **memoria** puede **reiniciarse**. **No** es lo mismo que “todo queda guardado en la nube para siempre”. Para eso hace falta **base de datos** (p. ej. Supabase).

Lectura clara en español: **`saas-pos/docs/DATOS-Y-NUBE.md`**.  
Más técnico: **`saas-pos/docs/DEPLOY.md`**.
