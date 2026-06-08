import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        accent: {
          DEFAULT: "rgb(var(--accent-rgb) / <alpha-value>)",
          soft: "rgb(var(--accent-rgb) / 0.14)"
        }
      },
      boxShadow: {
        panel: "0 18px 60px rgb(15 23 42 / 0.18)"
      }
    }
  },
  plugins: []
} satisfies Config;
