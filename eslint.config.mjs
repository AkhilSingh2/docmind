import nextConfig from "eslint-config-next";

const config = [
  ...nextConfig,
  {
    ignores: [".next/**", "node_modules/**", "playwright-report/**", "test-results/**", "coverage/**"],
  },
];

export default config;
