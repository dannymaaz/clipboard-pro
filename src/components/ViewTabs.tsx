import { Folder, Heart, History } from "lucide-react";
import clsx from "clsx";
import type { ClipboardView } from "../types/clipboard";

const tabs: Array<{ id: ClipboardView; label: string; Icon: typeof Heart }> = [
  { id: "history", label: "Historial", Icon: History },
  { id: "favorites", label: "Favoritos", Icon: Heart },
  { id: "collections", label: "Colecciones", Icon: Folder }
];

interface ViewTabsProps {
  activeView: ClipboardView;
  onChange: (view: ClipboardView) => void;
}

export function ViewTabs({ activeView, onChange }: ViewTabsProps) {
  return (
    <div className="grid grid-cols-3 gap-1 border-b border-black/10 p-1.5 dark:border-white/10">
      {tabs.map(({ id, label, Icon }) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          className={clsx(
            "flex h-8 items-center justify-center gap-1.5 rounded-md text-[12px] font-medium transition",
            activeView === id
              ? "bg-accent text-white"
              : "text-slate-600 hover:bg-black/5 dark:text-slate-300 dark:hover:bg-white/8"
          )}
        >
          <Icon size={15} aria-hidden />
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}
