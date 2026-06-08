import { Search } from "lucide-react";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

export function SearchBar({ value, onChange }: SearchBarProps) {
  return (
    <label className="flex h-12 items-center gap-3 border-b border-black/10 px-4 dark:border-white/10">
      <Search size={18} className="text-slate-500 dark:text-slate-400" aria-hidden />
      <input
        autoFocus
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Buscar"
        className="min-w-0 flex-1 bg-transparent text-sm text-slate-950 outline-none placeholder:text-slate-500 dark:text-white dark:placeholder:text-slate-400"
      />
    </label>
  );
}
