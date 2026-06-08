import { X } from "lucide-react";
import { useEffect, useState } from "react";

interface InlineDialogProps {
  title: string;
  label: string;
  initialValue?: string;
  onClose: () => void;
  onSubmit: (value: string) => void;
  multiline?: boolean;
}

export function InlineDialog({ title, label, initialValue = "", onClose, onSubmit, multiline }: InlineDialogProps) {
  const [value, setValue] = useState(initialValue);

  useEffect(() => setValue(initialValue), [initialValue]);

  return (
    <div className="absolute inset-0 z-20 grid place-items-center bg-slate-950/20 p-4 backdrop-blur-sm dark:bg-black/40">
      <form
        className="w-full max-w-sm rounded-lg border border-black/10 bg-white p-4 shadow-panel dark:border-white/10 dark:bg-slate-950"
        onSubmit={(event) => {
          event.preventDefault();
          if (value.trim()) onSubmit(value.trim());
        }}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-950 dark:text-white">{title}</h2>
          <button className="icon-button" type="button" onClick={onClose} title="Cerrar">
            <X size={16} aria-hidden />
          </button>
        </div>
        <label className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</label>
        {multiline ? (
          <textarea
            className="mt-2 h-36 w-full resize-none rounded-md border border-black/10 bg-transparent p-3 text-sm outline-none focus:border-accent dark:border-white/10"
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
        ) : (
          <input
            className="mt-2 h-10 w-full rounded-md border border-black/10 bg-transparent px-3 text-sm outline-none focus:border-accent dark:border-white/10"
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button className="text-button" type="button" onClick={onClose}>
            Cancelar
          </button>
          <button className="primary-button" type="submit">
            Guardar
          </button>
        </div>
      </form>
    </div>
  );
}
