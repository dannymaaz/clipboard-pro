export const DEFAULT_ACCENT_COLOR = "#2563EB";

export const ACCENT_PRESETS = [
  { name: "Azul", value: "#2563EB" },
  { name: "Indigo", value: "#4F46E5" },
  { name: "Violeta", value: "#7C3AED" },
  { name: "Magenta", value: "#C026D3" },
  { name: "Rosa", value: "#E11D48" },
  { name: "Rojo", value: "#DC2626" },
  { name: "Coral", value: "#EA580C" },
  { name: "Dorado", value: "#CA8A04" },
  { name: "Esmeralda", value: "#059669" },
  { name: "Turquesa", value: "#0D9488" },
  { name: "Cian", value: "#0891B2" },
  { name: "Grafito", value: "#475569" }
] as const;

export function normalizeHexColor(value: string): string | null {
  const normalized = value.trim().toUpperCase();
  const withHash = normalized.startsWith("#") ? normalized : `#${normalized}`;

  if (!/^#[0-9A-F]{6}$/.test(withHash)) return null;
  return withHash;
}

export function hexToRgbChannels(value: string | undefined): string {
  const normalized = normalizeHexColor(value ?? DEFAULT_ACCENT_COLOR) ?? DEFAULT_ACCENT_COLOR;
  const red = Number.parseInt(normalized.slice(1, 3), 16);
  const green = Number.parseInt(normalized.slice(3, 5), 16);
  const blue = Number.parseInt(normalized.slice(5, 7), 16);
  return `${red} ${green} ${blue}`;
}
