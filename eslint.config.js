import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import pluginImport from "eslint-plugin-import";
import pluginReact from "eslint-plugin-react";
import pluginSortDestructureKeys from "eslint-plugin-sort-destructure-keys";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig([
  // #region Global
  globalIgnores(["src-tauri/*", "*.js"]),
  {
    files: ["**/*.{js,mjs,cjs,ts,jsx,tsx}"],
    plugins: { js },
    extends: ["js/recommended"],
    languageOptions: { globals: globals.browser },
  },
  // #endregion

  // #region TypeScript
  tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ["*.js"],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/member-ordering": [
        "error",
        {
          default: {
            memberTypes: ["field", "constructor", "method"],
            optionalityOrder: "required-first",
            order: "natural",
          },
        },
      ],
      "@typescript-eslint/max-params": "error",
    },
  },
  // #endregion

  // #region React
  pluginReact.configs.flat.recommended,
  pluginReact.configs.flat["jsx-runtime"],
  {
    settings: {
      react: {
        version: "detect",
      },
    },
    rules: {
      "react/jsx-uses-react": "off",
      "react/react-in-jsx-scope": "off",
      "react/jsx-sort-props": [
        "error",
        {
          shorthandLast: true,
          multiline: "last",
          reservedFirst: true,
        },
      ],
    },
  },
  // #endregion

  // #region Sort Destructure Keys
  {
    plugins: {
      "sort-destructure-keys": pluginSortDestructureKeys,
    },
    rules: {
      "sort-destructure-keys/sort-destructure-keys": "error",
    },
  },
  // #endregion

  // #region Import Plugin
  {
    plugins: {
      import: pluginImport,
    },
    settings: {
      "import/resolver": {
        typescript: true,
      },
    },
  },
  // #endregion

  // #region ESLint Rules
  {
    rules: {
      "import/order": [
        "error",
        {
          groups: [
            "builtin",
            "external",
            "internal",
            "parent",
            "sibling",
            "index",
            "object",
            "type",
          ],
          pathGroups: [
            {
              pattern: "react",
              group: "external",
              position: "before",
            },
          ],
          "newlines-between": "always",
          alphabetize: {
            order: "asc",
            caseInsensitive: true,
          },
        },
      ],
      "no-unused-vars": "off",
      "max-params": "off",
      "sort-keys": [
        "error",
        "asc",
        {
          natural: true,
          allowLineSeparatedGroups: true,
        },
      ],
    },
  },
  // #endregion
]);
