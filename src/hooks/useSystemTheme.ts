import { useEffect } from "react";
import { DEFAULT_ACCENT_COLOR, hexToRgbChannels } from "../utils/color";
import type { AppearanceTheme } from "./useAppearancePreferences";

export function useSystemTheme(
  theme: AppearanceTheme | undefined,
  accentColor: string | undefined
) {
  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia("(prefers-color-scheme: dark)");

    const applyTheme = () => {
      const shouldUseDark = theme === "dark" || (theme !== "light" && media.matches);
      root.classList.toggle("dark", shouldUseDark);
      root.style.setProperty(
        "--accent-rgb",
        hexToRgbChannels(accentColor ?? DEFAULT_ACCENT_COLOR)
      );
    };

    applyTheme();
    media.addEventListener("change", applyTheme);
    return () => media.removeEventListener("change", applyTheme);
  }, [accentColor, theme]);
}
