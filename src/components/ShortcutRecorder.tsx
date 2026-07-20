import { CircleHelp, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import type { DesktopPlatform } from "../services/clipboardService";

type ShortcutSlot = 0 | 1 | 2;

interface ShortcutRecorderProps {
  defaultShortcut: string;
  label: string;
  platform: DesktopPlatform;
  value: string;
  onSave: (shortcut: string) => Promise<void>;
}

const modifierKeys = new Set(["Control", "Alt", "Shift", "Meta"]);

export function ShortcutRecorder({ defaultShortcut, label, platform, value, onSave }: ShortcutRecorderProps) {
  const [slots, setSlots] = useState(() => parseShortcut(value, platform));
  const [recording, setRecording] = useState<ShortcutSlot | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [previous, setPrevious] = useState(value);

  useEffect(() => setSlots(parseShortcut(value, platform)), [platform, value]);

  const shortcut = useMemo(() => slots.filter(Boolean).join("+"), [slots]);
  const isValid = slots.filter(Boolean).length >= 2 && slots.some((slot) => slot && !isModifier(slot));

  const beginRecording = (slot: ShortcutSlot) => {
    setMessage(null);
    setRecording(slot);
  };

  const recordKey = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (recording === null) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.key === "Escape") {
      setRecording(null);
      return;
    }

    const key = normalizeKey(event.key, platform);
    if (!key) return;
    const next = [...slots] as [string, string, string];
    next[recording] = key;
    setSlots(normalizeSlots(next));
    setRecording(recording === 2 ? null : ((recording + 1) as ShortcutSlot));
  };

  const save = async () => {
    if (!isValid) {
      setMessage("Usa al menos un modificador y una tecla final.");
      return;
    }
    try {
      await onSave(shortcut);
      setPrevious(value);
      setMessage("Atajo guardado y comprobado por el sistema.");
    } catch (error) {
      setSlots(parseShortcut(value, platform));
      setMessage(error instanceof Error ? error.message : "Ese atajo no está disponible.");
    }
  };

  const restore = async (nextValue: string) => {
    try {
      await onSave(nextValue);
      setSlots(parseShortcut(nextValue, platform));
      setMessage("Atajo restaurado.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo restaurar el atajo.");
    }
  };

  return (
    <div className="theme-surface rounded-xl p-3 text-xs">
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className="font-semibold">{label}</span>
          <p className="mt-0.5 text-[11px] text-theme-muted">Toca un cuadro y presiona la tecla que deseas grabar.</p>
        </div>
        <span className="group relative text-theme-muted" tabIndex={0} aria-label="Ayuda para grabar atajos">
          <CircleHelp size={15} aria-hidden />
          <span className="pointer-events-none absolute right-0 top-5 z-20 hidden w-52 rounded-lg bg-slate-950 p-2 text-[11px] leading-4 text-white shadow-xl group-focus:block group-hover:block">Ejemplo: toca el primer cuadro y presiona {platform === "macos" ? "Command" : "Ctrl"}; toca el segundo y presiona Alt; toca el último y presiona V.</span>
        </span>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        {slots.map((slot, index) => (
          <button
            key={index}
            type="button"
            onClick={() => beginRecording(index as ShortcutSlot)}
            onKeyDown={recordKey}
            className={clsx("shortcut-slot", recording === index && "shortcut-slot-recording")}
          >
            {recording === index ? "Presiona…" : slot || "Opcional"}
          </button>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-theme-muted">{recording !== null ? "Grabando: presiona una tecla, o Esc para cancelar." : `Combinación: ${shortcut || "sin configurar"}`}</p>
      {message ? <p className="mt-1 text-[11px] text-theme-muted" role="status">{message}</p> : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <button className="primary-button h-8 px-3 text-[11px]" type="button" onClick={() => void save()} disabled={!isValid}>Guardar</button>
        <button className="text-button flex h-8 items-center gap-1 px-2 text-[11px]" type="button" onClick={() => void restore(previous)}><RotateCcw size={13} /> Restaurar anterior</button>
        <button className="text-button h-8 px-2 text-[11px]" type="button" onClick={() => void restore(defaultShortcut)}>Predeterminado</button>
      </div>
    </div>
  );
}

function parseShortcut(shortcut: string, platform: DesktopPlatform): [string, string, string] {
  const values = shortcut.split("+").map((part) => displayKey(part.trim(), platform)).filter(Boolean);
  const modifiers = values.filter(isModifier);
  const key = values.find((value) => !isModifier(value)) ?? "";
  return [modifiers[0] ?? "", modifiers[1] ?? "", key];
}

function normalizeSlots(slots: [string, string, string]): [string, string, string] {
  const unique = slots.filter((slot, index) => slot && slots.indexOf(slot) === index);
  const modifiers = unique.filter(isModifier);
  const key = unique.find((slot) => !isModifier(slot)) ?? "";
  return [modifiers[0] ?? "", modifiers[1] ?? "", key];
}

function normalizeKey(key: string, platform: DesktopPlatform) {
  if (key === "Control") return "Ctrl";
  if (key === "Meta") return platform === "macos" ? "Command" : "Super";
  if (key === "Alt" || key === "Shift") return key;
  if (modifierKeys.has(key) || key.length === 1) return key.length === 1 ? key.toUpperCase() : "";
  if (/^F\d{1,2}$/.test(key) || ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space", "Enter"].includes(key)) return key;
  return "";
}

function displayKey(key: string, platform: DesktopPlatform) {
  if (key === "Ctrl" || key === "Control") return "Ctrl";
  if (["Command", "Cmd", "Super"].includes(key)) return platform === "macos" ? "Command" : "Super";
  return key;
}

function isModifier(key: string) {
  return ["Ctrl", "Alt", "Shift", "Command", "Super"].includes(key);
}
