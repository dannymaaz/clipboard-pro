import { useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Settings, Trash2 } from "lucide-react";
import { ClipboardItemRow } from "../components/ClipboardItemRow";
import { InlineDialog } from "../components/InlineDialog";
import { SearchBar } from "../components/SearchBar";
import { ViewTabs } from "../components/ViewTabs";
import { VirtualList } from "../components/VirtualList";
import { useSystemTheme } from "../hooks/useSystemTheme";
import { useClipboardStore } from "../store/clipboardStore";
import type { AppSettings, ClipboardItem } from "../types/clipboard";

type DialogState =
  | { mode: "rename"; item: ClipboardItem }
  | { mode: "edit"; item: ClipboardItem }
  | { mode: "collection" }
  | { mode: "renameCollection"; collectionId: string }
  | null;

export function ClipboardWindow() {
  const store = useClipboardStore();
  const [dialog, setDialog] = useState<DialogState>(null);
  const [showSettings, setShowSettings] = useState(false);

  useSystemTheme(store.settings?.theme);

  useEffect(() => {
    void store.load();
  }, []);

  const visibleItems = useMemo(() => {
    const base = store.items.filter((item) => {
      if (store.activeView === "favorites") return item.isFavorite;
      if (store.activeView === "collections" && store.selectedCollectionId) {
        return item.collections.includes(store.selectedCollectionId);
      }
      return true;
    });

    return [...base].sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      return Date.parse(b.createdAt) - Date.parse(a.createdAt);
    });
  }, [store.activeView, store.items, store.selectedCollectionId]);

  const listHeight = store.activeView === "collections" ? (showSettings ? 439 : 505) : showSettings ? 486 : 552;

  return (
    <main className="window-shell">
      <section className="relative h-[620px] w-[420px] overflow-hidden rounded-xl border border-white/35 bg-white/72 shadow-panel backdrop-blur-2xl dark:border-white/12 dark:bg-slate-950/72">
        <div className="flex items-center border-b border-black/10 dark:border-white/10">
          <div className="min-w-0 flex-1">
            <SearchBar value={store.query} onChange={(value) => void store.search(value)} />
          </div>
          <button className="mr-2 icon-button" title="Preferencias" type="button" onClick={() => setShowSettings((value) => !value)}>
            <Settings size={16} aria-hidden />
          </button>
        </div>

        <ViewTabs activeView={store.activeView} onChange={store.setView} />

        {showSettings ? (
          <div className="border-b border-black/10 p-3 text-xs dark:border-white/10">
            <label className="flex items-center justify-between gap-3 text-slate-600 dark:text-slate-300">
              <span>Limite del historial</span>
              <select
                className="h-8 rounded-md border border-black/10 bg-white px-2 text-slate-900 outline-none dark:border-white/10 dark:bg-slate-900 dark:text-white"
                value={store.settings?.historyLimit ?? 50}
                onChange={(event) => void store.updateHistoryLimit(Number(event.target.value) as AppSettings["historyLimit"])}
              >
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={250}>250</option>
                <option value={500}>500</option>
              </select>
            </label>
            <div className="mt-2 text-slate-500 dark:text-slate-400">Atajo global: {store.settings?.shortcut ?? "Ctrl+Alt+V"}</div>
          </div>
        ) : null}

        {store.activeView === "collections" ? (
          <div className="flex gap-2 border-b border-black/10 p-2 dark:border-white/10">
            <div className="custom-scrollbar flex flex-1 gap-1 overflow-x-auto">
              {store.collections.map((collection) => (
                <div key={collection.id} className={`chip flex items-center gap-1 ${store.selectedCollectionId === collection.id ? "active" : ""}`}>
                  <button onClick={() => store.setCollection(collection.id)} type="button">
                    {collection.name}
                  </button>
                  <button title="Renombrar coleccion" type="button" onClick={() => setDialog({ mode: "renameCollection", collectionId: collection.id })}>
                    <Pencil size={12} aria-hidden />
                  </button>
                  <button title="Eliminar coleccion" type="button" onClick={() => void store.deleteCollection(collection.id)}>
                    <Trash2 size={12} aria-hidden />
                  </button>
                </div>
              ))}
            </div>
            <button className="icon-button" title="Crear coleccion" type="button" onClick={() => setDialog({ mode: "collection" })}>
              <Plus size={15} aria-hidden />
            </button>
          </div>
        ) : null}

        {visibleItems.length ? (
          <VirtualList
            items={visibleItems}
            itemHeight={72}
            height={listHeight}
            renderItem={(item) => (
              <ClipboardItemRow
                key={item.id}
                item={item}
                collections={store.collections}
                onCopy={(id) => void store.copy(id)}
                onTogglePin={(id) => void store.togglePin(id)}
                onToggleFavorite={(id) => void store.toggleFavorite(id)}
                onAddToCollection={(itemId, collectionId) => void store.addToCollection(itemId, collectionId)}
                onRemoveFromCollection={(itemId, collectionId) => void store.removeFromCollection(itemId, collectionId)}
                onRename={(selectedItem) => setDialog({ mode: "rename", item: selectedItem })}
                onEdit={(selectedItem) => setDialog({ mode: "edit", item: selectedItem })}
                onDelete={(id) => void store.remove(id)}
              />
            )}
          />
        ) : (
          <div className="grid h-[500px] place-items-center px-8 text-center text-sm text-slate-500 dark:text-slate-400">
            No hay elementos para mostrar.
          </div>
        )}

        {dialog?.mode === "rename" ? (
          <InlineDialog
            title="Renombrar elemento"
            label="Nombre visible"
            initialValue={dialog.item.title ?? ""}
            onClose={() => setDialog(null)}
            onSubmit={(title) => {
              void store.rename(dialog.item.id, title);
              setDialog(null);
            }}
          />
        ) : null}

        {dialog?.mode === "edit" ? (
          <InlineDialog
            title="Editar texto"
            label="Contenido"
            initialValue={dialog.item.content}
            multiline
            onClose={() => setDialog(null)}
            onSubmit={(content) => {
              void store.editText(dialog.item.id, content);
              setDialog(null);
            }}
          />
        ) : null}

        {dialog?.mode === "collection" ? (
          <InlineDialog
            title="Nueva coleccion"
            label="Nombre"
            onClose={() => setDialog(null)}
            onSubmit={(name) => {
              void store.createCollection(name);
              setDialog(null);
            }}
          />
        ) : null}

        {dialog?.mode === "renameCollection" ? (
          <InlineDialog
            title="Renombrar coleccion"
            label="Nombre"
            initialValue={store.collections.find((collection) => collection.id === dialog.collectionId)?.name ?? ""}
            onClose={() => setDialog(null)}
            onSubmit={(name) => {
              void store.renameCollection(dialog.collectionId, name);
              setDialog(null);
            }}
          />
        ) : null}
      </section>
    </main>
  );
}
