# Subir tu proyecto a GitHub (paso a paso)

Ya tienes cuenta en GitHub. Solo sigue el orden.

---

## Paso 1 — Crear un repositorio vacío en GitHub

1. Entra a [github.com](https://github.com) e inicia sesión.
2. Arriba a la derecha: **+** → **New repository**.
3. **Repository name:** por ejemplo `carpita-pos` (el nombre que quieras).
4. Déjalo **público** o **privado** (como prefieras).
5. **No marques** “Add a README” ni .gitignore (ya los tienes en tu carpeta).
6. Pulsa **Create repository**.

GitHub te mostrará una página con una URL. La necesitas en el **Paso 3**.

La URL será algo como:

- `https://github.com/TU_USUARIO/carpita-pos.git`

(Sustituye `TU_USUARIO` y el nombre del repo por los tuyos.)

---

## Paso 2 — Primera subida desde tu Mac (una sola vez)

Abre la app **Terminal** y ejecuta **estos comandos** (cambia la URL por la de tu repo):

```bash
cd "/Users/darling/Documents/SAAS pos"

git init
git add .
git commit -m "Primer commit: Carpita POS"

git branch -M main
git remote add origin https://github.com/TU_USUARIO/carpita-pos.git
git push -u origin main
```

Si GitHub te pide usuario y contraseña: usa tu usuario de GitHub y un **Personal Access Token** (no la contraseña de la web). Cómo crear token: GitHub → **Settings** → **Developer settings** → **Personal access tokens**.

---

## Paso 3 — Cuando cambies algo y quieras guardarlo en la nube

```bash
cd "/Users/darling/Documents/SAAS pos"
git add .
git commit -m "Describe el cambio en una frase"
git push
```

---

## Dónde está la aplicación

Todo lo importante está en la carpeta **`saas-pos`**. Para trabajar en tu Mac:

```bash
cd "/Users/darling/Documents/SAAS pos/saas-pos"
npm install
npm run dev
```

---

## Poner la app en Internet (después de GitHub)

Cuando el código ya esté en GitHub, puedes usar **Vercel** (gratis para empezar): conectas el mismo repositorio y en el proyecto indicas que la carpeta raíz del proyecto es **`saas-pos`**.

Detalle técnico: **`saas-pos/docs/DEPLOY.md`**.
