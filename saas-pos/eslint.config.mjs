import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Reglas experimental estrictas de React Compiler: ruido alto en este demo sin ganancia clara.
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/purity": "off",
      "react-hooks/immutability": "off",
      // Scripts .cjs y datos generados.
      "@typescript-eslint/no-require-imports": "off",
      // Copys en español con comillas y números; escapar todo rompe legibilidad.
      "react/no-unescaped-entities": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Trozos generados por scripts/sync-exports.cjs; ESLint agota memoria en archivos enormes.
    "lib/data/imported-sales-sample-part-*.ts",
  ]),
]);

export default eslintConfig;
