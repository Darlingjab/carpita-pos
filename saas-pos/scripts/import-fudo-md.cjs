/**
 * Genera lib/data/imported-catalog-menu.ts desde un markdown «AI-friendly» (Fu.do / listas).
 *
 * Colocá el archivo en exports/fudo_products_ai_friendly.md (o FUDO_PRODUCTS_MD=/ruta).
 *
 * Formato:
 *   ## Categoría principal
 *   ### Subcategoría (opcional)
 *   - Nombre del plato | 12.50 | SKU-001 | 4.50
 *   (costo opcional; si falta, 0)
 *
 * También tablas Markdown:
 *   | Nombre | Precio | SKU |
 *   | Ceviche | 10 | CEV-1 |
 *
 * Uso: node scripts/import-fudo-md.cjs
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const EXPORT_DIR = path.join(ROOT, "exports");
const OUT_DIR = path.join(ROOT, "lib", "data");
const DEFAULT_MD = path.join(EXPORT_DIR, "fudo_products_ai_friendly.md");
const BUSINESS_ID = "biz_imported";

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

function parsePrice(raw) {
  const s = String(raw ?? "")
    .replace(/\$/g, "")
    .replace(/€/g, "")
    .replace(/\s/g, "")
    .replace(",", ".");
  const n = parseFloat(s);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function parseMarkdown(content) {
  const lines = content.split(/\r?\n/);
  const usedCat = new Set();
  const categories = [];
  const products = [];
  let parentCatId = null;
  let currentCatId = null;
  let prodIdx = 1;
  let inTable = false;
  let tableColMap = null;

  function ensureCategory(name, parentId) {
    const pslug = parentId ? slug(categories.find((c) => c.id === parentId)?.name || "grp") : "";
    const base = parentId ? `cat_fudo_${pslug}_${slug(name)}` : `cat_fudo_${slug(name)}`;
    const id = uniqueSlug(base, usedCat);
    categories.push({
      id,
      businessId: BUSINESS_ID,
      name: name.trim(),
      parentId,
    });
    return id;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const t = line.trim();
    if (!t || t.startsWith("<!--")) continue;

    if (t.startsWith("|") && t.includes("---")) {
      inTable = false;
      tableColMap = null;
      continue;
    }

    if (t.startsWith("|") && !t.startsWith("|--")) {
      const cells = t
        .split("|")
        .map((c) => c.trim())
        .filter(Boolean);
      if (!inTable) {
        inTable = true;
        const lower = cells.map((c) => c.toLowerCase());
        tableColMap = {
          name: lower.findIndex((c) => /nombre|producto|item|plato/.test(c)),
          price: lower.findIndex((c) => /precio|price|valor/.test(c)),
          sku: lower.findIndex((c) => /sku|c[oó]digo|code/.test(c)),
          cost: lower.findIndex((c) => /costo|cost/.test(c)),
        };
        if (tableColMap.name < 0) tableColMap.name = 0;
        if (tableColMap.price < 0) tableColMap.price = 1;
        if (tableColMap.sku < 0) tableColMap.sku = 2;
        continue;
      }
      const name = cells[tableColMap.name] ?? cells[0];
      if (!name || /^nombre$/i.test(name)) continue;
      const price = parsePrice(cells[tableColMap.price] ?? "0");
      const sku = (cells[tableColMap.sku] ?? `FUDO-${prodIdx}`).trim() || `FUDO-${prodIdx}`;
      const cost = tableColMap.cost >= 0 ? parsePrice(cells[tableColMap.cost] ?? "0") : 0;
      const catId = currentCatId || parentCatId || ensureCategory("General", null);
      if (!currentCatId && !parentCatId) currentCatId = catId;
      products.push({
        id: `prd_fudo_${prodIdx}`,
        businessId: BUSINESS_ID,
        categoryId: catId,
        name: name.trim(),
        sku,
        price,
        isFavorite: false,
        isActive: true,
        ...(cost > 0 ? { cost } : {}),
      });
      prodIdx += 1;
      continue;
    }

    inTable = false;
    tableColMap = null;

    if (/^#{2}\s+/.test(t)) {
      parentCatId = ensureCategory(t.replace(/^#{2}\s+/, "").trim(), null);
      currentCatId = parentCatId;
      continue;
    }
    if (/^#{3}\s+/.test(t)) {
      if (!parentCatId) parentCatId = ensureCategory("General", null);
      currentCatId = ensureCategory(t.replace(/^#{3}\s+/, "").trim(), parentCatId);
      continue;
    }

    if (/^[-*]\s+/.test(t)) {
      const body = t.replace(/^[-*]\s+/, "");
      const parts = body.split("|").map((p) => p.trim());
      const name = parts[0];
      if (!name) continue;
      if (!parentCatId && !currentCatId) {
        parentCatId = ensureCategory("General", null);
        currentCatId = parentCatId;
      }
      const price = parsePrice(parts[1] ?? "0");
      const sku = (parts[2] ?? `FUDO-${prodIdx}`).trim() || `FUDO-${prodIdx}`;
      const cost = parts[3] != null ? parsePrice(parts[3]) : 0;
      const catId = currentCatId || parentCatId;
      products.push({
        id: `prd_fudo_${prodIdx}`,
        businessId: BUSINESS_ID,
        categoryId: catId,
        name: name.trim(),
        sku,
        price,
        isFavorite: false,
        isActive: true,
        ...(cost > 0 ? { cost } : {}),
      });
      prodIdx += 1;
    }
  }

  return { categories, products };
}

function main() {
  const mdPath = process.env.FUDO_PRODUCTS_MD || DEFAULT_MD;
  ensureDir(OUT_DIR);
  if (!fs.existsSync(mdPath)) {
    console.error(`No existe ${mdPath}. Creá el archivo o definí FUDO_PRODUCTS_MD.`);
    process.exit(1);
  }
  const raw = fs.readFileSync(mdPath, "utf8");
  const { categories, products } = parseMarkdown(raw);
  if (products.length === 0) {
    console.error("No se encontraron productos en el markdown (usá ## categoría y líneas - producto | precio | sku).");
    process.exit(1);
  }

  const ts = `import type { Product, ProductCategory } from "@/lib/types";

/** Menú desde exports/fudo_products_ai_friendly.md — generado por scripts/import-fudo-md.cjs */
export const importedMenuCategories: ProductCategory[] = ${JSON.stringify(categories, null, 2)};

export const importedMenuProducts: Product[] = ${JSON.stringify(products, null, 2)};
`;
  fs.writeFileSync(path.join(OUT_DIR, "imported-catalog-menu.ts"), ts);
  console.log(`OK: ${categories.length} categorías, ${products.length} productos → lib/data/imported-catalog-menu.ts`);
}

main();
