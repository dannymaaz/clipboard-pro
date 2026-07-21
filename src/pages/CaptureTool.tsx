import { Camera, Check, Copy, Monitor, MousePointer2, Pipette, SquareDashedMousePointer, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { clipboardService, type CapturePreview, type CaptureWindow } from "../services/clipboardService";

type CaptureMode = "area" | "screen" | "window";
type Point = { x: number; y: number };
type ColorSample = Point & { value: string };

export function CaptureTool({ tool }: { tool: "capture" | "color" }) {
  const imageRef = useRef<HTMLImageElement>(null);
  const captureLock = useRef(false);
  const colorRequestInFlight = useRef(false);
  const lastColorSampleAt = useRef(0);
  const [preview, setPreview] = useState<CapturePreview | null>(null);
  const [mode, setMode] = useState<CaptureMode>(tool === "color" ? "area" : "area");
  const [start, setStart] = useState<Point | null>(null);
  const [end, setEnd] = useState<Point | null>(null);
  const [windows, setWindows] = useState<CaptureWindow[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isCaptured, setIsCaptured] = useState(false);
  const [colorSample, setColorSample] = useState<ColorSample | null>(null);
  const [isColorCopied, setIsColorCopied] = useState(false);
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
    if (captureLock.current || isCaptured) return;
    captureLock.current = true;
    setIsSaving(true);
    let completed = false;
    setMessage("Guardando captura…");
    try {
      await clipboardService.saveCaptureRegion(region.x, region.y, region.width, region.height);
      completed = true;
      setIsCaptured(true);
      setMessage("Captura copiada, guardada e incluida en el historial.");
      window.setTimeout(() => void close(), 1000);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo guardar la captura.");
    } finally {
      setIsSaving(false);
      if (!completed) captureLock.current = false;
    }
  };

  const updateColorSample = (event: React.PointerEvent<HTMLImageElement>) => {
    const point = mapPoint(event);
    if (!point || colorRequestInFlight.current || isColorCopied || Date.now() - lastColorSampleAt.current < 40) return;
    const x = event.clientX;
    const y = event.clientY;
    lastColorSampleAt.current = Date.now();
    colorRequestInFlight.current = true;
    void clipboardService.previewCaptureColor(point.x, point.y)
      .then((value) => setColorSample({ value, x, y }))
      .catch(() => undefined)
      .finally(() => { colorRequestInFlight.current = false; });
  };

  const pickColor = (event: React.PointerEvent<HTMLImageElement>) => {
    const point = mapPoint(event);
    if (!point || captureLock.current || isColorCopied) return;
    const x = event.clientX;
    const y = event.clientY;
    captureLock.current = true;
    void clipboardService.pickCaptureColor(point.x, point.y).then((value) => {
      setColorSample({ value, x, y });
      setIsColorCopied(true);
      setMessage(`${value} copiado al portapapeles y guardado en el historial.`);
      window.setTimeout(() => void close(), 1000);
    }).catch((error) => {
      captureLock.current = false;
      setMessage(error instanceof Error ? error.message : "No se pudo copiar el color.");
    });
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
    if (captureLock.current || isCaptured) return;
    captureLock.current = true;
    setIsSaving(true);
    let completed = false;
    setMessage("Capturando ventana…");
    try {
      await clipboardService.saveCaptureWindow(id);
      completed = true;
      setIsCaptured(true);
      setMessage("Captura copiada, guardada e incluida en el historial.");
      window.setTimeout(() => void close(), 1000);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo capturar la ventana.");
    } finally {
      setIsSaving(false);
      if (!completed) captureLock.current = false;
    }
  };

  const displayedSelection = selection && toDisplay({ x: selection.x, y: selection.y });
  const displayedEnd = selection && toDisplay({ x: selection.x + selection.width, y: selection.y + selection.height });

  return (
    <main className={`relative h-screen w-screen overflow-hidden bg-black text-white select-none ${tool === "color" ? "cursor-none" : ""}`}>
      {preview ? <img ref={imageRef} src={preview.dataUrl} alt="Vista previa de la pantalla" draggable={false} className="h-full w-full object-contain" onPointerDown={(event) => {
        const point = mapPoint(event);
        if (!point) return;
        if (tool === "color") {
          pickColor(event);
          return;
        }
        if (mode === "area" && !isSaving && !isCaptured) {
          if (selection && selection.width > 2 && selection.height > 2) {
            void saveRegion(selection);
            return;
          }
          event.currentTarget.setPointerCapture(event.pointerId);
          setStart(point);
          setEnd(point);
          setMessage("Mueve el cursor para delimitar el area y haz clic otra vez para capturarla.");
        }
      }} onPointerMove={(event) => {
        if (tool === "color") {
          updateColorSample(event);
          return;
        }
        if (mode === "area" && start) setEnd(mapPoint(event));
      }} onPointerUp={(event) => {
        if (tool !== "color" && mode === "area" && start) {
          const point = mapPoint(event);
          if (point) setEnd(point);
        }
      }} onPointerLeave={() => { if (tool === "color") setColorSample(null); }} /> : null}

      {displayedSelection && displayedEnd ? <div className="pointer-events-none absolute border-2 border-cyan-300 bg-cyan-300/10" style={{ left: displayedSelection.left, top: displayedSelection.top, width: Math.max(1, displayedEnd.left - displayedSelection.left), height: Math.max(1, displayedEnd.top - displayedSelection.top) }} /> : null}

      {isCaptured ? <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center bg-slate-950/35 backdrop-blur-[2px]">
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-300/40 bg-slate-950/95 px-5 py-4 shadow-2xl">
          <span className="grid size-10 place-items-center rounded-full bg-emerald-400 text-slate-950 animate-pulse"><Check size={23} strokeWidth={3} /></span>
          <div>
            <p className="text-sm font-semibold">Captura lista</p>
            <p className="text-xs text-slate-300">Copiada al portapapeles y guardada.</p>
          </div>
        </div>
      </div> : null}

      {tool === "color" && colorSample ? <div className="pointer-events-none absolute z-30 flex items-center gap-2" style={{ left: colorSample.x + 18, top: colorSample.y + 18 }}>
        <span className="grid size-9 place-items-center rounded-full border-2 border-white bg-slate-950 text-white shadow-xl"><Pipette size={18} /></span>
        <span className="flex items-center gap-2 rounded-lg border border-white/30 bg-slate-950/95 px-2 py-1.5 text-xs font-semibold shadow-xl">
          <span className="size-5 rounded border border-white/40" style={{ backgroundColor: colorSample.value }} />
          {colorSample.value}
        </span>
      </div> : null}

      <section className={tool === "color" ? "absolute bottom-5 left-1/2 w-max max-w-[94vw] -translate-x-1/2 rounded-xl border border-white/20 bg-slate-950/90 px-3 py-2 shadow-2xl backdrop-blur" : "absolute left-1/2 top-5 w-[min(94vw,720px)] -translate-x-1/2 rounded-2xl border border-white/20 bg-slate-950/90 p-3 shadow-2xl backdrop-blur"}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">{tool === "color" ? "Copiador de colores" : "Captura de pantalla"}</p>
            <p className="text-xs text-slate-300">{message}</p>
          </div>
          <button type="button" className="rounded-lg p-2 hover:bg-white/10" title="Cancelar" onClick={() => void close()}><X size={18} /></button>
        </div>

        {tool === "capture" ? <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" className={`rounded-lg px-3 py-2 text-xs ${mode === "area" ? "bg-cyan-500 text-slate-950" : "bg-white/10 hover:bg-white/20"}`} onClick={() => { setMode("area"); setStart(null); setEnd(null); setMessage("Haz clic, delimita el área moviendo el cursor y haz clic otra vez para capturar."); }}><SquareDashedMousePointer className="mr-1 inline" size={14} /> Área</button>
          <button type="button" className="rounded-lg bg-white/10 px-3 py-2 text-xs hover:bg-white/20" onClick={() => preview && void saveRegion({ x: 0, y: 0, width: preview.width, height: preview.height })}><Monitor className="mr-1 inline" size={14} /> Pantalla completa</button>
          <button type="button" className={`rounded-lg px-3 py-2 text-xs ${mode === "window" ? "bg-cyan-500 text-slate-950" : "bg-white/10 hover:bg-white/20"}`} onClick={() => void chooseWindowMode()}><Camera className="mr-1 inline" size={14} /> Ventana</button>
          {selection && mode === "area" && selection.width > 2 && selection.height > 2 ? <button type="button" className="rounded-lg bg-cyan-500 px-3 py-2 text-xs font-semibold text-slate-950" onClick={() => void saveRegion(selection)}><Copy className="mr-1 inline" size={14} /> Capturar selección</button> : null}
        </div> : <div className="mt-1 flex items-center gap-2 text-xs text-slate-200"><MousePointer2 size={15} /> Mueve el cuentagotas y haz clic para copiar el color.</div>}

        {mode === "window" && tool === "capture" ? <div className="custom-scrollbar mt-3 max-h-44 overflow-y-auto rounded-lg border border-white/10 bg-black/25 p-1">
          {windows.length ? windows.map((window) => <button key={window.id} type="button" className="flex w-full items-center justify-between gap-4 rounded-md px-3 py-2 text-left text-xs hover:bg-white/10" onClick={() => void chooseWindow(window.id)}><span className="truncate">{window.title}</span><span className="shrink-0 text-slate-400">{window.appName}</span></button>) : <p className="p-3 text-xs text-slate-300">No hay ventanas disponibles.</p>}
        </div> : null}
      </section>
    </main>
  );
}
