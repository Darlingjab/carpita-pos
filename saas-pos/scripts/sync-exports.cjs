/**
 * Lee ventas desde exports/ (prioridad):
 *   1) SALES_CSV_PATH o SALES_XLSX_PATH (ruta absoluta; puede ser CSV de tickets o de líneas)
 *   2) sales_history_5_years_clean.csv / .xlsx (tickets: 1 fila por venta, Id, Total, Creación…)
 *   3) sales_history_5_years_clean copy.csv / .xlsx (mismo formato, nombre antiguo)
 *
 * Con CSV de líneas (ID_VENTA, PRODUCTO, …) solo vía variable de entorno o si el archivo
 * que encuentres tiene ese esquema. Catálogo de menú (prioridad):
 *   exports/productos 2.xls → productos 2.xlsx → PRODUCTOS_LISTOS.xlsx, o PRODUCTOS_XLS_PATH.
 *
 * Por defecto exporta las IMPORT_SALES_SEED_CAP ventas más recientes (stats usan el total).
 *   IMPORT_SALES_SEED_CAP=20000 node scripts/sync-exports.cjs
 * Histórico completo en el bundle:
 *   IMPORT_FULL_SALES=1 node scripts/sync-exports.cjs
 *
 * Las ventas en TS se escriben en N trozos (+ agregador) para no tener un solo archivo gigante:
 *   IMPORT_SALES_SEED_PARTS=5 node scripts/sync-exports.cjs   (por defecto 5)
 *
 * Fechas del CSV sin zona se interpretan como hora local del negocio (no UTC):
 *   IMPORT_SALES_WALL_OFFSET=-05:00 node scripts/sync-exports.cjs   (Ecuador continental; por defecto)
 *
 * Uso: node scripts/sync-exports.cjs
 *
 * Catálogo:
 * - Menú operativo: exports/productos 2.xls (recomendado) → npm run import:productos, o con ventas:
 *   npm run import:exports (si existe el .xls/.xlsx, también escribe imported-catalog-menu.ts).
 *   Alternativa: exports/fudo_products_ai_friendly.md → npm run import:fudo-md.
 * - CSV tickets: imported-catalog-historical.ts (tipos de venta). Si hay productos 2.xls, el menú se
 *   actualiza en la misma corrida; si no, conservá el menú previo o usá import:productos.
 * - CSV líneas: menú desde el .xls si existe; si no, inferido desde columnas del CSV. Histórico vacío.
 */

const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");

const ROOT = path.join(__dirname, "..");
const EXPORT_DIR = path.join(ROOT, "exports");
const OUT_DIR = path.join(ROOT, "lib", "data");

/** Trozos de imported-sales-sample (mismo total de ventas, archivos más manejables). */
const SALES_SEED_PARTS = Math.min(
  20,
  Math.max(1, parseInt(process.env.IMPORT_SALES_SEED_PARTS || "5", 10) || 5),
);

function splitSalesIntoParts(rows, nParts) {
  const n = Math.max(1, nParts);
  if (rows.length === 0) return Array.from({ length: n }, () => []);
  const chunks = Array.from({ length: n }, () => []);
  const base = Math.floor(rows.length / n);
  let rem = rows.length % n;
  let idx = 0;
  for (let i = 0; i < n; i++) {
    const sz = base + (rem > 0 ? 1 : 0);
    if (rem > 0) rem -= 1;
    chunks[i] = rows.slice(idx, idx + sz);
    idx += sz;
  }
  return chunks;
}

const BUSINESS_ID = "biz_imported";
const BUSINESS_NAME = "Negocio (catálogo importado)";
const BUSINESS_TYPE = "restaurant";
const CURRENCY = "USD";

/** ISO 8601 offset para fechas «naïve» del export (hora local del local). */
const IMPORT_WALL_OFFSET = process.env.IMPORT_SALES_WALL_OFFSET || "-05:00";

function pad2(n) {
  const x = Math.floor(Number(n) || 0);
  return String(x).padStart(2, "0");
}

/** Convierte "YYYY-MM-DDTHH:mm:ss" sin Z a instante UTC usando el offset del negocio. */
function naiveLocalDateTimeToUtcIso(isoLikeNoTz) {
  const s = String(isoLikeNoTz || "").trim();
  if (!s) return new Date().toISOString();
  if (/Z$/i.test(s) || /[+-]\d{2}:\d{2}$/.test(s) || /[+-]\d{4}$/.test(s)) {
    const d = new Date(s);
    return Number.isFinite(d.getTime()) ? d.toISOString() : new Date().toISOString();
  }
  const normalized = s.includes("T") ? s : s.replace(/^(\d{4}-\d{2}-\d{2})\s+/, "$1T");
  const d = new Date(normalized + IMPORT_WALL_OFFSET);
  return Number.isFinite(d.getTime()) ? d.toISOString() : new Date().toISOString();
}

function slug(s) {
  return String(s)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase()
    .slice(0, 48);
}

function uniqueSlug(base, used) {
  let id = base;
  let i = 2;
  while (used.has(id)) {
    id = `${base}_${i}`;
    i += 1;
  }
  used.add(id);
  return id;
}

function num(v) {
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function tsString(s) {
  return JSON.stringify(s ?? "");
}

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function normKey(k) {
  return String(k || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Celda por nombre de columna (varias variantes / mayúsculas). */
function getCell(row, ...keys) {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== "") return row[k];
  }
  const rowKeys = Object.keys(row);
  const want = keys.map((k) => normKey(k));
  for (const w of want) {
    const hit = rowKeys.find((x) => normKey(x) === w);
    if (hit && String(row[hit]).trim() !== "") return row[hit];
  }
  return "";
}

function rowsFromFile(filePath) {
  if (filePath.endsWith(".csv")) {
    const csvText = fs.readFileSync(filePath, "utf8");
    const wbS = XLSX.read(csvText, { type: "string", codepage: 65001 });
    return XLSX.utils.sheet_to_json(wbS.Sheets[wbS.SheetNames[0]], { defval: "" });
  }
  const wbS = XLSX.readFile(filePath);
  return XLSX.utils.sheet_to_json(wbS.Sheets[wbS.SheetNames[0]], { defval: "" });
}

function detectSaleExportFormat(rows) {
  if (!rows.length) return "lines";
  const k = Object.keys(rows[0]).map(normKey);
  const has = (name) => k.includes(normKey(name));
  if (has("id_venta") || has("id venta")) return "lines";
  if (has("producto") && (has("cantidad") || has("precio_unitario"))) return "lines";
  if ((has("id") || has("id ")) && has("total") && (has("creacion") || has("creación") || has("cerrada"))) {
    return "tickets";
  }
  return "lines";
}

/** Catálogo de productos para el menú POS (no pisa ventas). */
function resolveCatalogProductsPath() {
  if (process.env.PRODUCTOS_XLS_PATH) {
    const p = process.env.PRODUCTOS_XLS_PATH;
    if (fs.existsSync(p)) return p;
    console.warn(`PRODUCTOS_XLS_PATH no existe: ${p}`);
  }
  const candidates = [
    path.join(EXPORT_DIR, "productos 2.xls"),
    path.join(EXPORT_DIR, "productos 2.xlsx"),
    path.join(EXPORT_DIR, "PRODUCTOS_LISTOS.xlsx"),
  ];
  for (const fp of candidates) {
    if (fs.existsSync(fp)) return fp;
  }
  return null;
}

function writeImportedCatalogMenuTs(categories, products, sourceBasename) {
  const menuTs = `import type { Product, ProductCategory } from "@/lib/types";

/** Menú POS desde ${sourceBasename}. Generado por scripts/sync-exports.cjs / npm run import:productos */
export const importedMenuCategories: ProductCategory[] = ${JSON.stringify(categories, null, 2)};

export const importedMenuProducts: Product[] = ${JSON.stringify(products, null, 2)};
`;
  fs.writeFileSync(path.join(OUT_DIR, "imported-catalog-menu.ts"), menuTs);
}

function productosMenuOnlyMain() {
  ensureDir(OUT_DIR);
  const catalogPath = resolveCatalogProductsPath();
  if (!catalogPath) {
    console.error(
      "No se encontró catálogo: colocá exports/productos 2.xls (o .xlsx / PRODUCTOS_LISTOS.xlsx) o definí PRODUCTOS_XLS_PATH.",
    );
    process.exit(1);
  }
  const built = buildCatalogFromXlsx(catalogPath);
  writeImportedCatalogMenuTs(built.categories, built.products, path.basename(catalogPath));
  console.log(
    `OK (solo menú): ${built.products.length} productos, ${built.categories.length} categorías → lib/data/imported-catalog-menu.ts`,
  );
}

function readSaleExport() {
  const candidates = [];
  if (process.env.SALES_CSV_PATH) candidates.push(process.env.SALES_CSV_PATH);
  if (process.env.SALES_XLSX_PATH) candidates.push(process.env.SALES_XLSX_PATH);
  candidates.push(
    path.join(EXPORT_DIR, "sales_history_5_years_clean.csv"),
    path.join(EXPORT_DIR, "sales_history_5_years_clean.xlsx"),
    path.join(EXPORT_DIR, "sales_history_5_years_clean copy.csv"),
    path.join(EXPORT_DIR, "sales_history_5_years_clean copy.xlsx"),
  );

  for (const filePath of candidates) {
    if (!filePath || !fs.existsSync(filePath)) continue;
    const rows = rowsFromFile(filePath);
    const format = detectSaleExportFormat(rows);
    console.log(`Origen ventas: ${path.basename(filePath)} (${format === "tickets" ? "tickets / cabecera" : "detalle por línea"})`);
    return { format, rows, sourcePath: filePath };
  }
  console.error(
    "No se encontró CSV/XLSX de ventas en exports/ (p. ej. sales_history_5_years_clean.csv) ni SALES_CSV_PATH.",
  );
  process.exit(1);
}

function parseTicketDate(raw) {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    const parts = XLSX.SSF.parse_date_code(raw);
    if (parts && parts.y >= 1990 && parts.y <= 2100) {
      const wall = `${parts.y}-${pad2(parts.m)}-${pad2(parts.d)}T${pad2(parts.H)}:${pad2(parts.M)}:${pad2(parts.S)}`;
      return naiveLocalDateTimeToUtcIso(wall);
    }
  }
  const s = String(raw || "").trim();
  if (!s) return new Date().toISOString();
  if (/^\d+(\.\d+)?$/.test(s)) {
    const n = Number(s);
    if (Number.isFinite(n)) {
      const parts = XLSX.SSF.parse_date_code(n);
      if (parts && parts.y >= 1990 && parts.y <= 2100) {
        const wall = `${parts.y}-${pad2(parts.m)}-${pad2(parts.d)}T${pad2(parts.H)}:${pad2(parts.M)}:${pad2(parts.S)}`;
        return naiveLocalDateTimeToUtcIso(wall);
      }
    }
  }
  const iso = s.includes("T") ? s : s.replace(/^(\d{4}-\d{2}-\d{2})\s+/, "$1T");
  return naiveLocalDateTimeToUtcIso(iso);
}

function mapPaymentFromTicket(medio) {
  const m = String(medio || "").toLowerCase();
  if (m.includes("tarjeta")) return "card";
  if (m.includes("transfer")) return "transfer";
  return "cash";
}

function buildCatalogAndSalesFromTickets(rows) {
  const tipos = new Set();
  for (const r of rows) {
    const t = String(getCell(r, "Tipo de Venta", "Tipo de venta") || "Mostrador").trim() || "Mostrador";
    tipos.add(t);
  }
  const categories = [
    {
      id: "cat_hist_tipos_venta",
      businessId: BUSINESS_ID,
      name: "Histórico — tipo de venta",
      parentId: null,
    },
  ];
  const nameToProductId = new Map();
  const products = [];
  let n = 1;
  for (const t of [...tipos].sort()) {
    const id = `prd_hist_${slug(t) || `t${n}`}`;
    nameToProductId.set(t.toLowerCase(), id);
    products.push({
      id,
      businessId: BUSINESS_ID,
      categoryId: "cat_hist_tipos_venta",
      name: t,
      sku: `HIST-${n}`,
      price: 0,
      isFavorite: false,
      isActive: true,
    });
    n += 1;
  }

  const mesaNums = new Set();
  for (const r of rows) {
    const ms = String(getCell(r, "Mesa") || "").trim();
    const dig = ms.match(/\d+/);
    if (dig) mesaNums.add(Number(dig[0]));
  }
  const tables = [...mesaNums].sort((a, b) => a - b).map((num) => ({
    id: `tbl_mesa_${num}`,
    businessId: BUSINESS_ID,
    label: `Mesa ${num}`,
    seats: 4,
    isActive: true,
  }));

  const salesAll = [];
  for (const r of rows) {
    const id = String(getCell(r, "Id", "ID", "id") || "").trim();
    if (!id) continue;
    const total = num(getCell(r, "Total"));
    if (total <= 0) continue;
    const tipo = String(getCell(r, "Tipo de Venta", "Tipo de venta") || "Mostrador").trim() || "Mostrador";
    const mesaStr = String(getCell(r, "Mesa") || "").trim();
    const camarero = String(
      getCell(r, "Camarero / Repartidor", "Camarero / Repartidor ", "Camarero", "Repartidor") || "",
    ).trim();
    const cliente = String(getCell(r, "Cliente") || "").trim();
    const creacion = getCell(r, "Creación", "Creacion", "Cerrada");
    const createdAt = parseTicketDate(creacion || getCell(r, "Fecha"));

    let channel = "counter";
    let tableId = null;
    const mesaNum = mesaStr.match(/^(\d+)/)?.[1];
    if (mesaNum) {
      channel = "table";
      tableId = `tbl_mesa_${mesaNum}`;
    }

    const pid = nameToProductId.get(tipo.toLowerCase()) || products[0]?.id || "prd_hist_x";
    const label = [tipo, mesaStr ? `Mesa ${mesaStr}` : "", cliente].filter(Boolean).join(" · ").slice(0, 200);

    salesAll.push({
      id: `sale_${id}`,
      businessId: BUSINESS_ID,
      channel,
      tableId,
      items: [
        {
          productId: pid,
          name: label || tipo,
          qty: 1,
          unitPrice: total,
          lineTotal: total,
        },
      ],
      subtotal: total,
      discount: 0,
      total,
      payments: [{ method: mapPaymentFromTicket(getCell(r, "Medio de Pago", "Medio de pago")), amount: total }],
      createdAt,
      createdBy: "usr_imported",
      customerName: cliente || null,
      serverName: camarero || null,
      serverId: camarero ? `srv_${slug(camarero)}` : null,
    });
  }

  salesAll.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return { categories, products, nameToProductId, tables, salesAll };
}

function buildCatalogFromCsv(saleRows) {
  const usedCategorySlugs = new Set();
  const categoryKeys = new Map();
  function catId(parentName) {
    const key = `${parentName}||`;
    if (!categoryKeys.has(key)) {
      const base = `cat_${slug(parentName)}`;
      const id = uniqueSlug(base, usedCategorySlugs);
      categoryKeys.set(key, id);
    }
    return categoryKeys.get(key);
  }

  const categoryNames = new Set();
  for (const r of saleRows) {
    const c = String(r.CATEGORIA || "General").trim() || "General";
    categoryNames.add(c);
  }

  const categories = [];
  for (const name of [...categoryNames].sort()) {
    categories.push({
      id: catId(name),
      businessId: BUSINESS_ID,
      name,
      parentId: null,
    });
  }

  const byKey = new Map();
  for (const r of saleRows) {
    const name = String(r.PRODUCTO || "").trim();
    if (!name) continue;
    const cat = String(r.CATEGORIA || "General").trim() || "General";
    const price = num(r.PRECIO_UNITARIO);
    const k = name.toLowerCase();
    if (!byKey.has(k)) {
      byKey.set(k, { displayName: name, category: cat, prices: [] });
    }
    const o = byKey.get(k);
    if (price > 0) o.prices.push(price);
  }

  const nameToProductId = new Map();
  const products = [];
  let idNum = 1;
  for (const [k, o] of byKey) {
    const id = `prd_${idNum}`;
    nameToProductId.set(k, id);
    const prices = o.prices.sort((a, b) => a - b);
    const med = prices.length ? prices[Math.floor(prices.length / 2)] : 0;
    products.push({
      id,
      businessId: BUSINESS_ID,
      categoryId: catId(o.category),
      name: o.displayName,
      sku: `CSV-${idNum}`,
      price: med,
      isFavorite: false,
      isActive: true,
    });
    idNum += 1;
  }

  return { categories, products, nameToProductId };
}

function buildCatalogFromXlsx(productsPath) {
  const wbP = XLSX.readFile(productsPath);
  const productRows = XLSX.utils.sheet_to_json(wbP.Sheets[wbP.SheetNames[0]], { defval: "" });

  const usedCategorySlugs = new Set();
  const categoryKeys = new Map();
  function catId(parentName, subName) {
    const key = subName ? `${parentName}||${subName}` : `${parentName}||`;
    if (!categoryKeys.has(key)) {
      const base = subName
        ? `cat_${slug(parentName)}__${slug(subName)}`
        : `cat_${slug(parentName)}`;
      const id = uniqueSlug(base, usedCategorySlugs);
      categoryKeys.set(key, id);
    }
    return categoryKeys.get(key);
  }

  const categories = [];
  const parentSeen = new Set();

  for (const r of productRows) {
    const parent = String(
      getCell(r, "Categoría", "Categoria", "Category", "CATEGORIA") || "",
    ).trim();
    if (!parent) continue;
    if (!parentSeen.has(parent)) {
      parentSeen.add(parent);
      categories.push({
        id: catId(parent, ""),
        businessId: BUSINESS_ID,
        name: parent,
        parentId: null,
      });
    }
    const sub = String(
      getCell(r, "Subcategoría", "Subcategoria", "Subcategory", "SUBCATEGORIA") || "",
    ).trim();
    if (sub) {
      const id = catId(parent, sub);
      if (!categories.find((c) => c.id === id)) {
        categories.push({
          id,
          businessId: BUSINESS_ID,
          name: sub,
          parentId: catId(parent, ""),
        });
      }
    }
  }

  const nameToProductId = new Map();
  const products = [];
  let autoNum = 0;

  for (const r of productRows) {
    const parent = String(
      getCell(r, "Categoría", "Categoria", "Category", "CATEGORIA") || "",
    ).trim();
    const sub = String(
      getCell(r, "Subcategoría", "Subcategoria", "Subcategory", "SUBCATEGORIA") || "",
    ).trim();
    const name = String(
      getCell(r, "Nombre", "Name", "Producto", "PRODUCTO", "Descripción", "Descripcion") || "",
    ).trim();
    if (!parent || !name) continue;

    let idRaw = getCell(r, "ID", "Id", "Código", "Codigo", "SKU", "Sku");
    if (idRaw === undefined || idRaw === null || String(idRaw).trim() === "") {
      autoNum += 1;
      idRaw = `xls_${autoNum}`;
    }
    const idNum = String(idRaw).trim().replace(/\s+/g, "_");
    const id = `prd_${idNum}`;
    const categoryId = sub ? catId(parent, sub) : catId(parent, "");
    const active = String(getCell(r, "Activo", "Active", "ACTIVO") || "")
      .trim()
      .toLowerCase();
    const fav = String(getCell(r, "Favorito", "Favorite", "FAVORITO") || "")
      .trim()
      .toLowerCase();
    const priceRaw = getCell(r, "Precio", "Price", "PRECIO", "Valor");

    const product = {
      id,
      businessId: BUSINESS_ID,
      categoryId,
      name,
      sku: `EXP-${idNum}`,
      price: num(priceRaw),
      isFavorite: fav === "si" || fav === "sí" || fav === "yes" || fav === "true" || fav === "1",
      isActive:
        active === "" ||
        active === "si" ||
        active === "sí" ||
        active === "yes" ||
        active === "true" ||
        active === "1",
    };
    products.push(product);
    nameToProductId.set(name.trim().toLowerCase(), id);
  }

  return { categories, products, nameToProductId };
}

function main() {
  if (process.argv.includes("--productos-menu-only")) {
    productosMenuOnlyMain();
    return;
  }

  ensureDir(OUT_DIR);

  const { format, rows: saleRows, sourcePath } = readSaleExport();
  const catalogPath = resolveCatalogProductsPath();

  let categories;
  let products;
  let nameToProductId;
  let tables;
  let salesAll;

  if (format === "tickets") {
    const built = buildCatalogAndSalesFromTickets(saleRows);
    categories = built.categories;
    products = built.products;
    nameToProductId = built.nameToProductId;
    tables = built.tables;
    salesAll = built.salesAll;
    console.log(
      "Histórico por ticket: cada venta es una línea (sin productos detallados). Auditoría agrupa por «tipo de venta».",
    );
  } else {
    if (catalogPath) {
      const built = buildCatalogFromXlsx(catalogPath);
      categories = built.categories;
      products = built.products;
      nameToProductId = built.nameToProductId;
      console.log(`Catálogo menú: ${path.basename(catalogPath)}`);
    } else {
      const built = buildCatalogFromCsv(saleRows);
      categories = built.categories;
      products = built.products;
      nameToProductId = built.nameToProductId;
      console.warn(
        "Sin catálogo XLS (exports/productos 2.xls, etc.) — menú inferido desde columnas del CSV de ventas.",
      );
    }

    const mesaNums = new Set();
    for (const r of saleRows) {
      const tipo = String(r.TIPO || "").trim();
      const m = /^Mesa\s+(\d+)$/i.exec(tipo);
      if (m) mesaNums.add(Number(m[1]));
    }
    const mesaList = [...mesaNums].sort((a, b) => a - b);
    tables = mesaList.map((n) => ({
      id: `tbl_mesa_${n}`,
      businessId: BUSINESS_ID,
      label: `Mesa ${n}`,
      seats: 4,
      isActive: true,
    }));

    const bySale = new Map();
    for (const r of saleRows) {
      const vid = String(r.ID_VENTA);
      if (!bySale.has(vid)) bySale.set(vid, []);
      bySale.get(vid).push(r);
    }

    salesAll = [];
    for (const [vid, lines] of bySale) {
      const first = lines[0];
      const tipo = String(first.TIPO || "").trim();

      let channel = "counter";
      let tableId = null;
      const mm = /^Mesa\s+(\d+)$/i.exec(tipo);
      if (mm) {
        channel = "table";
        tableId = `tbl_mesa_${mm[1]}`;
      }

      const items = lines.map((line) => {
        const pname = String(line.PRODUCTO || "").trim();
        const pid =
          nameToProductId.get(pname.toLowerCase()) || `legacy_${slug(pname).replace(/_/g, "") || "x"}_${vid}`;
        return {
          productId: pid,
          name: pname,
          qty: num(line.CANTIDAD),
          unitPrice: num(line.PRECIO_UNITARIO),
          lineTotal: num(line.SUBTOTAL_ITEM),
        };
      });

      const subtotal = items.reduce((a, it) => a + it.lineTotal, 0);
      const total = subtotal;

      salesAll.push({
        id: `sale_${vid}`,
        businessId: BUSINESS_ID,
        channel,
        tableId,
        items,
        subtotal,
        discount: 0,
        total,
        payments: [{ method: "cash", amount: total }],
        createdAt: parseTicketDate(first.FECHA),
        createdBy: "usr_imported",
        __mesero: String(first.MESERO || "").trim(),
      });
    }

    salesAll.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  const full = process.env.IMPORT_FULL_SALES === "1";
  const capEnv = process.env.IMPORT_SALES_SEED_CAP;
  const capParsed = capEnv ? parseInt(capEnv, 10) : NaN;
  const defaultCap = format === "tickets" && !capEnv && !full ? 75000 : 20000;
  const cap = Number.isFinite(capParsed) && capParsed > 0 ? capParsed : defaultCap;

  const recentSales = full ? salesAll : salesAll.slice(0, cap);

  if (recentSales.length < salesAll.length) {
    console.warn(
      `Semilla POS: ${recentSales.length} de ${salesAll.length} ventas (las más recientes). Stats usan el total. IMPORT_FULL_SALES=1 para empaquetar todas (archivo enorme).`,
    );
  }

  let totalRevenue = 0;
  const productQty = new Map();
  const productRev = new Map();
  const monthRev = new Map();
  /** Por mes: totales del documento de ventas (para Arqueos → historial mensual importado). */
  const monthRegister = new Map();

  for (const s of salesAll) {
    totalRevenue += s.total;
    const d = new Date(s.createdAt);
    const ym = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    monthRev.set(ym, (monthRev.get(ym) || 0) + s.total);

    let reg = monthRegister.get(ym);
    if (!reg) {
      reg = { tickets: 0, revenue: 0, cash: 0, card: 0, transfer: 0 };
      monthRegister.set(ym, reg);
    }
    reg.tickets += 1;
    reg.revenue += s.total;
    for (const p of s.payments || []) {
      const a = Math.max(0, Number(p.amount) || 0);
      if (p.method === "cash") reg.cash += a;
      else if (p.method === "card") reg.card += a;
      else if (p.method === "transfer") reg.transfer += a;
    }

    for (const it of s.items) {
      const key = it.name;
      productQty.set(key, (productQty.get(key) || 0) + it.qty);
      productRev.set(key, (productRev.get(key) || 0) + it.lineTotal);
    }
  }

  const topByQty = [...productQty.entries()]
    .map(([name, qty]) => ({ name, qty, revenue: productRev.get(name) || 0 }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 15);

  const dateFrom = salesAll.length > 0 ? salesAll[salesAll.length - 1].createdAt : "";
  const dateTo = salesAll.length > 0 ? salesAll[0].createdAt : "";

  const businessTs = `import type { Business } from "@/lib/types";

export const importedBusinessId = ${tsString(BUSINESS_ID)};

export const importedBusiness: Business = {
  id: importedBusinessId,
  name: ${tsString(BUSINESS_NAME)},
  type: ${tsString(BUSINESS_TYPE)},
  currency: ${tsString(CURRENCY)},
};
`;

  const historicalTs = `import type { Product, ProductCategory } from "@/lib/types";

/** Tipos de venta del CSV (tickets). Generado por scripts/sync-exports.cjs */
export const importedHistoricalCategories: ProductCategory[] = ${JSON.stringify(format === "tickets" ? categories : [], null, 2)};

export const importedHistoricalProducts: Product[] = ${JSON.stringify(format === "tickets" ? products : [], null, 2)};
`;

  fs.writeFileSync(path.join(OUT_DIR, "imported-catalog-historical.ts"), historicalTs);

  if (format !== "tickets") {
    const menuLabel = catalogPath ? path.basename(catalogPath) : "CSV de líneas (inferido)";
    writeImportedCatalogMenuTs(categories, products, menuLabel);
    console.log(
      `imported-catalog-menu.ts: ${products.length} productos; histórico vacío (imported-catalog-historical.ts).`,
    );
  } else if (catalogPath) {
    const menuBuilt = buildCatalogFromXlsx(catalogPath);
    writeImportedCatalogMenuTs(
      menuBuilt.categories,
      menuBuilt.products,
      path.basename(catalogPath),
    );
    console.log(
      `Menú ${path.basename(catalogPath)}: ${menuBuilt.products.length} productos → imported-catalog-menu.ts (histórico: tipos de venta en imported-catalog-historical.ts).`,
    );
  } else {
    console.log(
      `Histórico tickets: ${products.length} tipos de venta → imported-catalog-historical.ts (menú sin cambios: usá npm run import:productos si agregás exports/productos 2.xls).`,
    );
  }

  const tablesTs = `import type { DiningTable } from "@/lib/types";

export const importedTables: DiningTable[] = ${JSON.stringify(tables, null, 2)};
`;

  const salesForExport = recentSales.map((row) => {
    const rest = { ...row };
    delete rest.__mesero;
    return rest;
  });

  const salesChunks = splitSalesIntoParts(salesForExport, SALES_SEED_PARTS);
  for (const f of fs.readdirSync(OUT_DIR)) {
    if (f.startsWith("imported-sales-sample-part-") && f.endsWith(".ts")) {
      fs.unlinkSync(path.join(OUT_DIR, f));
    }
  }
  for (let i = 0; i < SALES_SEED_PARTS; i++) {
    const slice = salesChunks[i] || [];
    const partTs = `// @ts-nocheck — generado por scripts/sync-exports.cjs (parte ${i + 1}/${SALES_SEED_PARTS})
import type { Sale } from "@/lib/types";

export const importedSalesSeedPart${i + 1} = ${JSON.stringify(slice, null, 2)} as Sale[];
`;
    fs.writeFileSync(path.join(OUT_DIR, `imported-sales-sample-part-${i + 1}.ts`), partTs);
  }

  const importLines = Array.from(
    { length: SALES_SEED_PARTS },
    (_, j) => `import { importedSalesSeedPart${j + 1} } from "./imported-sales-sample-part-${j + 1}";`,
  ).join("\n");
  const spreadLines = Array.from(
    { length: SALES_SEED_PARTS },
    (_, j) => `  ...importedSalesSeedPart${j + 1},`,
  ).join("\n");
  const salesTs = `/**
 * Agregador de ventas importadas (${SALES_SEED_PARTS} trozos). Generado por scripts/sync-exports.cjs.
 * No editar a mano.
 */
import type { Sale } from "@/lib/types";
${importLines}

export const importedSalesSeed: Sale[] = [
${spreadLines}
];
`;

  const stats = {
    source: `exports/${path.basename(sourcePath)}`,
    transactionCount: salesAll.length,
    exportedSaleCount: recentSales.length,
    totalRevenue,
    dateFrom,
    dateTo,
    revenueByMonth: Object.fromEntries([...monthRev.entries()].sort(([a], [b]) => a.localeCompare(b))),
    registerMonthlyFromImport: Object.fromEntries(
      [...monthRegister.entries()].sort(([a], [b]) => a.localeCompare(b)),
    ),
    topProductsByQty: topByQty,
  };

  const statsTs = `export const importedSalesStats = ${JSON.stringify(stats, null, 2)} as const;
`;

  fs.writeFileSync(path.join(OUT_DIR, "imported-business.ts"), businessTs);
  fs.writeFileSync(path.join(OUT_DIR, "imported-tables.ts"), tablesTs);
  fs.writeFileSync(path.join(OUT_DIR, "imported-sales-sample.ts"), salesTs);
  fs.writeFileSync(path.join(OUT_DIR, "imported-sales-stats.ts"), statsTs);

  let partsBytes = 0;
  for (let i = 0; i < SALES_SEED_PARTS; i++) {
    const p = path.join(OUT_DIR, `imported-sales-sample-part-${i + 1}.ts`);
    if (fs.existsSync(p)) partsBytes += Buffer.byteLength(fs.readFileSync(p, "utf8"), "utf8");
  }
  console.log(
    `OK: ${products.length} productos, ${categories.length} categorías, ${tables.length} mesas, ${salesAll.length} ventas únicas, ${recentSales.length} en TS en ${SALES_SEED_PARTS} partes (~${(partsBytes / 1024 / 1024).toFixed(2)} MB datos + agregador).`,
  );
}

main();
