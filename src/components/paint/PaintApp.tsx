import { useCallback, useEffect, useRef, useState } from "react";
import {
  Pencil,
  Brush,
  Eraser,
  PaintBucket,
  Pipette,
  Trash2,
  Download,
  Undo2,
  Redo2,
  Square,
  Circle,
  Minus,
  Triangle,
  Type,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Tool =
  | "pencil"
  | "brush"
  | "eraser"
  | "fill"
  | "picker"
  | "rectangle"
  | "circle"
  | "line"
  | "triangle"
  | "text";

const SHAPE_TOOLS: Tool[] = ["rectangle", "circle", "line", "triangle"];

const PRESET_COLORS = [
  "#000000", "#7f7f7f", "#880015", "#ed1c24", "#ff7f27", "#fff200",
  "#22b14c", "#00a2e8", "#3f48cc", "#a349a4", "#ffffff", "#c3c3c3",
  "#b97a57", "#ffaec9", "#ffc90e", "#efe4b0", "#b5e61d", "#99d9ea",
  "#7092be", "#c8bfe7",
];

const FONT_FAMILIES = [
  "Inter, system-ui, sans-serif",
  "Georgia, serif",
  "'Times New Roman', Times, serif",
  "'Courier New', monospace",
  "'Comic Sans MS', cursive",
  "Impact, sans-serif",
];

const FONT_LABELS: Record<string, string> = {
  "Inter, system-ui, sans-serif": "Sans",
  "Georgia, serif": "Georgia",
  "'Times New Roman', Times, serif": "Times",
  "'Courier New', monospace": "Mono",
  "'Comic Sans MS', cursive": "Comic",
  "Impact, sans-serif": "Impact",
};

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
  { id: "rectangle", icon: Square, label: "Rectangle", shortcut: "R" },
  { id: "circle", icon: Circle, label: "Ellipse", shortcut: "O" },
  { id: "line", icon: Minus, label: "Line", shortcut: "L" },
  { id: "triangle", icon: Triangle, label: "Triangle", shortcut: "G" },
  { id: "text", icon: Type, label: "Text", shortcut: "T" },
];

interface Point {
  x: number;
  y: number;
}

interface TextEditor {
  x: number;
  y: number;
  value: string;
}

export const PaintApp = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const drawingRef = useRef(false);
  const lastPointRef = useRef<Point | null>(null);
  const shapeStartRef = useRef<Point | null>(null);

  const historyRef = useRef<ImageData[]>([]);
  const historyIndexRef = useRef(-1);

  const textInputRef = useRef<HTMLTextAreaElement>(null);

  const [tool, setTool] = useState<Tool>("pencil");
  const [color, setColor] = useState("#000000");
  const [size, setSize] = useState(6);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const [fontSize, setFontSize] = useState(24);
  const [fontFamily, setFontFamily] = useState(FONT_FAMILIES[0]);
  const [textEditor, setTextEditor] = useState<TextEditor | null>(null);

  // Keep latest tool/color/size in refs for stable handlers (not strictly required
  // since handlers are inline, but useful for clarity).
  const toolRef = useRef(tool);
  toolRef.current = tool;

  // Resize both canvases to match the container, preserving the main canvas content.
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const preview = previewRef.current;
    const container = containerRef.current;
    if (!canvas || !preview || !container) return;

    const ratio = window.devicePixelRatio || 1;
    const { width, height } = container.getBoundingClientRect();
    if (!width || !height) return;

    const targetW = Math.floor(width * ratio);
    const targetH = Math.floor(height * ratio);

    // Save existing pixels of main canvas
    const prev = document.createElement("canvas");
    prev.width = canvas.width;
    prev.height = canvas.height;
    const pctx = prev.getContext("2d");
    if (pctx && canvas.width && canvas.height) {
      pctx.drawImage(canvas, 0, 0);
    }

    for (const c of [canvas, preview]) {
      c.width = targetW;
      c.height = targetH;
      c.style.width = `${width}px`;
      c.style.height = `${height}px`;
      const cx = c.getContext("2d");
      if (cx) cx.setTransform(ratio, 0, 0, ratio, 0, 0);
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
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
    let raf = 0;
    const ro = new ResizeObserver(() => {
      // Defer to next frame to avoid the benign
      // "ResizeObserver loop completed with undelivered notifications" warning.
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => resizeCanvas());
    });
    if (containerRef.current) ro.observe(containerRef.current);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Ignore shortcuts while typing in the text editor or any input.
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;

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
      if (e.key === "Escape" && textEditor) {
        setTextEditor(null);
        return;
      }
      const map: Record<string, Tool> = {
        p: "pencil",
        b: "brush",
        e: "eraser",
        f: "fill",
        i: "picker",
        r: "rectangle",
        o: "circle",
        l: "line",
        g: "triangle",
        t: "text",
      };
      const t = map[e.key.toLowerCase()];
      if (t && !e.ctrlKey && !e.metaKey) setTool(t);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [textEditor]);

  // Auto-focus the text editor when it opens
  useEffect(() => {
    if (textEditor) {
      requestAnimationFrame(() => textInputRef.current?.focus());
    }
  }, [textEditor]);

  const getCtx = () => canvasRef.current?.getContext("2d") ?? null;
  const getPreviewCtx = () => previewRef.current?.getContext("2d") ?? null;

  const pushHistory = () => {
    const canvas = canvasRef.current;
    const ctx = getCtx();
    if (!canvas || !ctx) return;
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);
    historyRef.current.push(data);
    if (historyRef.current.length > 40) historyRef.current.shift();
    historyIndexRef.current = historyRef.current.length - 1;
    setCanUndo(historyIndexRef.current > 0);
    setCanRedo(false);
  };

  const restoreFromHistory = () => {
    const ctx = getCtx();
    const data = historyRef.current[historyIndexRef.current];
    if (!ctx || !data) return;
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

  const getPos = (e: PointerEvent | React.PointerEvent): Point => {
    const canvas = previewRef.current ?? canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const drawLine = (from: Point, to: Point) => {
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

  const configureShapeStroke = (ctx: CanvasRenderingContext2D) => {
    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1, size);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  };

  const drawShape = (
    ctx: CanvasRenderingContext2D,
    kind: Tool,
    a: Point,
    b: Point,
  ) => {
    configureShapeStroke(ctx);
    ctx.beginPath();
    if (kind === "rectangle") {
      const x = Math.min(a.x, b.x);
      const y = Math.min(a.y, b.y);
      const w = Math.abs(b.x - a.x);
      const h = Math.abs(b.y - a.y);
      ctx.rect(x, y, w, h);
      ctx.stroke();
    } else if (kind === "circle") {
      const cx = (a.x + b.x) / 2;
      const cy = (a.y + b.y) / 2;
      const rx = Math.abs(b.x - a.x) / 2;
      const ry = Math.abs(b.y - a.y) / 2;
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (kind === "line") {
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    } else if (kind === "triangle") {
      const x = Math.min(a.x, b.x);
      const y = Math.min(a.y, b.y);
      const w = Math.abs(b.x - a.x);
      const h = Math.abs(b.y - a.y);
      ctx.moveTo(x + w / 2, y);
      ctx.lineTo(x + w, y + h);
      ctx.lineTo(x, y + h);
      ctx.closePath();
      ctx.stroke();
    }
  };

  const clearPreview = () => {
    const preview = previewRef.current;
    const ctx = getPreviewCtx();
    if (!preview || !ctx) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, preview.width, preview.height);
    ctx.restore();
    const ratio = window.devicePixelRatio || 1;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  };

  // Flood fill (4-way).
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

  const commitText = () => {
    if (!textEditor) return;
    const ctx = getCtx();
    if (!ctx) {
      setTextEditor(null);
      return;
    }
    const value = textEditor.value;
    if (value.trim().length > 0) {
      ctx.save();
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = color;
      ctx.font = `${fontSize}px ${fontFamily}`;
      ctx.textBaseline = "top";
      const lines = value.split("\n");
      const lineHeight = Math.round(fontSize * 1.2);
      lines.forEach((line, i) => {
        ctx.fillText(line, textEditor.x, textEditor.y + i * lineHeight);
      });
      ctx.restore();
      pushHistory();
    }
    setTextEditor(null);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    (e.target as Element).setPointerCapture(e.pointerId);
    const pos = getPos(e);

    // If a text editor is open, commit it first when clicking elsewhere.
    if (textEditor) {
      commitText();
    }

    if (tool === "fill") {
      floodFill(pos.x, pos.y, color);
      pushHistory();
      return;
    }
    if (tool === "picker") {
      pickColorAt(pos.x, pos.y);
      return;
    }
    if (tool === "text") {
      setTextEditor({ x: pos.x, y: pos.y, value: "" });
      return;
    }
    if (SHAPE_TOOLS.includes(tool)) {
      drawingRef.current = true;
      shapeStartRef.current = pos;
      return;
    }

    // Free-draw tools: pencil, brush, eraser
    drawingRef.current = true;
    lastPointRef.current = pos;
    drawLine(pos, pos);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const pos = getPos(e);

    if (SHAPE_TOOLS.includes(tool) && shapeStartRef.current) {
      const ctx = getPreviewCtx();
      if (!ctx) return;
      clearPreview();
      drawShape(ctx, tool, shapeStartRef.current, pos);
      return;
    }

    const last = lastPointRef.current ?? pos;
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

  const endStroke = (e?: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;

    if (SHAPE_TOOLS.includes(tool) && shapeStartRef.current) {
      const end = e ? getPos(e) : shapeStartRef.current;
      const ctx = getCtx();
      if (ctx) drawShape(ctx, tool, shapeStartRef.current, end);
      clearPreview();
      shapeStartRef.current = null;
      drawingRef.current = false;
      pushHistory();
      return;
    }

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
    tool === "picker"
      ? "cursor-crosshair"
      : tool === "fill"
      ? "cursor-cell"
      : tool === "text"
      ? "cursor-text"
      : "cursor-crosshair";

  const showTextOptions = tool === "text" || textEditor !== null;

  return (
    <div className="flex h-screen w-screen flex-col bg-background text-foreground">
      {/* Top bar */}
      <header className="flex h-12 items-center justify-between border-b border-border bg-toolbar px-4 shadow-soft">
        <h1 className="text-sm font-semibold tracking-tight">Paint</h1>
        <div className="flex items-center gap-1">
          {showTextOptions && (
            <div className="mr-2 flex items-center gap-2">
              <Select value={fontFamily} onValueChange={setFontFamily}>
                <SelectTrigger className="h-8 w-[120px] text-xs">
                  <SelectValue placeholder="Font" />
                </SelectTrigger>
                <SelectContent>
                  {FONT_FAMILIES.map((f) => (
                    <SelectItem key={f} value={f} style={{ fontFamily: f }}>
                      {FONT_LABELS[f] ?? f}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={String(fontSize)}
                onValueChange={(v) => setFontSize(parseInt(v, 10))}
              >
                <SelectTrigger className="h-8 w-[72px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[12, 14, 16, 18, 20, 24, 28, 32, 40, 48, 64, 80, 96].map((s) => (
                    <SelectItem key={s} value={String(s)}>
                      {s}px
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="mx-1 h-5 w-px bg-border" />
            </div>
          )}
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
        <aside className="flex w-16 flex-col items-center gap-1 overflow-y-auto border-r border-border bg-toolbar py-3 shadow-soft">
          {TOOLS.map((t) => {
            const Icon = t.icon;
            const active = tool === t.id;
            return (
              <Tooltip key={t.id}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setTool(t.id)}
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-md transition-colors",
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

          <div className="my-2 h-px w-8 shrink-0 bg-border" />

          {/* Size control (vertical) */}
          <div className="mt-1 flex shrink-0 flex-col items-center gap-2">
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
              className="absolute inset-0 block h-full w-full select-none"
            />
            <canvas
              ref={previewRef}
              className={cn(
                "absolute inset-0 block h-full w-full touch-none select-none",
                cursorClass,
              )}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={endStroke}
              onPointerCancel={() => endStroke()}
              onPointerLeave={() => endStroke()}
            />

            {/* Floating text editor */}
            {textEditor && (
              <div
                className="absolute z-10"
                style={{ left: textEditor.x, top: textEditor.y }}
              >
                <textarea
                  ref={textInputRef}
                  value={textEditor.value}
                  onChange={(e) =>
                    setTextEditor({ ...textEditor, value: e.target.value })
                  }
                  onBlur={commitText}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      e.preventDefault();
                      setTextEditor(null);
                    } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      commitText();
                    }
                  }}
                  rows={1}
                  placeholder="Type…"
                  className="min-w-[120px] resize-none overflow-hidden whitespace-pre rounded-sm border border-dashed border-tool-active bg-canvas/80 p-1 leading-tight outline-none ring-1 ring-tool-active/30 backdrop-blur-sm"
                  style={{
                    color,
                    fontSize: `${fontSize}px`,
                    fontFamily,
                    lineHeight: 1.2,
                  }}
                />
              </div>
            )}
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
