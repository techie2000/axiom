import { FlatCompat } from "@eslint/eslintrc";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// NOTE: eslint-config-next is intentionally pinned to 15.x (see .github/dependabot.yml).
// eslint-config-next 16.x exports flat-config objects which cause a circular JSON
// reference in @eslint/eslintrc's ConfigValidator when used via FlatCompat.
// Before upgrading, verify that the new version ships a legacy-compatible export,
// or migrate this config away from FlatCompat (compat.extends -> direct flat config).
const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const config = [
  { ignores: ['coverage/**', '.next/**'] },
  ...compat.extends("next/core-web-vitals", "plugin:jsx-a11y/recommended"),
  {
    rules: {
      "jsx-a11y/alt-text": "error",
      "jsx-a11y/aria-props": "error",
      "jsx-a11y/aria-proptypes": "error",
      "jsx-a11y/aria-role": "error",
      "jsx-a11y/aria-unsupported-elements": "error",
      "jsx-a11y/interactive-supports-focus": "warn",
      "jsx-a11y/label-has-associated-control": ["error", { assert: "nesting", depth: 3 }],
      "jsx-a11y/no-noninteractive-element-interactions": "warn",
      "jsx-a11y/no-redundant-roles": "error",
      "jsx-a11y/role-has-required-aria-props": "error",
      "jsx-a11y/role-supports-aria-props": "error",
    },
  },
];

export default config;
