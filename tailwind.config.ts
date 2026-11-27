import type { Config } from "tailwindcss";

const shades = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
const scale = (name: string) => Object.fromEntries(shades.map((s) => [s, `rgb(var(--${name}-${s}) / <alpha-value>)`]));

export default {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)"],
      },
      colors: {
        brand: scale("brand"),
        slate: scale("slate"),
      },
      boxShadow: {
        card: "0 1px 2px 0 rgb(15 23 42 / 0.04), 0 1px 3px 0 rgb(15 23 42 / 0.06)",
        soft: "0 4px 20px -4px rgb(15 23 42 / 0.10)",
        pop: "0 10px 40px -10px rgb(15 23 42 / 0.25)",
      },
    },
  },
  plugins: [],
} satisfies Config;
