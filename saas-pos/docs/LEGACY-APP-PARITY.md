# Paridad con la SPA anterior (Vite + React + Firebase)

→ Índice: [docs/README.md](./README.md) · App actual: [README.md](../README.md)

## Qué es el “legacy”

**Legacy** fue una SPA con **Vite + React + Firebase** (Auth, Firestore, etc.) donde estaban las pantallas originales (mesas, cobro, cocina, caja, etc.). **El código de ese proyecto ya no está en el repo**; solo queda esta nota como referencia de diseño y paridad.

**`saas-pos`** es la app actual en **Next.js (App Router)** (esquema Supabase opcional en `supabase/`), con look alineado (tokens tipo Fudo, barra naranja) y rutas equivalentes donde está portado.

Contexto: [CODIGO-ORIGEN-LEGACY.md](./CODIGO-ORIGEN-LEGACY.md).

**Diferencia importante con el legacy en la barra superior:** la pestaña **“Cobro”** del header viejo enlazaba al POS; aquí **ya no está en el nav** (menos ruido en la barra). El POS sigue en **`/pos`** y se llega desde **inicio**, **Restaurante/mesas** (mesa → cobro) y enlaces en **Ventas** (“Cobro / POS”).

---

## Lista de problemas del código anterior (para implementar bien después)

### Conexión y datos

1. **Firebase siempre activo aunque `STANDALONE_LOCAL === true`**  
   `AuthContext` y `OrderContext` siguen suscritos a `onSnapshot` / `setDoc`. Si las reglas o la config fallan, errores en consola y coste innecesario.

2. **`persistProducts` + `setDoc` sin manejo de error**  
   Si Firestore falla, el estado local y la nube se desincronizan sin feedback al usuario.

3. **`updateCloud` y sync batch (`httpsCallable`)**  
   Depende de Functions desplegadas y red; fallos silenciosos o `alert` genéricos.

4. **`fetch('/products.json')` en producción**  
   Ruta relativa al host; en despliegues mal configurados el catálogo queda vacío.

5. **IDs de negocio hardcodeados** (`moroscarpita`, etc.)  
   Dificulta multi-local real.

### UI / React

6. **Mutación de estado durante el render** (`ProductosView` con `prevKey` / refs)  
   Patrón frágil; puede provocar advertencias de React y comportamiento impredecible.

7. **`window.innerWidth` dentro del render** (`AppHeader` para ocultar nombre)  
   No se re-renderiza al redimensionar hasta otro estado.

8. **Pull-to-refresh → `window.location.reload()`**  
   Pérdida de estado en memoria y mala UX en PWA.

9. **`useNavigate` dentro de `AuthProvider`**  
   Acopla el contexto al router; en tests o SSR es problemático.

### Impresión y permisos

10. **CSS `@media print` muy agresivo** (`body * { display: none }`)  
    Rompe si el selector no coincide exactamente con el área imprimible.

11. **`RequireRole` + permisos mezclados con “standalone: todos ven todo”**  
    Incoherencia entre UI y reglas reales.

### Offline

12. **`OfflineSyncService` + IndexedDB**  
    Colas de ventas pendientes sin reconciliación clara ante conflictos o doble envío.

---

## Mapa módulo legacy → ruta en `saas-pos`

| Legacy (tab / ruta) | Nueva ruta |
|---------------------|------------|
| Mesas / croquis | `/mesas` |
| Productos (admin categorías) | `/products` |
| Punto de venta / OrderPanel | `/pos` |
| Ventas (subpestañas) | `/ventas` |
| Gastos | `/gastos` |
| Finanzas / Owner | `/finanzas` |
| Inventario | `/inventario` |
| Clientes | `/clientes` |
| Cocina KDS | `/cocina` |
| Caja / arqueo | `/register` |
| Informes | `/reports` |
| Administración | `/config` |
| Equipo | `/equipo` |
| Auditoría | `/auditoria` |
| Control / Master | `/control` (stub) |

---

## Qué está implementado vs pendiente

- **Hecho:** barra superior alineada con el legacy **salvo Cobro** (orden: Restaurante, Ventas, Gastos, Finanzas, Inventario, Productos, Clientes, Cocina, Caja, Informes, Admin, Equipo, Auditoría); mesas con plano; POS en `/pos` (fuera del nav); productos admin; caja; informes; **hub Ventas** con subpestañas; gastos en `localStorage`; finanzas con KPI desde import; config impresión local; equipo mock; stubs cocina/clientes/auditoría/control; **CSS global** alineado con `index.css` del legacy.
- **Pendiente (conectar bien):** Supabase en lugar de Firebase, sync offline robusto, OrderPanel completo (comandas, cocina, pagos split), impresión térmica, WhatsApp, PDF reportes, auditoría real, inventario con stock.
