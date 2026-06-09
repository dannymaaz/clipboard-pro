import { useEffect, useMemo, useState, type DragEvent, type MouseEvent } from "react";
import { ChevronLeft, Minus, Pencil, Plus, Settings, Trash2, X } from "lucide-react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { ClipboardItemRow } from "../components/ClipboardItemRow";
import { InlineDialog } from "../components/InlineDialog";
import { SearchBar } from "../components/SearchBar";
import { ViewTabs } from "../components/ViewTabs";
import { VirtualList } from "../components/VirtualList";
import { clipboardService } from "../services/clipboardService";
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

  useEffect(() => {
    if (!("__TAURI_INTERNALS__" in window)) return;

    let unlisten: UnlistenFn | undefined;
    void listen("clipboard-pro://items-changed", () => {
      void store.load();
    }).then((handler) => {
      unlisten = handler;
    });

    return () => unlisten?.();
  }, []);

  const startDragging = (event: MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !("__TAURI_INTERNALS__" in window)) return;
    void getCurrentWindow().startDragging();
  };

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

  const selectedCollection = store.collections.find((collection) => collection.id === store.selectedCollectionId);
  const isCollectionRoot = store.activeView === "collections" && !store.selectedCollectionId;
  const listHeight = showSettings ? 315 : store.activeView === "collections" ? 365 : 392;

  const dropItemIntoCollection = (event: DragEvent<HTMLElement>, collectionId: string) => {
    const itemId = event.dataTransfer.getData("application/x-clipboard-pro-item");
    if (!itemId) return;
    event.preventDefault();
    void store.addToCollection(itemId, collectionId);
  };

  return (
    <main className="window-shell">
      <section className="app-panel">
        <div className="flex h-7 items-center justify-between border-b border-black/10 px-2 text-[11px] text-slate-500 dark:border-white/10 dark:text-slate-400" onMouseDown={startDragging}>
          <span className="font-semibold tracking-wide text-slate-600 dark:text-slate-300">Clipboard Pro</span>
          <div className="flex items-center gap-1" onMouseDown={(event) => event.stopPropagation()}>
            <button className="title-button" title="Ocultar" type="button" onClick={() => void clipboardService.hideWindow()}>
              <Minus size={13} aria-hidden />
            </button>
            <button className="title-button danger" title="Cerrar Clipboard Pro" type="button" onClick={() => void clipboardService.quitApp()}>
              <X size={13} aria-hidden />
            </button>
          </div>
        </div>

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
            <label className="mt-3 flex items-center justify-between gap-3 text-slate-600 dark:text-slate-300">
              <span>Iniciar con el sistema</span>
              <input
                type="checkbox"
                className="size-4 accent-blue-600"
                checked={store.settings?.autoStart ?? false}
                onChange={(event) => void store.updateAutoStart(event.target.checked)}
              />
            </label>
            <div className="mt-2 text-slate-500 dark:text-slate-400">Atajo global: {store.settings?.shortcut ?? "Ctrl+Alt+V"}</div>
          </div>
        ) : null}

        {store.activeView === "collections" ? (
          <div className="flex items-center gap-2 border-b border-black/10 p-2 dark:border-white/10">
            {store.selectedCollectionId ? (
              <button className="icon-button" title="Volver a colecciones" type="button" onClick={() => store.setCollection(null)}>
                <ChevronLeft size={16} aria-hidden />
              </button>
            ) : null}
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-semibold text-slate-800 dark:text-slate-100">
                {selectedCollection?.name ?? "Colecciones"}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                {selectedCollection ? `${selectedCollection.itemCount} elementos` : "Arrastra elementos para organizarlos"}
              </div>
            </div>
            <button className="icon-button" title="Crear coleccion" type="button" onClick={() => setDialog({ mode: "collection" })}>
              <Plus size={15} aria-hidden />
            </button>
          </div>
        ) : null}

        {isCollectionRoot ? (
          <div className="custom-scrollbar h-[365px] overflow-y-auto p-2">
            {store.collections.length ? (
              <div className="grid gap-2">
                {store.collections.map((collection) => (
                  <article
                    key={collection.id}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => dropItemIntoCollection(event, collection.id)}
                    className="group flex items-center gap-2 rounded-lg border border-black/10 bg-black/[0.025] p-2.5 transition hover:border-accent/50 hover:bg-accent/5 dark:border-white/10 dark:bg-white/[0.03] dark:hover:bg-white/[0.06]"
                  >
                    <button className="min-w-0 flex-1 text-left" type="button" onClick={() => store.setCollection(collection.id)}>
                      <span className="block truncate text-[13px] font-semibold text-slate-900 dark:text-white">{collection.name}</span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">{collection.itemCount} elementos</span>
                    </button>
                    <button title="Renombrar coleccion" type="button" className="icon-button" onClick={() => setDialog({ mode: "renameCollection", collectionId: collection.id })}>
                      <Pencil size={13} aria-hidden />
                    </button>
                    <button title="Eliminar coleccion" type="button" className="icon-button danger" onClick={() => void store.deleteCollection(collection.id)}>
                      <Trash2 size={13} aria-hidden />
                    </button>
                  </article>
                ))}
              </div>
            ) : (
              <div className="grid h-full place-items-center px-8 text-center text-sm text-slate-500 dark:text-slate-400">
                Crea tu primera coleccion para organizar prompts, URLs o textos frecuentes.
              </div>
            )}
          </div>
        ) : visibleItems.length ? (
          <VirtualList
            items={visibleItems}
            itemHeight={58}
            height={listHeight}
            renderItem={(item) => (
              <ClipboardItemRow
                key={item.id}
                item={item}
                collections={store.collections}
                onCopy={(id) => void store.copy(id)}
                onPaste={(id) => void store.paste(id)}
                onTogglePin={(id) => void store.togglePin(id)}
                onToggleFavorite={(id) => void store.toggleFavorite(id)}
                onAddToCollection={(itemId, collectionId) => void store.addToCollection(itemId, collectionId)}
                onRemoveFromCollection={(itemId, collectionId) => void store.removeFromCollection(itemId, collectionId)}
                onRename={(selectedItem) => setDialog({ mode: "rename", item: selectedItem })}
                onEdit={(selectedItem) => {
                  if (selectedItem.kind !== "image") setDialog({ mode: "edit", item: selectedItem });
                }}
                onDelete={(id) => void store.remove(id)}
              />
            )}
          />
        ) : (
          <div className="grid h-[365px] place-items-center px-8 text-center text-sm text-slate-500 dark:text-slate-400">
            No hay elementos para mostrar.
          </div>
        )}

        <footer className="absolute bottom-1.5 left-0 right-0 pointer-events-none text-center text-[10px] text-slate-400/80 dark:text-slate-500/80">
          Powered by Danny Maaz
        </footer>

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
