import tseslint from "typescript-eslint";

// ESLint — Finance V2 (Phase 0) da qo'shildi.
//
// Qamrov ATAYLAB tor: `npm run lint` faqat moliya domeni, testlar va V2
// skriptlarini tekshiradi (package.json'dagi yo'llar). Butun loyihani birdan
// lint qilish yuzlab eski ogohlantirish chiqarib, boshqa dasturchining ishi
// bilan to'qnashardi. Qamrov phase'lar davomida kengaytiriladi.
//
// `next build` lint ishlatmaydi (next.config: eslint.ignoreDuringBuilds) —
// gate faqat CI'dagi `npm run lint`.
export default tseslint.config(
  {
    ignores: ["node_modules/**", ".next/**", ".next-build/**", "android/**", "public/**", "tests/.tmp/**"],
  },
  ...tseslint.configs.recommended,
  {
    files: ["**/*.ts", "**/*.tsx", "**/*.mjs"],
    rules: {
      // Pul bilan ishlaydigan kodda `any` — yashirin xato manbai
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "no-console": ["error", { allow: ["warn", "error"] }],
      eqeqeq: ["error", "always"],
    },
  },
  {
    // Skriptlar terminalga yozadi — console.log ularda me'yor
    files: ["scripts/**"],
    rules: { "no-console": "off" },
  },
);
