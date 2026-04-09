/**
 * Referencia: Fu.do (app-v2.fu.do) — POS Angular con i18n, vista de mesas,
 * comandas, pedidos pendientes y cierre/facturación regional.
 *
 * No hay API pública documentada para “copiar” datos sin iniciar sesión.
 * Flujo recomendado (igual que ya usas): exportar desde Fu.do (CSV/XLSX) y
 * volver a generar datos con `npm run import:exports`.
 *
 * @see https://app-v2.fu.do/app/#!/tables
 */

export const FUDO_EXPORT_HINT =
  "Colocá `exports/productos 2.xls` y ejecutá `npm run import:productos` (o `npm run import:exports` con ventas en exports/). Exportá ventas a `exports/` para regenerar histórico y ventas de prueba. Opcional: menú desde markdown con `npm run import:fudo-md`.";
