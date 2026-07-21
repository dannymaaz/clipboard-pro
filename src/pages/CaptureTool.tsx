import { Camera, Copy, Monitor, MousePointer2, SquareDashedMousePointer, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { clipboardService, type CapturePreview, type CaptureWindow } from "../services/clipboardService";

type CaptureMode = "area" | "screen" | "window";
type Point = { x: number; y: number };

export function CaptureTool({ tool }: { tool: "capture" | "color" }) {
  const imageRef = useRef<HTMLImageElement>(null);
  const [preview, setPreview] = useState<CapturePreview | null>(null);
  const [mode, setMode] = useState<CaptureMode>(tool === "color" ? "area" : "area");
  const [start, setStart] = useState<Point | null>(null);
  const [end, setEnd] = useState<Point | null>(null);
  const [windows, setWindows] = useState<CaptureWindow[]>([]);
  const [message, setMessage] = useState("Preparando captura…");

  useEffect(() => {
    void clipboardService.getCapturePreview().then((value) => {
      setPreview(value);
      setMessage(tool === "color" ? "Haz clic sobre cualquier píxel para copiar su color." : "Elige un modo de captura.");
    }).catch((error) => setMessage(error instanceof Error ? error.message : "No se pudo preparar la captura."));
    const cancel = (event: KeyboardEvent) => {
      if (event.key === "Escape") void close();
    };
    window.addEventListener("keydown", cancel);
    return () => window.removeEventListener("keydown", cancel);
  }, [tool]);

  const selection = useMemo(() => {
    if (!start || !end) return null;
    return {
      x: Math.min(start.x, end.x),
      y: Math.min(start.y, end.y),
      width: Math.abs(end.x - start.x),
      height: Math.abs(end.y - start.y)
    };
  }, [end, start]);

  const mapPoint = (event: React.PointerEvent<HTMLImageElement>): Point | null => {
    if (!preview || !imageRef.current) return null;
    const rect = imageRef.current.getBoundingClientRect();
    const scale = Math.min(rect.width / preview.width, rect.height / preview.height);
    const renderedWidth = preview.width * scale;
    const renderedHeight = preview.height * scale;
    const left = rect.left + (rect.width - renderedWidth) / 2;
    const top = rect.top + (rect.height - renderedHeight) / 2;
    if (event.clientX < left || event.clientX > left + renderedWidth || event.clientY < top || event.clientY > top + renderedHeight) return null;
    return {
      x: Math.min(preview.width - 1, Math.max(0, Math.floor((event.clientX - left) / scale))),
      y: Math.min(preview.height - 1, Math.max(0, Math.floor((event.clientY - top) / scale)))
    };
  };

  const toDisplay = (point: Point) => {
    if (!preview || !imageRef.current) return null;
    const rect = imageRef.current.getBoundingClientRect();
    const scale = Math.min(rect.width / preview.width, rect.height / preview.height);
    return {
      left: (rect.width - preview.width * scale) / 2 + point.x * scale,
      top: (rect.height - preview.height * scale) / 2 + point.y * scale,
      scale
    };
  };

  const close = async () => {
    await clipboardService.closeCaptureTool().catch(() => undefined);
  };

  const saveRegion = async (region: { x: number; y: number; width: number; height: number }) => {
    setMessage("Guardando captura…");
    try {
      await clipboardService.saveCaptureRegion(region.x, region.y, region.width, region.height);
      setMessage("Captura copiada, guardada e incluida en el historial.");
      window.setTimeout(() => void close(), 450);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo guardar la captura.");
    }
  };

  const chooseWindowMode = async () => {
    setMode("window");
    setMessage("Elige la ventana que deseas capturar.");
    try {
      const options = await clipboardService.listCaptureWindows();
      setWindows(options.filter((window) => !/Clipboard Pro/i.test(window.title)));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudieron leer las ventanas.");
    }
  };

  const chooseWindow = async (id: number) => {
    setMessage("Capturando ventana…");
    try {
      await clipboardService.saveCaptureWindow(id);
      setMessage("Captura copiada, guardada e incluida en el historial.");
      window.setTimeout(() => void close(), 450);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo capturar la ventana.");
    }
  };

  const displayedSelection = selection && toDisplay({ x: selection.x, y: selection.y });
  const displayedEnd = selection && toDisplay({ x: selection.x + selection.width, y: selection.y + selection.height });

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-black text-white select-none">
      {preview ? <img ref={imageRef} src={preview.dataUrl} alt="Vista previa de la pantalla" draggable={false} className="h-full w-full object-contain" onPointerDown={(event) => {
        const point = mapPoint(event);
        if (!point) return;
        if (tool === "color") {
          void clipboardService.pickCaptureColor(point.x, point.y).then((color) => {
            setMessage(`${color} copiado al portapapeles.`);
            window.setTimeout(() => void close(), 550);
          }).catch((error) => setMessage(error instanceof Error ? error.message : "No se pudo copiar el color."));
          return;
        }
        if (mode === "area") {
          event.currentTarget.setPointerCapture(event.pointerId);
          setStart(point);
          setEnd(point);
        }
      }} onPointerMove={(event) => {
        if (tool !== "color" && mode === "area" && start) setEnd(mapPoint(event));
      }} onPointerUp={(event) => {
        if (tool !== "color" && mode === "area" && start) {
          const point = mapPoint(event);
          if (point) setEnd(point);
        }
      }} /> : null}

      {displayedSelection && displayedEnd ? <div className="pointer-events-none absolute border-2 border-cyan-300 bg-cyan-300/10" style={{ left: displayedSelection.left, top: displayedSelection.top, width: Math.max(1, displayedEnd.left - displayedSelection.left), height: Math.max(1, displayedEnd.top - displayedSelection.top) }} /> : null}

      <section className="absolute left-1/2 top-5 w-[min(94vw,720px)] -translate-x-1/2 rounded-2xl border border-white/20 bg-slate-950/90 p-3 shadow-2xl backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">{tool === "color" ? "Copiador de colores" : "Captura de pantalla"}</p>
            <p className="text-xs text-slate-300">{message}</p>
          </div>
          <button type="button" className="rounded-lg p-2 hover:bg-white/10" title="Cancelar" onClick={() => void close()}><X size={18} /></button>
        </div>

        {tool === "capture" ? <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" className={`rounded-lg px-3 py-2 text-xs ${mode === "area" ? "bg-cyan-500 text-slate-950" : "bg-white/10 hover:bg-white/20"}`} onClick={() => { setMode("area"); setStart(null); setEnd(null); setMessage("Arrastra sobre el área que quieres capturar."); }}><SquareDashedMousePointer className="mr-1 inline" size={14} /> Área</button>
          <button type="button" className="rounded-lg bg-white/10 px-3 py-2 text-xs hover:bg-white/20" onClick={() => preview && void saveRegion({ x: 0, y: 0, width: preview.width, height: preview.height })}><Monitor className="mr-1 inline" size={14} /> Pantalla completa</button>
          <button type="button" className={`rounded-lg px-3 py-2 text-xs ${mode === "window" ? "bg-cyan-500 text-slate-950" : "bg-white/10 hover:bg-white/20"}`} onClick={() => void chooseWindowMode()}><Camera className="mr-1 inline" size={14} /> Ventana</button>
          {selection && mode === "area" && selection.width > 2 && selection.height > 2 ? <button type="button" className="rounded-lg bg-cyan-500 px-3 py-2 text-xs font-semibold text-slate-950" onClick={() => void saveRegion(selection)}><Copy className="mr-1 inline" size={14} /> Capturar selección</button> : null}
        </div> : <div className="mt-3 flex items-center gap-2 text-xs text-slate-200"><MousePointer2 size={15} /> Pasa el cursor y haz clic sobre el color que deseas copiar.</div>}

        {mode === "window" && tool === "capture" ? <div className="custom-scrollbar mt-3 max-h-44 overflow-y-auto rounded-lg border border-white/10 bg-black/25 p-1">
          {windows.length ? windows.map((window) => <button key={window.id} type="button" className="flex w-full items-center justify-between gap-4 rounded-md px-3 py-2 text-left text-xs hover:bg-white/10" onClick={() => void chooseWindow(window.id)}><span className="truncate">{window.title}</span><span className="shrink-0 text-slate-400">{window.appName}</span></button>) : <p className="p-3 text-xs text-slate-300">No hay ventanas disponibles.</p>}
        </div> : null}
      </section>
    </main>
  );
}
