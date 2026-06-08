import { useEffect } from "react";
import type { AppSettings } from "../types/clipboard";

export function useSystemTheme(theme: AppSettings["theme"] | undefined) {
  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia("(prefers-color-scheme: dark)");

    const applyTheme = () => {
      const shouldUseDark = theme === "dark" || (theme !== "light" && media.matches);
      root.classList.toggle("dark", shouldUseDark);
      root.style.setProperty("--accent-rgb", "37 99 235");
    };

    applyTheme();
    media.addEventListener("change", applyTheme);
    return () => media.removeEventListener("change", applyTheme);
  }, [theme]);
}
