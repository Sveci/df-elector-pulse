import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "node_modules", "src/integrations/supabase/types.ts", "tailwind.config.ts", "postcss.config.js"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      // ── React Hooks (prevent stale closures / missing deps) ────────────────
      ...reactHooks.configs.recommended.rules,

      // ── React Refresh (HMR safety) ─────────────────────────────────────────
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],

      // ── TypeScript: enforce meaningful patterns ────────────────────────────
      // Keep no-explicit-any as warn (not error) — large codebase migration
      "@typescript-eslint/no-explicit-any": "warn",
      // Unused vars: warn (common in large codebases)
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { vars: "all", args: "after-used", ignoreRestSiblings: true, argsIgnorePattern: "^_" },
      ],
      // Prefer const where possible
      "prefer-const": "warn",
      // No var declarations
      "no-var": "error",
      // Consistent === over ==
      "eqeqeq": ["warn", "always", { null: "ignore" }],
      // No console.log in production code (warn so we can clean incrementally)
      "no-console": ["warn", { allow: ["warn", "error"] }],
      // TypeScript: no non-null assertion on function calls
      "@typescript-eslint/no-non-null-assertion": "warn",
      // No unused TS directives
      "@typescript-eslint/no-unused-expressions": "warn",
      // Switch fall-through is already caught by tsconfig
      "no-fallthrough": "error",
      // React Hook rules (always error — these are real runtime bugs)
      // Downgrade legacy escape/empty issues to warn to avoid blocking CI on pre-existing code
      "no-useless-escape": "warn",
      "no-empty": "warn",
      "@typescript-eslint/ban-ts-comment": "warn",
      "@typescript-eslint/no-empty-object-type": "warn",
      "no-control-regex": "warn",
      "prefer-spread": "warn",
    },
  },
);
