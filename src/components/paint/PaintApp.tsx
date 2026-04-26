import { useCallback, useEffect, useRef, useState } from "react";
import { Pencil, Brush, Eraser, PaintBucket, Pipette, Trash2, Download, Undo2, Redo2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type Tool = "pencil" | "brush" | "eraser" | "fill" | "picker";

const PRESET_COLORS = [
  "#000000", "#7f7f7f", "#880015", "#ed1c24", "#ff7f27", "#fff200",
  "#22b14c", "#00a2e8", "#3f48cc", "#a349a4", "#ffffff", "#c3c3c3",
  "#b97a57", "#ffaec9", "#ffc90e", "#efe4b0", "#b5e61d", "#99d9ea",
  "#7092be", "#c8bfe7",
];

interface ToolBtn {
  id: Tool;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  shortcut: string;
}

const TOOLS: ToolBtn[] = [
  { id: "pencil", icon: Pencil, label: "Pencil", shortcut: "P" },
  { id: "brush", icon: Brush, label: "Brush", shortcut: "B" },
  { id: "eraser", icon: Eraser, label: "Eraser", shortcut: "E" },
  { id: "fill", icon: PaintBucket, label: "Fill bucket", shortcut: "F" },
  { id: "picker", icon: Pipette, label: "Color picker", shortcut: "I" },
];

export const PaintApp = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const historyRef = useRef<ImageData[]>([]);
  const historyIndexRef = useRef(-1);

  const [tool, setTool] = useState<Tool>("pencil");
  const [color, setColor] = useState("#000000");
  const [size, setSize] = useState(6);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // Initialize canvas to fill its container, preserving content on resize.
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ratio = window.devicePixelRatio || 1;
    const { width, height } = container.getBoundingClientRect();

    // Save existing pixels
    const prev = document.createElement("canvas");
    prev.width = canvas.width;
    prev.height = canvas.height;
    const pctx = prev.getContext("2d");
    if (pctx && canvas.width && canvas.height) {
      pctx.drawImage(canvas, 0, 0);
    }

    canvas.width = Math.floor(width * ratio);
    canvas.height = Math.floor(height * ratio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    if (prev.width && prev.height) {
      ctx.drawImage(prev, 0, 0, prev.width / ratio, prev.height / ratio);
    }
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  useEffect(() => {
    resizeCanvas();
    pushHistory();
    const ro = new ResizeObserver(() => resizeCanvas());
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
        return;
      }
      const map: Record<string, Tool> = { p: "pencil", b: "brush", e: "eraser", f: "fill", i: "picker" };
      const t = map[e.key.toLowerCase()];
      if (t && !e.ctrlKey && !e.metaKey) setTool(t);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getCtx = () => canvasRef.current?.getContext("2d") ?? null;

  const pushHistory = () => {
    const canvas = canvasRef.current;
    const ctx = getCtx();
    if (!canvas || !ctx) return;
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    // drop redo branch
    historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);
    historyRef.current.push(data);
    // cap history length
    if (historyRef.current.length > 40) {
      historyRef.current.shift();
    }
    historyIndexRef.current = historyRef.current.length - 1;
    setCanUndo(historyIndexRef.current > 0);
    setCanRedo(false);
  };

  const restoreFromHistory = () => {
    const ctx = getCtx();
    const data = historyRef.current[historyIndexRef.current];
    if (!ctx || !data) return;
    // Reset transform so putImageData uses raw pixel coords, then restore.
    const ratio = window.devicePixelRatio || 1;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.putImageData(data, 0, 0);
    ctx.restore();
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    setCanUndo(historyIndexRef.current > 0);
    setCanRedo(historyIndexRef.current < historyRef.current.length - 1);
  };

  const undo = () => {
    if (historyIndexRef.current <= 0) return;
    historyIndexRef.current -= 1;
    restoreFromHistory();
  };

  const redo = () => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    historyIndexRef.current += 1;
    restoreFromHistory();
  };

  const getPos = (e: PointerEvent | React.PointerEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const drawLine = (from: { x: number; y: number }, to: { x: number; y: number }) => {
    const ctx = getCtx();
    if (!ctx) return;
    ctx.globalCompositeOperation = tool === "eraser" ? "destination-out" : "source-over";
    ctx.strokeStyle = color;
    ctx.lineWidth = tool === "pencil" ? Math.max(1, Math.round(size / 3)) : size;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
  };

  // Flood fill using a stack (4-way).
  const floodFill = (startX: number, startY: number, hex: string) => {
    const canvas = canvasRef.current;
    const ctx = getCtx();
    if (!canvas || !ctx) return;
    const ratio = window.devicePixelRatio || 1;
    const x = Math.floor(startX * ratio);
    const y = Math.floor(startY * ratio);
    const w = canvas.width;
    const h = canvas.height;

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const img = ctx.getImageData(0, 0, w, h);
    const data = img.data;

    const idx = (px: number, py: number) => (py * w + px) * 4;
    const startIdx = idx(x, y);
    const sr = data[startIdx], sg = data[startIdx + 1], sb = data[startIdx + 2], sa = data[startIdx + 3];

    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);

    if (sr === r && sg === g && sb === b && sa === 255) {
      ctx.restore();
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      return;
    }

    const stack: number[] = [x, y];
    while (stack.length) {
      const py = stack.pop()!;
      const px = stack.pop()!;
      if (px < 0 || py < 0 || px >= w || py >= h) continue;
      const i = idx(px, py);
      if (data[i] !== sr || data[i + 1] !== sg || data[i + 2] !== sb || data[i + 3] !== sa) continue;
      data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = 255;
      stack.push(px + 1, py, px - 1, py, px, py + 1, px, py - 1);
    }

    ctx.putImageData(img, 0, 0);
    ctx.restore();
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  };

  const pickColorAt = (x: number, y: number) => {
    const canvas = canvasRef.current;
    const ctx = getCtx();
    if (!canvas || !ctx) return;
    const ratio = window.devicePixelRatio || 1;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const data = ctx.getImageData(Math.floor(x * ratio), Math.floor(y * ratio), 1, 1).data;
    ctx.restore();
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    const toHex = (n: number) => n.toString(16).padStart(2, "0");
    setColor(`#${toHex(data[0])}${toHex(data[1])}${toHex(data[2])}`);
    setTool("pencil");
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    (e.target as Element).setPointerCapture(e.pointerId);
    const pos = getPos(e);

    if (tool === "fill") {
      floodFill(pos.x, pos.y, color);
      pushHistory();
      return;
    }
    if (tool === "picker") {
      pickColorAt(pos.x, pos.y);
      return;
    }

    drawingRef.current = true;
    lastPointRef.current = pos;
    // Draw a starting dot
    drawLine(pos, pos);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const pos = getPos(e);
    const last = lastPointRef.current ?? pos;

    // Use coalesced events for smoother strokes when supported.
    const events = (e.nativeEvent.getCoalescedEvents?.() ?? []) as PointerEvent[];
    if (events.length > 1) {
      let prev = last;
      for (const ev of events) {
        const p = getPos(ev);
        drawLine(prev, p);
        prev = p;
      }
      lastPointRef.current = prev;
    } else {
      drawLine(last, pos);
      lastPointRef.current = pos;
    }
  };

  const endStroke = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    lastPointRef.current = null;
    pushHistory();
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = getCtx();
    if (!canvas || !ctx) return;
    const ratio = window.devicePixelRatio || 1;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    pushHistory();
  };

  const downloadPng = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = "painting.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  const cursorClass =
    tool === "picker" ? "cursor-crosshair" : tool === "fill" ? "cursor-cell" : "cursor-crosshair";

  return (
    <div className="flex h-screen w-screen flex-col bg-background text-foreground">
      {/* Top bar */}
      <header className="flex h-12 items-center justify-between border-b border-border bg-toolbar px-4 shadow-soft">
        <h1 className="text-sm font-semibold tracking-tight">Paint</h1>
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={undo} disabled={!canUndo} aria-label="Undo">
                <Undo2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Undo (⌘Z)</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={redo} disabled={!canRedo} aria-label="Redo">
                <Redo2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Redo (⌘⇧Z)</TooltipContent>
          </Tooltip>
          <div className="mx-2 h-5 w-px bg-border" />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={clearCanvas} aria-label="Clear canvas">
                <Trash2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Clear</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={downloadPng} aria-label="Download PNG">
                <Download className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Download</TooltipContent>
          </Tooltip>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left toolbar */}
        <aside className="flex w-16 flex-col items-center gap-1 border-r border-border bg-toolbar py-3 shadow-soft">
          {TOOLS.map((t) => {
            const Icon = t.icon;
            const active = tool === t.id;
            return (
              <Tooltip key={t.id}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setTool(t.id)}
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-md transition-colors",
                      active
                        ? "bg-tool-active text-accent-foreground"
                        : "text-foreground hover:bg-tool-hover",
                    )}
                    aria-label={t.label}
                    aria-pressed={active}
                  >
                    <Icon className="h-[18px] w-[18px]" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  {t.label} <span className="ml-1 text-muted-foreground">({t.shortcut})</span>
                </TooltipContent>
              </Tooltip>
            );
          })}

          <div className="my-2 h-px w-8 bg-border" />

          {/* Size control (vertical) */}
          <div className="mt-1 flex flex-col items-center gap-2">
            <div
              className="rounded-full border border-border"
              style={{
                width: Math.min(Math.max(size, 4), 28),
                height: Math.min(Math.max(size, 4), 28),
                backgroundColor: tool === "eraser" ? "#ffffff" : color,
              }}
              aria-hidden
            />
            <div className="h-32">
              <Slider
                orientation="vertical"
                value={[size]}
                min={1}
                max={48}
                step={1}
                onValueChange={(v) => setSize(v[0])}
                aria-label="Brush size"
              />
            </div>
            <span className="text-[10px] tabular-nums text-muted-foreground">{size}px</span>
          </div>
        </aside>

        {/* Canvas */}
        <main className="flex flex-1 items-stretch justify-stretch bg-secondary p-4">
          <div
            ref={containerRef}
            className="relative h-full w-full overflow-hidden rounded-lg border border-border bg-canvas shadow-panel"
          >
            <canvas
              ref={canvasRef}
              className={cn("block h-full w-full touch-none select-none", cursorClass)}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={endStroke}
              onPointerCancel={endStroke}
              onPointerLeave={endStroke}
            />
          </div>
        </main>
      </div>

      {/* Bottom palette */}
      <footer className="flex items-center gap-4 border-t border-border bg-toolbar px-4 py-3 shadow-soft">
        <div className="flex items-center gap-2">
          <span
            className="h-7 w-7 rounded-md border border-border shadow-soft"
            style={{ backgroundColor: color }}
            aria-label="Current color"
          />
          <label className="relative inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-tool-hover">
            <Pipette className="h-3.5 w-3.5" />
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              aria-label="Custom color"
            />
          </label>
        </div>

        <div className="mx-1 h-7 w-px bg-border" />

        <div className="grid grid-cols-10 gap-1.5">
          {PRESET_COLORS.map((c) => {
            const active = c.toLowerCase() === color.toLowerCase();
            return (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={cn(
                  "h-6 w-6 rounded-md border transition-transform hover:scale-110",
                  active ? "border-tool-active ring-2 ring-tool-active/40" : "border-border",
                )}
                style={{ backgroundColor: c }}
                aria-label={`Color ${c}`}
              />
            );
          })}
        </div>

        <div className="ml-auto text-xs text-muted-foreground">
          {TOOLS.find((t) => t.id === tool)?.label}
        </div>
      </footer>
    </div>
  );
};

export default PaintApp;
