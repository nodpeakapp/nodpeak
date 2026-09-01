// eslint-config-next 16 ships native flat configs, so no FlatCompat bridge —
// running the legacy shareable config through @eslint/eslintrc throws on the
// plugin object's circular references.
import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

const config = [
  { ignores: [".next/**", "node_modules/**", "public/widget.js", "next-env.d.ts"] },
  ...coreWebVitals,
  ...typescript,
];

export default config;
