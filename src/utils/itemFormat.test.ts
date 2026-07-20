import { describe, expect, it } from "vitest";
import { getItemSubtitle, getItemTitle } from "./itemFormat";
import type { ClipboardItem } from "../types/clipboard";

const item: ClipboardItem = {
  id: "item",
  title: null,
  content: "https://github.com/dannymaaz/clipboard-pro",
  preview: "github.com/dannymaaz/clipboard-pro",
  thumbnail: null,
  kind: "url",
  isPinned: false,
  isFavorite: false,
  createdAt: "2026-07-20T00:00:00.000Z",
  updatedAt: "2026-07-20T00:00:00.000Z",
  lastUsedAt: null,
  collections: []
};

describe("clipboard item formatting", () => {
  it("uses the explicit title and keeps the source as a subtitle", () => {
    const renamed = { ...item, title: "Repositorio Clipboard Pro" };
    expect(getItemTitle(renamed)).toBe("Repositorio Clipboard Pro");
    expect(getItemSubtitle(renamed)).toBe("github.com/dannymaaz/clipboard-pro");
  });

  it("uses the preview when an item has no title", () => {
    expect(getItemTitle(item)).toBe("github.com/dannymaaz/clipboard-pro");
  });
});
