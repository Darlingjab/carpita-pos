# Carpita POS (workspace)

**La aplicación que despliegas en línea está solo en [`saas-pos/`](./saas-pos/).** Ahí están `package.json`, Next.js, APIs y todo lo necesario.

### Desarrollo local

```bash
cd saas-pos
npm install
npm run dev
```

### Publicar en la nube

Guía paso a paso (Vercel, Docker/VPS, variables, checklist): **[`saas-pos/docs/DEPLOY.md`](./saas-pos/docs/DEPLOY.md)**  
Antes de desplegar, en `saas-pos/`: **`npm run verify`** (lint + TypeScript + build).  
Índice de documentación: **[`saas-pos/docs/README.md`](./saas-pos/docs/README.md)**

> El `package.json` de esta raíz solo documenta el workspace; **no** ejecutes `npm install` aquí para correr el POS.
