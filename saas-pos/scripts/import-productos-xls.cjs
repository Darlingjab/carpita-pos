#!/usr/bin/env node
/**
 * Regenera solo lib/data/imported-catalog-menu.ts desde exports/productos 2.xls
 * (o PRODUCTOS_XLS_PATH). No requiere CSV de ventas.
 */
const { spawnSync } = require("child_process");
const path = require("path");

const script = path.join(__dirname, "sync-exports.cjs");
const cwd = path.join(__dirname, "..");
const r = spawnSync(process.execPath, [script, "--productos-menu-only"], {
  cwd,
  stdio: "inherit",
});
process.exit(r.status === null ? 1 : r.status);
