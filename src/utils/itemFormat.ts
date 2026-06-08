import { FileText, Globe2, Image, Clipboard } from "lucide-react";
import type { ClipboardItem } from "../types/clipboard";

export const itemKindMeta = {
  text: { label: "Texto", Icon: Clipboard },
  url: { label: "URL", Icon: Globe2 },
  image: { label: "Imagen", Icon: Image },
  document: { label: "Documento", Icon: FileText }
} as const;

export function getItemTitle(item: ClipboardItem) {
  return item.title?.trim() || item.preview || item.content;
}

export function getItemSubtitle(item: ClipboardItem) {
  if (item.title && item.preview) return item.preview;
  return item.kind === "url" ? item.content.replace(/^https?:\/\//, "") : item.content;
}
