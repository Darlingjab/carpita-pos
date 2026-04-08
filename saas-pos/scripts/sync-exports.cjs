/**
 * Lee exports/PRODUCTOS_LISTOS.xlsx y exports/VENTAS_DETALLADAS_HISTORICAS.csv
 * y genera TypeScript embebido en lib/data/ para el POS.
 *
 * Uso: node scripts/sync-exports.cjs
 */

const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");

const ROOT = path.join(__dirname, "..");
const EXPORT_DIR = path.join(ROOT, "exports");
const OUT_DIR = path.join(ROOT, "lib", "data");

const BUSINESS_ID = "biz_imported";
const BUSINESS_NAME = "Negocio (catálogo importado)";
const BUSINESS_TYPE = "restaurant";
const CURRENCY = "USD";
const RECENT_SALES_LIMIT = 500;

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

function main() {
  const productsPath = path.join(EXPORT_DIR, "PRODUCTOS_LISTOS.xlsx");
  const salesPath = path.join(EXPORT_DIR, "VENTAS_DETALLADAS_HISTORICAS.csv");

  if (!fs.existsSync(productsPath)) {
    console.error("Falta", productsPath);
    process.exit(1);
  }
  if (!fs.existsSync(salesPath)) {
    console.error("Falta", salesPath);
    process.exit(1);
  }

  ensureDir(OUT_DIR);

  /** ----- Catálogo ----- */
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
    const parent = String(r["Categoría"] || "").trim();
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
    const sub = String(r["Subcategoría"] || "").trim();
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

  for (const r of productRows) {
    const parent = String(r["Categoría"] || "").trim();
    const sub = String(r["Subcategoría"] || "").trim();
    const name = String(r["Nombre"] || "").trim();
    if (!parent || !name) continue;

    const idNum = r["ID"];
    const id = `prd_${idNum}`;
    const categoryId = sub ? catId(parent, sub) : catId(parent, "");
    const active = String(r["Activo"] || "")
      .trim()
      .toLowerCase();
    const fav = String(r["Favorito"] || "")
      .trim()
      .toLowerCase();

    const product = {
      id,
      businessId: BUSINESS_ID,
      categoryId,
      name,
      sku: `EXP-${idNum}`,
      price: num(r["Precio"]),
      isFavorite: fav === "si" || fav === "sí" || fav === "yes" || fav === "true",
      isActive: active === "si" || active === "sí" || active === "yes" || active === "true",
    };
    products.push(product);
    nameToProductId.set(name.trim().toLowerCase(), id);
  }

  /** ----- Mesas desde ventas ----- */
  const csvText = fs.readFileSync(salesPath, "utf8");
  const wbS = XLSX.read(csvText, { type: "string", codepage: 65001 });
  const saleRows = XLSX.utils.sheet_to_json(wbS.Sheets[wbS.SheetNames[0]], { defval: "" });

  const mesaNums = new Set();
  for (const r of saleRows) {
    const tipo = String(r.TIPO || "").trim();
    const m = /^Mesa\s+(\d+)$/i.exec(tipo);
    if (m) mesaNums.add(Number(m[1]));
  }
  const mesaList = [...mesaNums].sort((a, b) => a - b);
  const tables = mesaList.map((n) => ({
    id: `tbl_mesa_${n}`,
    businessId: BUSINESS_ID,
    label: `Mesa ${n}`,
    seats: n <= 10 ? 4 : 4,
    isActive: true,
  }));

  /** ----- Ventas agrupadas ----- */
  const bySale = new Map();
  for (const r of saleRows) {
    const vid = String(r.ID_VENTA);
    if (!bySale.has(vid)) bySale.set(vid, []);
    bySale.get(vid).push(r);
  }

  const salesAll = [];
  for (const [vid, lines] of bySale) {
    const first = lines[0];
    const fecha = String(first.FECHA || "").trim();
    const tipo = String(first.TIPO || "").trim();
    const mesero = String(first.MESERO || "").trim();

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
      createdAt: fecha.includes("T") ? fecha : new Date(fecha).toISOString(),
      createdBy: "usr_imported",
      __mesero: mesero,
    });
  }

  salesAll.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const recentSales = salesAll.slice(0, RECENT_SALES_LIMIT);

  /** ----- Estadísticas históricas (todas las ventas) ----- */
  let totalRevenue = 0;
  const productQty = new Map();
  const productRev = new Map();
  const monthRev = new Map();

  for (const s of salesAll) {
    totalRevenue += s.total;
    const d = new Date(s.createdAt);
    const ym = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    monthRev.set(ym, (monthRev.get(ym) || 0) + s.total);
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

  const dateFrom =
    salesAll.length > 0 ? salesAll[salesAll.length - 1].createdAt : "";
  const dateTo = salesAll.length > 0 ? salesAll[0].createdAt : "";

  /** ----- Escribir archivos ----- */
  const businessTs = `import type { Business } from "@/lib/types";

export const importedBusinessId = ${tsString(BUSINESS_ID)};

export const importedBusiness: Business = {
  id: importedBusinessId,
  name: ${tsString(BUSINESS_NAME)},
  type: ${tsString(BUSINESS_TYPE)},
  currency: ${tsString(CURRENCY)},
};
`;

  const catalogTs = `import type { Product, ProductCategory } from "@/lib/types";

export const importedCategories: ProductCategory[] = ${JSON.stringify(categories, null, 2)};

export const importedProducts: Product[] = ${JSON.stringify(products, null, 2)};
`;

  const tablesTs = `import type { DiningTable } from "@/lib/types";

export const importedTables: DiningTable[] = ${JSON.stringify(tables, null, 2)};
`;

  const salesForExport = recentSales.map((row) => {
    const rest = { ...row };
    delete rest.__mesero;
    return rest;
  });
  let salesTs = `import type { Sale } from "@/lib/types";

export const importedSalesSeed: Sale[] = ${JSON.stringify(salesForExport, null, 2)};
`;

  const stats = {
    source: "exports/VENTAS_DETALLADAS_HISTORICAS.csv",
    transactionCount: salesAll.length,
    recentLoadedCount: recentSales.length,
    totalRevenue,
    dateFrom,
    dateTo,
    revenueByMonth: Object.fromEntries(
      [...monthRev.entries()].sort(([a], [b]) => a.localeCompare(b)),
    ),
    topProductsByQty: topByQty,
  };

  let statsTs = `export const importedSalesStats = ${JSON.stringify(stats, null, 2)} as const;
`;

  fs.writeFileSync(path.join(OUT_DIR, "imported-business.ts"), businessTs);
  fs.writeFileSync(path.join(OUT_DIR, "imported-catalog.ts"), catalogTs);
  fs.writeFileSync(path.join(OUT_DIR, "imported-tables.ts"), tablesTs);
  fs.writeFileSync(path.join(OUT_DIR, "imported-sales-sample.ts"), salesTs);
  fs.writeFileSync(path.join(OUT_DIR, "imported-sales-stats.ts"), statsTs);

  console.log(
    `OK: ${products.length} productos, ${categories.length} categorías, ${tables.length} mesas, ${salesAll.length} ventas (semilla reciente: ${recentSales.length}).`,
  );
}

main();
