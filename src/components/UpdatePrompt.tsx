import { Download, RotateCcw, X } from "lucide-react";
import type { AppUpdaterController } from "../hooks/useAppUpdater";

interface UpdatePromptProps {
  updater: AppUpdaterController;
}

export function UpdatePrompt({ updater }: UpdatePromptProps) {
  if (!updater.showPrompt || !updater.update) return null;

  return (
    <div className="fixed inset-0 z-[140] grid place-items-center bg-slate-950/45 p-4 backdrop-blur-sm">
      <section
        className="w-full max-w-sm overflow-hidden rounded-xl border border-white/30 bg-white shadow-2xl dark:border-white/10 dark:bg-slate-950"
        role="dialog"
        aria-modal="true"
        aria-labelledby="update-dialog-title"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 p-4 dark:border-slate-800">
          <div className="flex gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-accent/15 text-accent">
              <Download size={20} aria-hidden />
            </span>
            <div>
              <h2 id="update-dialog-title" className="text-sm font-semibold text-slate-950 dark:text-white">
                Actualizacion descargada
              </h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Clipboard Pro {updater.update.version} esta listo para instalarse.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="icon-button"
            title="Instalar despues"
            onClick={updater.dismissPrompt}
          >
            <X size={16} aria-hidden />
          </button>
        </div>

        <div className="p-4">
          {updater.update.notes ? (
            <div className="custom-scrollbar max-h-32 overflow-y-auto rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-600 dark:bg-slate-900 dark:text-slate-300">
              {updater.update.notes}
            </div>
          ) : (
            <p className="text-xs leading-5 text-slate-600 dark:text-slate-300">
              Esta version incluye mejoras y correcciones. Tu historial, favoritos, pineados,
              colecciones y preferencias se conservaran.
            </p>
          )}

          {updater.error ? (
            <p className="mt-3 rounded-md bg-red-50 p-2 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">
              {updater.error}
            </p>
          ) : null}

          <div className="mt-4 flex items-center justify-end gap-2">
            <button
              type="button"
              className="text-button flex items-center gap-1.5 border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
              disabled={updater.phase === "installing"}
              onClick={updater.dismissPrompt}
            >
              Despues
            </button>
            <button
              type="button"
              className="primary-button flex items-center gap-1.5"
              disabled={updater.phase === "installing"}
              onClick={() => void updater.installUpdate()}
            >
              <RotateCcw
                size={14}
                className={updater.phase === "installing" ? "animate-spin" : ""}
                aria-hidden
              />
              {updater.phase === "installing" ? "Reiniciando..." : "Instalar ahora"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
