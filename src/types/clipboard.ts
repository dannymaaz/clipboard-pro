export type ClipboardKind = "text" | "url" | "image" | "document";

export type ClipboardView = "history" | "favorites" | "collections";

export interface ClipboardItem {
  id: string;
  title: string | null;
  content: string;
  preview: string;
  thumbnail: string | null;
  kind: ClipboardKind;
  isPinned: boolean;
  isFavorite: boolean;
  createdAt: string;
  updatedAt: string;
  lastUsedAt: string | null;
  collections: string[];
}

export interface Collection {
  id: string;
  name: string;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AppSettings {
  historyLimit: 50 | 100 | 250 | 500;
  shortcut: string;
  theme: "system" | "light" | "dark";
  autoStart: boolean;
}
