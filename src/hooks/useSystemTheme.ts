import { useEffect } from "react";
import type { AppSettings } from "../types/clipboard";

const accentRgb: Record<NonNullable<AppSettings["accent"]>, string> = {
  blue: "37 99 235",
  violet: "124 58 237",
  green: "22 163 74",
  orange: "234 88 12",
  rose: "225 29 72"
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
    };

    applyTheme();
    media.addEventListener("change", applyTheme);
    return () => media.removeEventListener("change", applyTheme);
  }, [accent, theme]);
}
