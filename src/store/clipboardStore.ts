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
  load: () => Promise<void>;
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
}

const upsertItem = (items: ClipboardItem[], nextItem: ClipboardItem) =>
  items.map((item) => (item.id === nextItem.id ? nextItem : item));

export const useClipboardStore = create<ClipboardState>((set, get) => ({
  items: [],
  collections: [],
  settings: null,
  query: "",
  activeView: "history",
  selectedCollectionId: null,
  isLoading: false,

  load: async () => {
    set({ isLoading: true });
    const query = get().query;
    const [items, collections, settings] = await Promise.all([
      query.trim() ? clipboardService.searchItems(query) : clipboardService.listItems(),
      clipboardService.listCollections(),
      clipboardService.getSettings()
    ]);
    set({ items, collections, settings, isLoading: false });
  },

  search: async (query) => {
    set({ query });
    const items = query.trim()
      ? await clipboardService.searchItems(query)
      : await clipboardService.listItems();
    set({ items });
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
    set({ items: get().items.filter((item) => item.id !== id) });
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
    const items = await clipboardService.listItems();
    set({ settings, items });
  },

  updateAutoStart: async (autoStart) => {
    const settings = await clipboardService.updateAutoStart(autoStart);
    set({ settings });
  }
}));
