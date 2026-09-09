import js from "@eslint/js";
import nextVitals from "eslint-config-next/core-web-vitals";

const config = [js.configs.recommended, ...nextVitals, { ignores: [".next/**", ".next-dev/**", ".railway/**", ".vinext/**", ".wrangler/**", "dist/**", "node_modules/**", "prisma/generated/**", "worker-configuration.d.ts"] }, { files: ["**/*.{ts,tsx}"], rules: { "no-undef": "off", "no-unused-vars": "off", "react-hooks/set-state-in-effect": "off" } }];
export default config;
