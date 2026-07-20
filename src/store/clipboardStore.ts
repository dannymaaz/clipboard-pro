import { create } from "zustand";
import { clipboardService } from "../services/clipboardService";
import type { AppSettings, ClipboardItem, ClipboardView, Collection } from "../types/clipboard";

interface ClipboardState {
  items: ClipboardItem[];
  collections: Collection[];
  settings: AppSettings | null;
  query: string;
  activeView: ClipboardView;
  selectedCollectionId: string | null;
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  load: () => Promise<void>;
  loadMore: () => Promise<void>;
  search: (query: string) => Promise<void>;
  setView: (view: ClipboardView) => void;
  setCollection: (id: string | null) => void;
  copy: (id: string) => Promise<void>;
  paste: (id: string) => Promise<void>;
  togglePin: (id: string) => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
  rename: (id: string, title: string) => Promise<void>;
  editText: (id: string, content: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  createCollection: (name: string) => Promise<void>;
  renameCollection: (id: string, name: string) => Promise<void>;
  deleteCollection: (id: string) => Promise<void>;
  addToCollection: (itemId: string, collectionId: string) => Promise<void>;
  removeFromCollection: (itemId: string, collectionId: string) => Promise<void>;
  updateHistoryLimit: (historyLimit: AppSettings["historyLimit"]) => Promise<void>;
  updateAutoStart: (autoStart: boolean) => Promise<void>;
  updateTheme: (theme: AppSettings["theme"]) => Promise<void>;
  updateAccent: (accent: AppSettings["accent"]) => Promise<void>;
  updateCaptureEnabled: (captureEnabled: boolean) => Promise<void>;
  updateShortcut: (shortcut: string) => Promise<void>;
  updateScreenshotShortcut: (shortcut: string) => Promise<void>;
  updateColorPickerShortcut: (shortcut: string) => Promise<void>;
}

const upsertItem = (items: ClipboardItem[], nextItem: ClipboardItem) =>
  items.map((item) => (item.id === nextItem.id ? nextItem : item));
let searchRequest = 0;
const HISTORY_PAGE_SIZE = 100;

export const useClipboardStore = create<ClipboardState>((set, get) => ({
  items: [],
  collections: [],
  settings: null,
  query: "",
  activeView: "history",
  selectedCollectionId: null,
  isLoading: false,
  isLoadingMore: false,
  hasMore: false,

  load: async () => {
    set({ isLoading: true });
    const query = get().query;
    const [items, collections, settings] = await Promise.all([
      query.trim() ? clipboardService.searchItems(query) : clipboardService.listItemsPage(0, HISTORY_PAGE_SIZE),
      clipboardService.listCollections(),
      clipboardService.getSettings()
    ]);
    set({ items, collections, settings, hasMore: !query.trim() && items.length === HISTORY_PAGE_SIZE, isLoading: false });
  },

  loadMore: async () => {
    const { hasMore, isLoadingMore, items, query } = get();
    if (!hasMore || isLoadingMore || query.trim()) return;
    set({ isLoadingMore: true });
    try {
      const next = await clipboardService.listItemsPage(items.length, HISTORY_PAGE_SIZE);
      const existing = new Set(items.map((item) => item.id));
      const unique = next.filter((item) => !existing.has(item.id));
      set({ items: [...items, ...unique], hasMore: next.length === HISTORY_PAGE_SIZE });
    } finally {
      set({ isLoadingMore: false });
    }
  },

  search: async (query) => {
    const request = ++searchRequest;
    set({ query });
    const items = query.trim()
      ? await clipboardService.searchItems(query)
      : await clipboardService.listItemsPage(0, HISTORY_PAGE_SIZE);
    if (request === searchRequest) set({ items, hasMore: !query.trim() && items.length === HISTORY_PAGE_SIZE });
  },

  setView: (activeView) => set({ activeView, selectedCollectionId: null }),
  setCollection: (selectedCollectionId) => set({ selectedCollectionId }),

  copy: async (id) => {
    await clipboardService.copyItem(id);
    await get().load();
  },

  paste: async (id) => {
    await clipboardService.pasteItem(id);
    await get().load();
  },

  togglePin: async (id) => {
    const item = await clipboardService.togglePin(id);
    set({ items: upsertItem(get().items, item) });
  },

  toggleFavorite: async (id) => {
    const item = await clipboardService.toggleFavorite(id);
    set({ items: upsertItem(get().items, item) });
  },

  rename: async (id, title) => {
    const item = await clipboardService.renameItem(id, title);
    set({ items: upsertItem(get().items, item) });
  },

  editText: async (id, content) => {
    const item = await clipboardService.editTextItem(id, content);
    set({ items: upsertItem(get().items, item) });
  },

  remove: async (id) => {
    await clipboardService.deleteItem(id);
    const collections = await clipboardService.listCollections();
    set({ items: get().items.filter((item) => item.id !== id), collections });
  },

  createCollection: async (name) => {
    const collection = await clipboardService.createCollection(name);
    set({ collections: [collection, ...get().collections] });
  },

  renameCollection: async (id, name) => {
    const collection = await clipboardService.renameCollection(id, name);
    set({
      collections: get().collections.map((current) => (current.id === id ? collection : current))
    });
  },

  deleteCollection: async (id) => {
    await clipboardService.deleteCollection(id);
    set({
      collections: get().collections.filter((collection) => collection.id !== id),
      selectedCollectionId: get().selectedCollectionId === id ? null : get().selectedCollectionId,
      items: get().items.map((item) => ({
        ...item,
        collections: item.collections.filter((collectionId) => collectionId !== id)
      }))
    });
  },

  addToCollection: async (itemId, collectionId) => {
    const item = await clipboardService.addToCollection(itemId, collectionId);
    const collections = await clipboardService.listCollections();
    set({ items: upsertItem(get().items, item), collections });
  },

  removeFromCollection: async (itemId, collectionId) => {
    const item = await clipboardService.removeFromCollection(itemId, collectionId);
    const collections = await clipboardService.listCollections();
    set({ items: upsertItem(get().items, item), collections });
  },

  updateHistoryLimit: async (historyLimit) => {
    const settings = await clipboardService.updateHistoryLimit(historyLimit);
    const items = await clipboardService.listItemsPage(0, HISTORY_PAGE_SIZE);
    set({ settings, items, hasMore: items.length === HISTORY_PAGE_SIZE });
  },

  updateAutoStart: async (autoStart) => {
    const settings = await clipboardService.updateAutoStart(autoStart);
    set({ settings });
  },

  updateTheme: async (theme) => {
    const settings = await clipboardService.updateTheme(theme);
    set({ settings });
  },

  updateAccent: async (accent) => {
    const settings = await clipboardService.updateAccent(accent);
    set({ settings });
  },

  updateCaptureEnabled: async (captureEnabled) => {
    const settings = await clipboardService.updateCaptureEnabled(captureEnabled);
    set({ settings });
  },

  updateShortcut: async (shortcut) => {
    const settings = await clipboardService.updateShortcut(shortcut);
    set({ settings });
  },

  updateScreenshotShortcut: async (shortcut) => {
    const settings = await clipboardService.updateScreenshotShortcut(shortcut);
    set({ settings });
  },

  updateColorPickerShortcut: async (shortcut) => {
    const settings = await clipboardService.updateColorPickerShortcut(shortcut);
    set({ settings });
  }
}));
