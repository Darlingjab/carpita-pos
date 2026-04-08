# Subir tu proyecto a GitHub (paso a paso)

Ya tienes cuenta en GitHub. Solo sigue el orden.

### En tu Mac ya está preparado Git

En la carpeta `SAAS pos` ya existe un repositorio Git con **un primer commit** con todo el código (incluida la app en `saas-pos/`).  
Solo te falta: **crear el repo en GitHub** y **conectarlo** con los comandos del Paso 3.

---

## Paso 1 — Crear un repositorio vacío en GitHub

1. Abre **[github.com/new](https://github.com/new)** (o entra a GitHub → **+** → **New repository**).
3. **Repository name:** por ejemplo `carpita-pos` (el nombre que quieras).
4. Déjalo **público** o **privado** (como prefieras).
5. **No marques** “Add a README” ni .gitignore (ya los tienes en tu carpeta).
6. Pulsa **Create repository**.

GitHub te mostrará una página con una URL. La necesitas en el **Paso 3**.

La URL será algo como:

- `https://github.com/TU_USUARIO/carpita-pos.git`

(Sustituye `TU_USUARIO` y el nombre del repo por los tuyos.)

---

## Paso 2 — (Opcional) Si en el futuro clonas el repo en otra computadora

```bash
git clone https://github.com/TU_USUARIO/carpita-pos.git
cd carpita-pos
cd saas-pos && npm install && npm run dev
```

---

## Paso 3 — Conectar tu carpeta con GitHub y subir (haz esto ahora)

Abre la app **Terminal** y ejecuta **solo esto** (sustituye la URL por la que te muestra GitHub al crear el repo):

```bash
cd "/Users/darling/Documents/SAAS pos"

git branch -M main
git remote add origin https://github.com/TU_USUARIO/carpita-pos.git
git push -u origin main
```

Si `git remote add` dice que ya existe un `origin`, usa:

```bash
git remote set-url origin https://github.com/TU_USUARIO/carpita-pos.git
git push -u origin main
```

Si GitHub te pide usuario y contraseña: usa tu usuario de GitHub y un **Personal Access Token** (no la contraseña de la web). Cómo crear token: GitHub → **Settings** → **Developer settings** → **Personal access tokens**.

---

## Paso 4 — Cuando cambies algo y quieras guardarlo en la nube

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
