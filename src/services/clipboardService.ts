import { invoke } from "@tauri-apps/api/core";
import type { AppSettings, ClipboardItem, Collection } from "../types/clipboard";

const isTauri =
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in (window as Window & { __TAURI_INTERNALS__?: unknown });

let mockItems: ClipboardItem[] = [
  {
    id: "prompt-master",
    title: "Prompt Maestro",
    content: "Actua como un experto y ayudame a estructurar esta idea con claridad.",
    preview: "Actua como un experto y ayudame a estructurar esta idea...",
    kind: "text",
    isPinned: true,
    isFavorite: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastUsedAt: null,
    collections: ["prompts"]
  },
  {
    id: "github-url",
    title: "Repositorio Backend",
    content: "https://github.com/user/backend",
    preview: "github.com/user/backend",
    kind: "url",
    isPinned: false,
    isFavorite: false,
    createdAt: new Date(Date.now() - 120000).toISOString(),
    updatedAt: new Date(Date.now() - 120000).toISOString(),
    lastUsedAt: null,
    collections: ["urls"]
  },
  {
    id: "email-signature",
    title: "Firma Correo",
    content: "Saludos,\nDanny",
    preview: "Saludos, Danny",
    kind: "text",
    isPinned: true,
    isFavorite: false,
    createdAt: new Date(Date.now() - 240000).toISOString(),
    updatedAt: new Date(Date.now() - 240000).toISOString(),
    lastUsedAt: null,
    collections: []
  }
];

let mockCollections: Collection[] = [
  {
    id: "prompts",
    name: "Prompts",
    itemCount: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "urls",
    name: "URLs",
    itemCount: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

const mockSettings: AppSettings = {
  historyLimit: 50,
  shortcut: "Ctrl+Alt+V",
  theme: "system"
};

const mockService = {
  listItems: async () => mockItems,
  searchItems: async (query: string) => {
    const normalized = query.toLowerCase();
    return mockItems.filter((item) =>
      [item.title, item.content, item.preview].filter(Boolean).some((value) => value!.toLowerCase().includes(normalized))
    );
  },
  createTextItem: async (content: string) => {
    const item: ClipboardItem = {
      id: crypto.randomUUID(),
      title: null,
      content,
      preview: content.slice(0, 140),
      kind: content.startsWith("http") ? "url" : "text",
      isPinned: false,
      isFavorite: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastUsedAt: null,
      collections: []
    };
    mockItems = [item, ...mockItems];
    return item;
  },
  copyItem: async (id: string) => {
    const item = mockItems.find((candidate) => candidate.id === id);
    if (item && navigator.clipboard) await navigator.clipboard.writeText(item.content);
  },
  renameItem: async (id: string, title: string) => updateMockItem(id, { title }),
  editTextItem: async (id: string, content: string) => updateMockItem(id, { content, preview: content.slice(0, 140) }),
  deleteItem: async (id: string) => {
    mockItems = mockItems.filter((item) => item.id !== id);
  },
  togglePin: async (id: string) => {
    const item = mockItems.find((candidate) => candidate.id === id);
    return updateMockItem(id, { isPinned: !item?.isPinned });
  },
  toggleFavorite: async (id: string) => {
    const item = mockItems.find((candidate) => candidate.id === id);
    return updateMockItem(id, { isFavorite: !item?.isFavorite });
  },
  listCollections: async () => mockCollections,
  createCollection: async (name: string) => {
    const collection: Collection = {
      id: crypto.randomUUID(),
      name,
      itemCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    mockCollections = [collection, ...mockCollections];
    return collection;
  },
  renameCollection: async (id: string, name: string) => {
    mockCollections = mockCollections.map((collection) => (collection.id === id ? { ...collection, name } : collection));
    return mockCollections.find((collection) => collection.id === id)!;
  },
  deleteCollection: async (id: string) => {
    mockCollections = mockCollections.filter((collection) => collection.id !== id);
  },
  addToCollection: async (itemId: string, collectionId: string) => {
    const item = mockItems.find((candidate) => candidate.id === itemId);
    const collections = item?.collections.includes(collectionId)
      ? item.collections
      : [...(item?.collections ?? []), collectionId];
    return updateMockItem(itemId, { collections });
  },
  removeFromCollection: async (itemId: string, collectionId: string) => {
    const item = mockItems.find((candidate) => candidate.id === itemId);
    return updateMockItem(itemId, { collections: item?.collections.filter((id) => id !== collectionId) ?? [] });
  },
  getSettings: async () => mockSettings,
  updateHistoryLimit: async (historyLimit: AppSettings["historyLimit"]) => ({ ...mockSettings, historyLimit })
};

function updateMockItem(id: string, patch: Partial<ClipboardItem>) {
  mockItems = mockItems.map((item) =>
    item.id === id ? { ...item, ...patch, updatedAt: new Date().toISOString() } : item
  );
  const item = mockItems.find((candidate) => candidate.id === id);
  if (!item) throw new Error("Clipboard item not found");
  return item;
}

export const clipboardService = {
  listItems: () => (isTauri ? invoke<ClipboardItem[]>("list_items") : mockService.listItems()),
  searchItems: (query: string) => (isTauri ? invoke<ClipboardItem[]>("search_items", { query }) : mockService.searchItems(query)),
  createTextItem: (content: string) => (isTauri ? invoke<ClipboardItem>("create_text_item", { content }) : mockService.createTextItem(content)),
  copyItem: (id: string) => (isTauri ? invoke<void>("copy_item", { id }) : mockService.copyItem(id)),
  renameItem: (id: string, title: string) => (isTauri ? invoke<ClipboardItem>("rename_item", { id, title }) : mockService.renameItem(id, title)),
  editTextItem: (id: string, content: string) =>
    isTauri ? invoke<ClipboardItem>("edit_text_item", { id, content }) : mockService.editTextItem(id, content),
  deleteItem: (id: string) => (isTauri ? invoke<void>("delete_item", { id }) : mockService.deleteItem(id)),
  togglePin: (id: string) => (isTauri ? invoke<ClipboardItem>("toggle_pin", { id }) : mockService.togglePin(id)),
  toggleFavorite: (id: string) =>
    isTauri ? invoke<ClipboardItem>("toggle_favorite", { id }) : mockService.toggleFavorite(id),
  listCollections: () => (isTauri ? invoke<Collection[]>("list_collections") : mockService.listCollections()),
  createCollection: (name: string) =>
    isTauri ? invoke<Collection>("create_collection", { name }) : mockService.createCollection(name),
  renameCollection: (id: string, name: string) =>
    isTauri ? invoke<Collection>("rename_collection", { id, name }) : mockService.renameCollection(id, name),
  deleteCollection: (id: string) => (isTauri ? invoke<void>("delete_collection", { id }) : mockService.deleteCollection(id)),
  addToCollection: (itemId: string, collectionId: string) =>
    isTauri ? invoke<ClipboardItem>("add_to_collection", { itemId, collectionId }) : mockService.addToCollection(itemId, collectionId),
  removeFromCollection: (itemId: string, collectionId: string) =>
    isTauri
      ? invoke<ClipboardItem>("remove_from_collection", { itemId, collectionId })
      : mockService.removeFromCollection(itemId, collectionId),
  getSettings: () => (isTauri ? invoke<AppSettings>("get_settings") : mockService.getSettings()),
  updateHistoryLimit: (historyLimit: AppSettings["historyLimit"]) =>
    isTauri ? invoke<AppSettings>("update_history_limit", { historyLimit }) : mockService.updateHistoryLimit(historyLimit)
};
