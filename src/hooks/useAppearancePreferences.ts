import { useCallback, useEffect, useState } from "react";
import { DEFAULT_ACCENT_COLOR, normalizeHexColor } from "../utils/color";

export type AppearanceTheme = "system" | "light" | "dark";

export interface AppearancePreferences {
  theme: AppearanceTheme;
  accentColor: string;
  autoUpdate: boolean;
  setTheme: (theme: AppearanceTheme) => void;
  setAccentColor: (color: string) => void;
  setAutoUpdate: (enabled: boolean) => void;
}

const STORAGE_KEY = "clipboard-pro:preferences:v1";

interface StoredPreferences {
  theme?: AppearanceTheme;
  accentColor?: string;
  autoUpdate?: boolean;
}

function loadPreferences(): Required<StoredPreferences> {
  const defaults: Required<StoredPreferences> = {
    theme: "system",
    accentColor: DEFAULT_ACCENT_COLOR,
    autoUpdate: true
  };

  if (typeof window === "undefined") return defaults;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;

    const stored = JSON.parse(raw) as StoredPreferences;
    const theme = ["system", "light", "dark"].includes(stored.theme ?? "")
      ? stored.theme!
      : defaults.theme;
    const accentColor = normalizeHexColor(stored.accentColor ?? "") ?? defaults.accentColor;

    return {
      theme,
      accentColor,
      autoUpdate: stored.autoUpdate ?? defaults.autoUpdate
    };
  } catch {
    return defaults;
  }
}

export function useAppearancePreferences(): AppearancePreferences {
  const [preferences, setPreferences] = useState(loadPreferences);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    } catch {
      // Personalization is non-critical; keep the current in-memory value.
    }
  }, [preferences]);

  const setTheme = useCallback((theme: AppearanceTheme) => {
    setPreferences((current) => ({ ...current, theme }));
  }, []);

  const setAccentColor = useCallback((color: string) => {
    const normalized = normalizeHexColor(color);
    if (!normalized) return;
    setPreferences((current) => ({ ...current, accentColor: normalized }));
  }, []);

  const setAutoUpdate = useCallback((autoUpdate: boolean) => {
    setPreferences((current) => ({ ...current, autoUpdate }));
  }, []);

  return {
    ...preferences,
    setTheme,
    setAccentColor,
    setAutoUpdate
  };
}
