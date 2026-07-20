import { useEffect, useMemo, useState, type DragEvent, type MouseEvent } from "react";
import { Camera, ChevronLeft, Download, Minus, Pencil, Plus, RefreshCw, Settings, Trash2, X } from "lucide-react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { relaunch } from "@tauri-apps/plugin-process";
import { check, type Update } from "@tauri-apps/plugin-updater";
import clsx from "clsx";
import { ClipboardItemRow } from "../components/ClipboardItemRow";
import { InlineDialog } from "../components/InlineDialog";
import { SearchBar } from "../components/SearchBar";
import { ShortcutRecorder } from "../components/ShortcutRecorder";
import { ViewTabs } from "../components/ViewTabs";
import { VirtualList } from "../components/VirtualList";
import { clipboardService, type DesktopPlatform } from "../services/clipboardService";
import { accentOptions, accentRgb, useSystemTheme } from "../hooks/useSystemTheme";
import { useClipboardStore } from "../store/clipboardStore";
import type { AppSettings, ClipboardItem } from "../types/clipboard";

type DialogState =
  | { mode: "rename"; item: ClipboardItem }
  | { mode: "edit"; item: ClipboardItem }
  | { mode: "collection" }
  | { mode: "renameCollection"; collectionId: string }
  | { mode: "delete"; item: ClipboardItem }
  | null;

type UpdateState =
  | { mode: "idle" }
  | { mode: "available"; update: Update }
  | { mode: "downloading"; update: Update; progress: number }
  | { mode: "error"; message: string };

export function ClipboardWindow() {
  const store = useClipboardStore();
  const [dialog, setDialog] = useState<DialogState>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [platform, setPlatform] = useState<DesktopPlatform>(detectInitialPlatform);
  const [updateState, setUpdateState] = useState<UpdateState>({ mode: "idle" });
  const [appVersion, setAppVersion] = useState("...");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [captureMessage, setCaptureMessage] = useState<string | null>(null);
  const isMac = platform === "macos";

  useSystemTheme(store.settings?.theme, store.settings?.accent);

  useEffect(() => {
    void store.load();
  }, []);

  useEffect(() => {
    void clipboardService.getPlatform().then(setPlatform).catch(() => setPlatform("unknown"));
    void clipboardService.getAppVersion().then(setAppVersion).catch(() => setAppVersion("0.2.1"));
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

  useEffect(() => {
    if (!("__TAURI_INTERNALS__" in window)) return;

    const timer = window.setTimeout(() => {
      void check({ timeout: 8_000 })
        .then((update) => {
          if (update) setUpdateState({ mode: "available", update });
        })
        .catch(() => {
          // A failed background check must never interrupt clipboard use.
        });
    }, 800);

    return () => window.clearTimeout(timer);
  }, []);

  const startDragging = (event: MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !("__TAURI_INTERNALS__" in window)) return;
    void getCurrentWindow().startDragging();
  };

  const visibleItems = useMemo(() => {
    if (showSettings) return [];

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
  }, [showSettings, store.activeView, store.items, store.selectedCollectionId]);

  const selectedCollection = store.collections.find((collection) => collection.id === store.selectedCollectionId);
  const isCollectionRoot = store.activeView === "collections" && !store.selectedCollectionId;
  const listHeight = store.activeView === "collections" ? 365 : 392;

  useEffect(() => {
    setSelectedIndex((current) => Math.min(current, Math.max(visibleItems.length - 1, 0)));
  }, [visibleItems.length]);

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (showSettings || dialog || updateState.mode !== "idle" || target?.matches("input, textarea, select, button") || !visibleItems.length) return;
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        setSelectedIndex((current) => (current + (event.key === "ArrowDown" ? 1 : -1) + visibleItems.length) % visibleItems.length);
      }
      if (event.key === "Enter") {
        event.preventDefault();
        void store.paste(visibleItems[selectedIndex].id);
      }
      if (event.key === "Escape") void clipboardService.hideWindow();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [dialog, selectedIndex, showSettings, store, updateState.mode, visibleItems]);

  const dropItemIntoCollection = (event: DragEvent<HTMLElement>, collectionId: string) => {
    const itemId = event.dataTransfer.getData("application/x-clipboard-pro-item");
    if (!itemId) return;
    event.preventDefault();
    void store.addToCollection(itemId, collectionId);
  };

  const installUpdate = () => {
    if (updateState.mode !== "available") return;

    const update = updateState.update;
    let downloadedBytes = 0;
    let contentLength = 0;
    setUpdateState({ mode: "downloading", update, progress: 0 });

    void update
      .downloadAndInstall((event) => {
        if (event.event === "Started") {
          contentLength = event.data.contentLength ?? 0;
          return;
        }

        if (event.event === "Progress") {
          downloadedBytes += event.data.chunkLength;
          const progress = contentLength ? Math.min(99, Math.round((downloadedBytes / contentLength) * 100)) : 0;
          setUpdateState({ mode: "downloading", update, progress });
        }
      })
      .then(async () => {
        await relaunch();
      })
      .catch(() => {
        setUpdateState({
          mode: "error",
          message: "No se pudo instalar la actualización. Inténtalo de nuevo más tarde.",
        });
      });
  };

  return (
    <main className="window-shell">
      <section className="app-panel">
        <div
          className={clsx(
            "relative flex h-7 items-center border-b border-black/10 px-2 text-[11px] text-slate-500 dark:border-white/10 dark:text-slate-400",
            isMac ? "justify-start" : "justify-between"
          )}
          onMouseDown={startDragging}
        >
          {isMac ? <WindowControls isMac /> : null}
          <span
            className={clsx(
              "font-semibold tracking-wide text-slate-600 dark:text-slate-300",
              isMac ? "pointer-events-none absolute left-0 right-0 text-center" : null
            )}
          >
            Clipboard Pro
          </span>
          {isMac ? null : <WindowControls isMac={false} />}
        </div>

        <div className="flex items-center border-b border-black/10 dark:border-white/10">
          <div className="min-w-0 flex-1">
            <SearchBar value={store.query} onChange={(value) => void store.search(value)} />
          </div>
          <button className="mr-2 icon-button" title="Preferencias" type="button" onClick={() => setShowSettings((value) => !value)}>
            <Settings size={16} aria-hidden />
          </button>
        </div>

        <ViewTabs
          activeView={store.activeView}
          onChange={(view) => {
            setShowSettings(false);
            store.setView(view);
          }}
        />

        {showSettings ? (
          <section className="custom-scrollbar h-[365px] overflow-y-auto bg-white px-4 py-3 text-slate-900 dark:bg-[#020617] dark:text-white">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold">Preferencias</h2>
                <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">Configuracion local de Clipboard Pro</p>
              </div>
              <button className="icon-button" title="Cerrar preferencias" type="button" onClick={() => setShowSettings(false)}>
                <X size={16} aria-hidden />
              </button>
            </div>

            <div className="space-y-3">
              <label className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs dark:border-slate-800 dark:bg-slate-900/70">
                <span>
                  <span className="block font-medium">Limite del historial</span>
                  <span className="mt-0.5 block text-[11px] text-slate-500 dark:text-slate-400">Elimina automaticamente solo elementos no protegidos.</span>
                </span>
                <select
                  className="h-8 rounded-md border border-slate-200 bg-white px-2 text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  value={store.settings?.historyLimit ?? 50}
                  onChange={(event) => void store.updateHistoryLimit(Number(event.target.value) as AppSettings["historyLimit"])}
                >
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={250}>250</option>
                  <option value={500}>500</option>
                </select>
              </label>

              <label className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs dark:border-slate-800 dark:bg-slate-900/70">
                <span>
                  <span className="block font-medium">Iniciar con el sistema</span>
                  <span className="mt-0.5 block text-[11px] text-slate-500 dark:text-slate-400">Mantiene el monitor activo desde el arranque.</span>
                </span>
                <input
                  type="checkbox"
                  className="size-4 accent-blue-600"
                  checked={store.settings?.autoStart ?? false}
                  onChange={(event) => void store.updateAutoStart(event.target.checked)}
                />
              </label>

              <label className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs dark:border-slate-800 dark:bg-slate-900/70">
                <span>
                  <span className="block font-medium">Tema</span>
                  <span className="mt-0.5 block text-[11px] text-slate-500 dark:text-slate-400">Usa el sistema o elige una apariencia fija.</span>
                </span>
                <select aria-label="Tema" className="h-8 rounded-md border border-slate-200 bg-white px-2 text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white" value={store.settings?.theme ?? "system"} onChange={(event) => void store.updateTheme(event.target.value as AppSettings["theme"])}>
                  <option value="system">Sistema</option>
                  <option value="light">Claro</option>
                  <option value="dark">Oscuro</option>
                </select>
              </label>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs dark:border-slate-800 dark:bg-slate-900/70">
                <span className="block font-medium">Color de acento</span>
                <div className="mt-2 flex gap-2" role="group" aria-label="Color de acento">
                  {accentOptions.map((accent) => (
                    <button key={accent} type="button" title={accent} aria-label={`Usar acento ${accent}`} aria-pressed={(store.settings?.accent ?? "blue") === accent} onClick={() => void store.updateAccent(accent)} className={clsx("size-6 rounded-full border-2 transition", (store.settings?.accent ?? "blue") === accent ? "scale-110 border-slate-900 dark:border-white" : "border-transparent")} style={{ backgroundColor: `rgb(${accentRgb[accent]})` }} />
                  ))}
                </div>
              </div>

              <label className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs dark:border-slate-800 dark:bg-slate-900/70">
                <span>
                  <span className="block font-medium">Capturar portapapeles</span>
                  <span className="mt-0.5 block text-[11px] text-slate-500 dark:text-slate-400">Pausa el monitor sin borrar tu historial.</span>
                </span>
                <input type="checkbox" className="size-4 accent-blue-600" checked={store.settings?.captureEnabled ?? true} onChange={(event) => void store.updateCaptureEnabled(event.target.checked)} />
              </label>

              <ShortcutRecorder
                label="Abrir Clipboard Pro"
                platform={platform}
                value={store.settings?.shortcut ?? (isMac ? "Command+Alt+V" : "Ctrl+Alt+V")}
                defaultShortcut={isMac ? "Command+Alt+V" : "Ctrl+Alt+V"}
                onSave={(shortcut) => store.updateShortcut(shortcut)}
              />

              <div className="theme-surface rounded-xl p-3 text-xs">
                <span className="font-semibold">Captura de pantalla</span>
                <p className="mt-1 text-[11px] text-theme-muted">Al continuar, Clipboard Pro puede solicitar permiso del sistema y creará la carpeta de capturas en Imágenes. Podrás eliminar las imágenes cuando quieras.</p>
                <button className="primary-button mt-3 flex h-8 items-center gap-1 px-3 text-[11px]" type="button" onClick={() => void clipboardService.takeScreenshot().then(() => { setCaptureMessage("Captura copiada al portapapeles, guardada e incluida en el historial."); void store.load(); }).catch((error) => setCaptureMessage(error instanceof Error ? error.message : "No se pudo capturar la pantalla."))}><Camera size={14} /> Capturar pantalla</button>
                {captureMessage ? <p className="mt-2 text-[11px] text-theme-muted" role="status">{captureMessage}</p> : null}
              </div>
            </div>
          </section>
        ) : store.activeView === "collections" ? (
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

        {showSettings ? null : isCollectionRoot ? (
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
                isSelected={visibleItems[selectedIndex]?.id === item.id}
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
                onDelete={(id) => {
                  const selectedItem = store.items.find((candidate) => candidate.id === id);
                  if (selectedItem) setDialog({ mode: "delete", item: selectedItem });
                }}
              />
            )}
          />
        ) : (
          <div className="grid h-[365px] place-items-center px-8 text-center text-sm text-slate-500 dark:text-slate-400">
            No hay elementos para mostrar.
          </div>
        )}

        <footer className="absolute bottom-1.5 left-0 right-0 pointer-events-none text-center text-[10px] text-slate-400/80 dark:text-slate-500/80">
          v{appVersion} · Powered by Danny Maaz
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

        {dialog?.mode === "delete" ? (
          <section className="absolute inset-0 z-[100] grid place-items-center bg-slate-950/35 p-4 backdrop-blur-[2px]">
            <div className="w-full max-w-[300px] rounded-xl border border-slate-200 bg-white p-4 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Eliminar elemento</h2>
              <p className="mt-2 text-xs leading-5 text-slate-600 dark:text-slate-300">¿Eliminar “{dialog.item.title ?? dialog.item.preview}”? Esta acción no se puede deshacer.</p>
              <div className="mt-4 flex justify-end gap-2">
                <button className="text-button" type="button" onClick={() => setDialog(null)}>Cancelar</button>
                <button className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700" type="button" onClick={() => { void store.remove(dialog.item.id); setDialog(null); }}>Eliminar</button>
              </div>
            </div>
          </section>
        ) : null}

        {updateState.mode !== "idle" ? (
          <section className="absolute inset-0 z-50 grid place-items-center bg-slate-950/35 p-4 backdrop-blur-[2px]">
            <div className="w-full max-w-[320px] rounded-xl border border-slate-200 bg-white p-4 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
              {updateState.mode === "available" ? (
                <>
                  <div className="flex items-start gap-3">
                    <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-blue-600/10 text-blue-600 dark:text-blue-400">
                      <Download size={18} aria-hidden />
                    </div>
                    <div>
                      <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Actualización disponible</h2>
                      <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">Clipboard Pro {updateState.update.version} está lista para instalar.</p>
                    </div>
                  </div>
                  <p className="mt-3 text-[11px] leading-4 text-slate-500 dark:text-slate-400">Tu historial, favoritos, colecciones y preferencias se conservarán.</p>
                  <div className="mt-4 flex justify-end gap-2">
                    <button className="text-button" type="button" onClick={() => setUpdateState({ mode: "idle" })}>Más tarde</button>
                    <button className="primary-button" type="button" onClick={installUpdate}>Actualizar</button>
                  </div>
                </>
              ) : null}

              {updateState.mode === "downloading" ? (
                <>
                  <div className="flex items-center gap-3">
                    <RefreshCw className="animate-spin text-blue-600 dark:text-blue-400" size={18} aria-hidden />
                    <div>
                      <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Instalando actualización</h2>
                      <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">La aplicación se reiniciará al terminar.</p>
                    </div>
                  </div>
                  <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                    <div className="h-full rounded-full bg-blue-600 transition-[width] duration-150" style={{ width: `${updateState.progress || 8}%` }} />
                  </div>
                </>
              ) : null}

              {updateState.mode === "error" ? (
                <>
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Actualización no completada</h2>
                  <p className="mt-2 text-xs leading-5 text-slate-600 dark:text-slate-300">{updateState.message}</p>
                  <div className="mt-4 flex justify-end">
                    <button className="primary-button" type="button" onClick={() => setUpdateState({ mode: "idle" })}>Entendido</button>
                  </div>
                </>
              ) : null}
            </div>
          </section>
        ) : null}
      </section>
    </main>
  );
}

function WindowControls({ isMac }: { isMac: boolean }) {
  if (isMac) {
    return (
      <div className="z-10 flex items-center gap-2" onMouseDown={(event) => event.stopPropagation()}>
        <button
          className="traffic-button close"
          title="Cerrar ventana"
          type="button"
          onClick={() => void clipboardService.hideWindow()}
        />
        <button
          className="traffic-button minimize"
          title="Minimizar"
          type="button"
          onClick={() => void clipboardService.minimizeWindow()}
        />
        <button
          className="traffic-button maximize"
          title="Expandir"
          type="button"
          onClick={() => void clipboardService.toggleMaximizeWindow()}
        />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1" onMouseDown={(event) => event.stopPropagation()}>
      <button className="title-button" title="Ocultar" type="button" onClick={() => void clipboardService.hideWindow()}>
        <Minus size={13} aria-hidden />
      </button>
      <button className="title-button danger" title="Cerrar Clipboard Pro" type="button" onClick={() => void clipboardService.quitApp()}>
        <X size={13} aria-hidden />
      </button>
    </div>
  );
}

function detectInitialPlatform(): DesktopPlatform {
  if (typeof navigator === "undefined") return "unknown";
  const platform = navigator.platform.toLowerCase();
  const userAgent = navigator.userAgent.toLowerCase();

  if (platform.includes("mac") || userAgent.includes("mac os")) return "macos";
  if (platform.includes("win") || userAgent.includes("windows")) return "windows";
  if (platform.includes("linux") || userAgent.includes("linux")) return "linux";
  return "unknown";
}
