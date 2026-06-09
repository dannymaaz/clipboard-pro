import { useEffect, useRef, useState, type DragEvent, type MouseEvent, type ReactNode } from "react";
import { Copy, FolderPlus, MoreVertical, Pencil, Pin, PinOff, Star, StarOff, Trash2 } from "lucide-react";
import clsx from "clsx";
import type { ClipboardItem, Collection } from "../types/clipboard";
import { getItemSubtitle, getItemTitle, itemKindMeta } from "../utils/itemFormat";

interface ClipboardItemRowProps {
  item: ClipboardItem;
  collections: Collection[];
  onCopy: (id: string) => void;
  onPaste: (id: string) => void;
  onTogglePin: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  onAddToCollection: (itemId: string, collectionId: string) => void;
  onRemoveFromCollection: (itemId: string, collectionId: string) => void;
  onRename: (item: ClipboardItem) => void;
  onEdit: (item: ClipboardItem) => void;
  onDelete: (id: string) => void;
}

export function ClipboardItemRow({
  item,
  collections,
  onCopy,
  onPaste,
  onTogglePin,
  onToggleFavorite,
  onAddToCollection,
  onRemoveFromCollection,
  onRename,
  onEdit,
  onDelete
}: ClipboardItemRowProps) {
  const [isMenuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const meta = itemKindMeta[item.kind];
  const title = getItemTitle(item);
  const subtitle = getItemSubtitle(item);

  useEffect(() => {
    const closeMenu = (event: globalThis.MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", closeMenu);
    return () => document.removeEventListener("mousedown", closeMenu);
  }, []);

  const runAction = (action: () => void) => {
    action();
    setMenuOpen(false);
  };

  const onDragStart = (event: DragEvent<HTMLElement>) => {
    if (isMenuOpen) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.setData("application/x-clipboard-pro-item", item.id);
    event.dataTransfer.effectAllowed = "copyMove";
  };

  const stopMenuEvent = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <article
      className={clsx(
        "animate-soft-in group relative flex min-h-14 items-center gap-2 border-b border-black/5 px-2 py-1.5 last:border-b-0 dark:border-white/8",
        isMenuOpen ? "z-[80]" : "z-0"
      )}
    >
      <button
        type="button"
        draggable={!isMenuOpen}
        onDragStart={onDragStart}
        onClick={() => onPaste(item.id)}
        className="relative z-10 flex min-w-0 flex-1 items-center gap-2 overflow-hidden rounded-md px-2 py-1.5 text-left transition hover:bg-black/5 dark:hover:bg-white/8"
      >
        <span
          className={clsx(
            "grid size-8 shrink-0 place-items-center rounded-md",
            item.isPinned ? "bg-accent text-white" : "bg-black/5 text-slate-600 dark:bg-white/10 dark:text-slate-200"
          )}
        >
          {item.kind === "image" && item.thumbnail ? (
            <img src={item.thumbnail} alt="" className="size-8 rounded-md object-cover" />
          ) : (
            <meta.Icon size={16} aria-hidden />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium text-slate-950 dark:text-white">{title}</span>
          <span className="mt-0.5 flex items-center gap-2 truncate text-xs text-slate-500 dark:text-slate-400">
            <span>{meta.label}</span>
            <span className="truncate">{subtitle}</span>
          </span>
        </span>
      </button>

      <div className="relative z-20 shrink-0" ref={menuRef} onMouseDown={(event) => event.stopPropagation()}>
        <button
          className="icon-button"
          type="button"
          title="Opciones"
          onMouseDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setMenuOpen((value) => !value);
          }}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
        >
          <MoreVertical size={16} aria-hidden />
        </button>

        {isMenuOpen ? (
          <div
            className="absolute right-0 top-8 z-[90] w-52 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 text-sm shadow-2xl ring-1 ring-black/5 dark:border-slate-700 dark:bg-[#020617] dark:ring-white/10"
            draggable={false}
            onMouseDown={stopMenuEvent}
            onClick={(event) => event.stopPropagation()}
          >
            <MenuButton icon={<Copy size={15} />} label="Copiar" onClick={() => runAction(() => onCopy(item.id))} />
            <MenuButton
              icon={item.isPinned ? <PinOff size={15} /> : <Pin size={15} />}
              label={item.isPinned ? "Despinear" : "Pinear"}
              onClick={() => runAction(() => onTogglePin(item.id))}
            />
            <MenuButton
              icon={item.isFavorite ? <StarOff size={15} /> : <Star size={15} />}
              label={item.isFavorite ? "Quitar favorito" : "Favorito"}
              onClick={() => runAction(() => onToggleFavorite(item.id))}
            />
            <MenuButton icon={<Pencil size={15} />} label="Renombrar" onClick={() => runAction(() => onRename(item))} />
            {item.kind === "text" || item.kind === "url" ? (
              <MenuButton icon={<MoreVertical size={15} />} label="Editar" onClick={() => runAction(() => onEdit(item))} />
            ) : null}

            {collections.length ? (
              <div className="border-y border-black/10 py-1 dark:border-white/10">
                <div className="px-3 py-1 text-[11px] font-semibold uppercase text-slate-400">Agregar a coleccion</div>
                <div className="custom-scrollbar max-h-32 overflow-y-auto">
                  {collections.map((collection) => {
                    const isIncluded = item.collections.includes(collection.id);
                    return (
                      <MenuButton
                        key={collection.id}
                        icon={<FolderPlus size={15} />}
                        label={isIncluded ? `Quitar de ${collection.name}` : collection.name}
                        onClick={() =>
                          runAction(() =>
                            isIncluded
                              ? onRemoveFromCollection(item.id, collection.id)
                              : onAddToCollection(item.id, collection.id)
                          )
                        }
                      />
                    );
                  })}
                </div>
              </div>
            ) : null}

            <MenuButton
              danger
              icon={<Trash2 size={15} />}
              label="Eliminar"
              onClick={() => runAction(() => onDelete(item.id))}
            />
          </div>
        ) : null}
      </div>
    </article>
  );
}

interface MenuButtonProps {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}

function MenuButton({ icon, label, onClick, danger }: MenuButtonProps) {
  return (
    <button
      type="button"
      onMouseDown={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onClick();
      }}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      className={clsx(
        "relative z-[91] flex h-8 w-full items-center gap-2 px-3 text-left text-xs transition hover:bg-slate-100 dark:hover:bg-slate-800",
        danger ? "text-red-600 dark:text-red-400" : "text-slate-700 dark:text-slate-200"
      )}
    >
      {icon}
      <span className="truncate">{label}</span>
    </button>
  );
}
