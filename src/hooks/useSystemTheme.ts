import { useEffect } from "react";
import type { AppSettings } from "../types/clipboard";

export const accentRgb: Record<NonNullable<AppSettings["accent"]>, string> = {
  blue: "37 99 235",
  indigo: "79 70 229",
  violet: "124 58 237",
  fuchsia: "192 38 211",
  rose: "225 29 72",
  red: "220 38 38",
  orange: "234 88 12",
  amber: "217 119 6",
  green: "22 163 74",
  emerald: "5 150 105",
  teal: "13 148 136",
  cyan: "8 145 178"
};

export const accentOptions = Object.keys(accentRgb) as Array<NonNullable<AppSettings["accent"]>>;

export function useSystemTheme(theme: AppSettings["theme"] | undefined, accent: AppSettings["accent"] | undefined) {
  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia("(prefers-color-scheme: dark)");

    const applyTheme = () => {
      const shouldUseDark = theme === "dark" || (theme !== "light" && media.matches);
      root.classList.toggle("dark", shouldUseDark);
      root.style.setProperty("--accent-rgb", accentRgb[accent ?? "blue"]);
      root.style.setProperty("--accent-strong-rgb", accentRgb[accent ?? "blue"]);
    };

    applyTheme();
    media.addEventListener("change", applyTheme);
    return () => media.removeEventListener("change", applyTheme);
  }, [accent, theme]);
}
