// Lint config for shared packages. apps/web has its own config with the Next.js rules.
import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig([
  globalIgnores([
    "**/node_modules/**",
    "playwright-report/**",
    "test-results/**",
    "**/dist/**",
    "**/coverage/**",
    "apps/**",
    "**/*.d.ts",
  ]),
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
  {
    // Plain Node scripts (test mocks, configs).
    files: ["**/*.mjs"],
    languageOptions: { globals: globals.node },
  },
]);
