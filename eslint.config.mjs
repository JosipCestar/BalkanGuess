import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });
const config = [js.configs.recommended, ...compat.extends("next/core-web-vitals"), { ignores: [".next/**", ".next-dev/**", "node_modules/**", "prisma/generated/**"] }, { files: ["**/*.{ts,tsx}"], rules: { "no-undef": "off", "no-unused-vars": "off" } }];
export default config;
