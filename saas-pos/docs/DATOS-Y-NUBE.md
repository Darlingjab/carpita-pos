# ¿Mis ventas y datos quedan guardados en la nube?

## Cómo está la app **hoy**

| Dónde vive el dato | ¿Se guarda “en la nube” de forma fiable? |
|--------------------|------------------------------------------|
| **Ventas nuevas, caja, cocina, clientes** (lo que haces en el POS después de desplegar) | **No de forma fiable** si solo usas el código actual en **Vercel**. Eso va a **memoria del servidor** (`lib/store.ts`). Cada reinicio o otra “máquina” de Vercel puede **dejar los datos como al principio**. |
| **Catálogo y ventas históricas de importación** (archivos en `lib/data/imported-*.ts` generados desde CSV/Excel) | **Sí en el sentido de que van en el código** que subes a Git y se despliega: esos datos **sí vuelven** cada vez que publicas una nueva versión. Pero **no** son “lo que el cajero acaba de cargar hoy” guardado en base de datos. |
| **Usuarios demo** (`lib/user-accounts.ts`) | Igual: **memoria** en el servidor → **no persistentes** entre reinicios en serverless. |

**Conclusión honesta:** con el despliegue actual en Vercel **no puedes estar seguro** de que “todo lo que ingreso queda para siempre en la nube”. Para eso hace falta **base de datos real** (por ejemplo **Supabase**, que ya tiene esquema de arranque en `supabase/`).

---

## Cómo **sabrás** que sí queda guardado (cuando esté bien hecho)

Tendrás **persistencia real** cuando:

1. Cada venta / movimiento se **escriba en una base de datos** (filas en PostgreSQL, Supabase, etc.), no solo en variables en memoria.
2. Puedas **ver los mismos datos** después de:
   - cerrar el navegador,
   - entrar desde **otro dispositivo**,
   - y **después de un nuevo deploy** en Vercel.
3. (Opcional pero recomendable) Tengas **copias de seguridad** o exportaciones desde el panel del proveedor de BD.

Mientras no exista ese guardado en BD, **no hay forma técnicamente correcta** de prometer que “todo lo que ingreso va a la nube y no se reinicia”.

---

## Qué falta en el proyecto para lograrlo

- Conectar las rutas API y el flujo del POS a **Supabase** (o otra BD) en lugar de `lib/store.ts` / memoria.
- Autenticación acorde (por ejemplo Supabase Auth) en lugar de solo la cookie demo.
- El archivo `supabase/schema.sql` es un **punto de partida**; el **cableado en código** es trabajo adicional.

Eso es desarrollo a medida; no está terminado solo por subir el repo a GitHub o Vercel.

---

## Resumen en una frase

**Hoy:** GitHub + Vercel = app **online**, pero **no** garantizan que cada venta quede guardada para siempre.  
**Para garantizarlo:** datos en **base de datos en la nube** + app leyendo/escribiendo ahí.

Si más adelante quieres priorizar “todo persistente”, el siguiente paso técnico es **implementar la capa Supabase (u otra BD)** sobre el esquema que ya tienes en `supabase/`.
