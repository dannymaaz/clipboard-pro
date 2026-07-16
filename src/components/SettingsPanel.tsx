import { useEffect, useMemo, useState } from "react";
import { Check, Download, Palette, RefreshCw, X } from "lucide-react";
import type { AppearancePreferences } from "../hooks/useAppearancePreferences";
import type { AppUpdaterController } from "../hooks/useAppUpdater";
import { useClipboardStore } from "../store/clipboardStore";
import type { AppSettings } from "../types/clipboard";
import { ACCENT_PRESETS, normalizeHexColor } from "../utils/color";

interface SettingsPanelProps {
  onClose: () => void;
  updater: AppUpdaterController;
  appearance: AppearancePreferences;
}

export function SettingsPanel({ onClose, updater, appearance }: SettingsPanelProps) {
  const store = useClipboardStore();
  const [customAccent, setCustomAccent] = useState(appearance.accentColor);

  useEffect(() => {
    setCustomAccent(appearance.accentColor);
  }, [appearance.accentColor]);

  const normalizedCustomAccent = useMemo(
    () => normalizeHexColor(customAccent),
    [customAccent]
  );

  const applyCustomAccent = () => {
    if (normalizedCustomAccent) appearance.setAccentColor(normalizedCustomAccent);
  };

  const progress = Math.round(updater.progress?.percentage ?? 0);

  return (
    <section className="custom-scrollbar h-[365px] overflow-y-auto bg-white px-4 py-3 text-slate-900 dark:bg-[#020617] dark:text-white">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">Preferencias</h2>
          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
            Configuracion local de Clipboard Pro
          </p>
        </div>
        <button className="icon-button" title="Cerrar preferencias" type="button" onClick={onClose}>
          <X size={16} aria-hidden />
        </button>
      </div>

      <div className="space-y-3">
        <section className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs dark:border-slate-800 dark:bg-slate-900/70">
          <div className="mb-3 flex items-center gap-2">
            <Palette size={15} className="text-accent" aria-hidden />
            <div>
              <h3 className="font-semibold">Personalizacion</h3>
              <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                Elige el tema y el color principal de la aplicacion.
              </p>
            </div>
          </div>

          <label className="mb-3 flex items-center justify-between gap-3">
            <span className="font-medium">Tema</span>
            <select
              className="h-8 rounded-md border border-slate-200 bg-white px-2 text-slate-900 outline-none focus:border-accent dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              value={appearance.theme}
              onChange={(event) =>
                appearance.setTheme(event.target.value as AppearancePreferences["theme"])
              }
            >
              <option value="system">Usar el sistema</option>
              <option value="light">Claro</option>
              <option value="dark">Oscuro</option>
            </select>
          </label>

          <div className="mb-2 flex items-center justify-between">
            <span className="font-medium">Color de acento</span>
            <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
              {appearance.accentColor}
            </span>
          </div>

          <div className="grid grid-cols-6 gap-2">
            {ACCENT_PRESETS.map((preset) => {
              const selected = preset.value === appearance.accentColor;
              return (
                <button
                  key={preset.value}
                  type="button"
                  title={preset.name}
                  aria-label={`Usar ${preset.name} ${preset.value}`}
                  aria-pressed={selected}
                  className="relative aspect-square rounded-md border border-black/10 shadow-sm transition hover:scale-105 focus:outline-none focus:ring-2 focus:ring-accent/40 dark:border-white/15"
                  style={{ backgroundColor: preset.value }}
                  onClick={() => appearance.setAccentColor(preset.value)}
                >
                  {selected ? (
                    <span className="absolute inset-0 grid place-items-center text-white drop-shadow">
                      <Check size={15} strokeWidth={3} aria-hidden />
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex items-center gap-2">
            <label
              className="relative grid size-9 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-md border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950"
              title="Abrir selector de color"
            >
              <span
                className="size-6 rounded"
                style={{ backgroundColor: normalizedCustomAccent ?? appearance.accentColor }}
              />
              <input
                className="absolute inset-0 cursor-pointer opacity-0"
                type="color"
                value={normalizedCustomAccent ?? appearance.accentColor}
                onChange={(event) => {
                  const color = event.target.value.toUpperCase();
                  setCustomAccent(color);
                  appearance.setAccentColor(color);
                }}
              />
            </label>
            <input
              className="h-9 min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2 font-mono text-xs uppercase text-slate-900 outline-none focus:border-accent dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              value={customAccent}
              maxLength={7}
              spellCheck={false}
              aria-label="Codigo hexadecimal personalizado"
              onChange={(event) => setCustomAccent(event.target.value)}
              onBlur={applyCustomAccent}
              onKeyDown={(event) => {
                if (event.key === "Enter") applyCustomAccent();
              }}
            />
            <button
              type="button"
              className="primary-button h-9 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={!normalizedCustomAccent}
              onClick={applyCustomAccent}
            >
              Aplicar
            </button>
          </div>
          {!normalizedCustomAccent ? (
            <p className="mt-1.5 text-[11px] text-red-600 dark:text-red-400">
              Usa seis digitos hexadecimales, por ejemplo #2563EB.
            </p>
          ) : null}
        </section>

        <label className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs dark:border-slate-800 dark:bg-slate-900/70">
          <span>
            <span className="block font-medium">Limite del historial</span>
            <span className="mt-0.5 block text-[11px] text-slate-500 dark:text-slate-400">
              Elimina automaticamente solo elementos no protegidos.
            </span>
          </span>
          <select
            className="h-8 rounded-md border border-slate-200 bg-white px-2 text-slate-900 outline-none focus:border-accent dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            value={store.settings?.historyLimit ?? 50}
            onChange={(event) =>
              void store.updateHistoryLimit(Number(event.target.value) as AppSettings["historyLimit"])
            }
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
            <span className="mt-0.5 block text-[11px] text-slate-500 dark:text-slate-400">
              Mantiene el monitor activo desde el arranque.
            </span>
          </span>
          <input
            type="checkbox"
            className="size-4 accent-accent"
            checked={store.settings?.autoStart ?? false}
            onChange={(event) => void store.updateAutoStart(event.target.checked)}
          />
        </label>

        <section className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs dark:border-slate-800 dark:bg-slate-900/70">
          <div className="flex items-start justify-between gap-3">
            <span>
              <span className="block font-medium">Actualizaciones automaticas</span>
              <span className="mt-0.5 block text-[11px] text-slate-500 dark:text-slate-400">
                Descarga nuevas versiones y siempre pregunta antes de instalarlas.
              </span>
            </span>
            <input
              type="checkbox"
              className="mt-0.5 size-4 accent-accent"
              checked={appearance.autoUpdate}
              onChange={(event) => appearance.setAutoUpdate(event.target.checked)}
            />
          </div>

          <div className="mt-3 rounded-md border border-black/5 bg-white/70 p-2.5 dark:border-white/10 dark:bg-slate-950/70">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate font-medium">{getUpdaterLabel(updater)}</div>
                <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                  Version instalada: {updater.currentVersion || "cargando..."}
                </div>
              </div>
              {updater.phase === "ready" ? (
                <button className="primary-button h-8" type="button" onClick={updater.showReadyPrompt}>
                  Instalar
                </button>
              ) : (
                <button
                  className="icon-button"
                  type="button"
                  title="Buscar actualizaciones"
                  disabled={updater.phase === "checking" || updater.phase === "downloading"}
                  onClick={() => void updater.checkForUpdates()}
                >
                  <RefreshCw
                    size={15}
                    className={
                      updater.phase === "checking" || updater.phase === "downloading"
                        ? "animate-spin"
                        : ""
                    }
                    aria-hidden
                  />
                </button>
              )}
            </div>

            {updater.phase === "downloading" ? (
              <div className="mt-2">
                <div className="mb-1 flex justify-between text-[10px] text-slate-500 dark:text-slate-400">
                  <span className="flex items-center gap-1"><Download size={11} aria-hidden /> Descargando</span>
                  <span>{progress}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                  <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${progress}%` }} />
                </div>
              </div>
            ) : null}

            {updater.error ? (
              <p className="mt-2 text-[11px] text-red-600 dark:text-red-400">{updater.error}</p>
            ) : null}
          </div>
        </section>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs dark:border-slate-800 dark:bg-slate-900/70">
          <span className="block font-medium">Atajo global</span>
          <span className="mt-1 block text-slate-500 dark:text-slate-400">
            {store.settings?.shortcut ?? "Ctrl+Alt+V"}
          </span>
        </div>
      </div>
    </section>
  );
}

function getUpdaterLabel(updater: AppUpdaterController) {
  switch (updater.phase) {
    case "checking":
      return "Buscando actualizaciones...";
    case "downloading":
      return "Descargando actualizacion...";
    case "upToDate":
      return "Clipboard Pro esta actualizado";
    case "ready":
      return `Version ${updater.update?.version ?? "nueva"} lista para instalar`;
    case "installing":
      return "Instalando y reiniciando...";
    case "error":
      return "No se pudo comprobar la actualizacion";
    default:
      return "Buscar nuevas versiones";
  }
}
