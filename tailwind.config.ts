import type { Config } from "tailwindcss";

export default {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)"],
      },
      colors: {
        brand: {
          50: "#eef3ff",
          100: "#e0e9ff",
          200: "#c7d7ff",
          300: "#a4bcff",
          400: "#7d97ff",
          500: "#5b6ffb",
          600: "#4148ef",
          700: "#3536d4",
          800: "#2d2eac",
          900: "#2a2d88",
          950: "#1a1b52",
        },
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
