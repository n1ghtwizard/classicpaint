import { useCallback, useEffect, useRef, useState } from "react";
import {
  Pencil,
  Brush,
  Eraser,
  PaintBucket,
  Pipette,
  FilePlus,
  Download,
  Undo2,
  Redo2,
  Square,
  Circle,
  Minus,
  Triangle,
  Type,
  Maximize2,
  ChevronDown,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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

// "fit" sizes the canvas to its container; everything else is a fixed CSS-pixel size.
type CanvasPreset =
  | { id: "fit"; label: "Fit to window" }
  | { id: "a4-portrait"; label: "A4 (portrait)"; width: number; height: number }
  | { id: "a4-landscape"; label: "A4 (landscape)"; width: number; height: number }
  | { id: "square"; label: "Square 1:1"; width: number; height: number }
  | { id: "widescreen"; label: "Widescreen 16:9"; width: number; height: number };

const PRESETS: CanvasPreset[] = [
  { id: "fit", label: "Fit to window" },
  // A4 at ~96dpi (210x297mm)
  { id: "a4-portrait", label: "A4 (portrait)", width: 794, height: 1123 },
  { id: "a4-landscape", label: "A4 (landscape)", width: 1123, height: 794 },
  { id: "square", label: "Square 1:1", width: 1000, height: 1000 },
  { id: "widescreen", label: "Widescreen 16:9", width: 1280, height: 720 },
];

export const PaintApp = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const drawingRef = useRef(false);
  const lastPointRef = useRef<Point | null>(null);
  const midPointRef = useRef<Point | null>(null);
  const shapeStartRef = useRef<Point | null>(null);
  const pendingPointsRef = useRef<Point[]>([]);
  const rafRef = useRef<number | null>(null);

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

  const [presetId, setPresetId] = useState<CanvasPreset["id"]>("fit");
  const [confirmNew, setConfirmNew] = useState(false);

  // Refs for live values used inside imperative handlers — avoids stale closures
  // and lets us avoid re-binding listeners on every keystroke.
  const toolRef = useRef(tool);
  const colorRef = useRef(color);
  const sizeRef = useRef(size);
  toolRef.current = tool;
  colorRef.current = color;
  sizeRef.current = size;

  const getCtx = () => canvasRef.current?.getContext("2d") ?? null;
  const getPreviewCtx = () => previewRef.current?.getContext("2d") ?? null;

  // Resize both canvases. If a fixed preset is active we use that size; otherwise
  // the container size. Existing pixels are preserved with a centered draw so the
  // user keeps their work when switching presets or the window resizes.
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const preview = previewRef.current;
    const container = containerRef.current;
    if (!canvas || !preview || !container) return;

    const ratio = window.devicePixelRatio || 1;
    const preset = PRESETS.find((p) => p.id === presetId)!;

    let cssW: number;
    let cssH: number;
    if (preset.id === "fit") {
      const r = container.getBoundingClientRect();
      cssW = Math.floor(r.width);
      cssH = Math.floor(r.height);
    } else {
      cssW = preset.width;
      cssH = preset.height;
    }
    if (!cssW || !cssH) return;

    const targetW = Math.floor(cssW * ratio);
    const targetH = Math.floor(cssH * ratio);

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
      c.style.width = `${cssW}px`;
      c.style.height = `${cssH}px`;
      const cx = c.getContext("2d");
      if (cx) cx.setTransform(ratio, 0, 0, ratio, 0, 0);
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, cssW, cssH);
    if (prev.width && prev.height) {
      ctx.drawImage(prev, 0, 0, prev.width / ratio, prev.height / ratio);
    }
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, [presetId]);

  useEffect(() => {
    resizeCanvas();
    // Initial history snapshot only — subsequent preset changes shouldn't add one.
    if (historyRef.current.length === 0) pushHistory();
    let raf = 0;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => resizeCanvas());
    });
    if (containerRef.current) ro.observe(containerRef.current);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetId]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
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
        p: "pencil", b: "brush", e: "eraser", f: "fill", i: "picker",
        r: "rectangle", o: "circle", l: "line", g: "triangle", t: "text",
      };
      const t = map[e.key.toLowerCase()];
      if (t && !e.ctrlKey && !e.metaKey) setTool(t);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [textEditor]);

  useEffect(() => {
    if (textEditor) {
      requestAnimationFrame(() => textInputRef.current?.focus());
    }
  }, [textEditor]);

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

  // Restoring uses putImageData, which only works when the snapshot dimensions
  // match the current canvas. If the user changed the preset, we just skip.
  const restoreFromHistory = () => {
    const canvas = canvasRef.current;
    const ctx = getCtx();
    const data = historyRef.current[historyIndexRef.current];
    if (!canvas || !ctx || !data) return;
    if (data.width !== canvas.width || data.height !== canvas.height) {
      setCanUndo(historyIndexRef.current > 0);
      setCanRedo(historyIndexRef.current < historyRef.current.length - 1);
      return;
    }
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

  // Smooth strokes: draw quadratic curves between midpoints of consecutive
  // pointer samples. Combined with rAF batching this gives a native, low-lag
  // feel even when the browser fires many events per frame.
  const flushStroke = () => {
    rafRef.current = null;
    const ctx = getCtx();
    const points = pendingPointsRef.current;
    if (!ctx || points.length === 0) return;
    pendingPointsRef.current = [];

    const t = toolRef.current;
    ctx.globalCompositeOperation = t === "eraser" ? "destination-out" : "source-over";
    ctx.strokeStyle = colorRef.current;
    ctx.lineWidth = t === "pencil" ? Math.max(1, Math.round(sizeRef.current / 3)) : sizeRef.current;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    let prev = lastPointRef.current!;
    let mid = midPointRef.current!;

    for (const p of points) {
      const newMid = { x: (prev.x + p.x) / 2, y: (prev.y + p.y) / 2 };
      ctx.beginPath();
      ctx.moveTo(mid.x, mid.y);
      ctx.quadraticCurveTo(prev.x, prev.y, newMid.x, newMid.y);
      ctx.stroke();
      mid = newMid;
      prev = p;
    }

    lastPointRef.current = prev;
    midPointRef.current = mid;
  };

  const queuePoint = (p: Point) => {
    pendingPointsRef.current.push(p);
    if (rafRef.current == null) {
      rafRef.current = requestAnimationFrame(flushStroke);
    }
  };

  const configureShapeStroke = (ctx: CanvasRenderingContext2D) => {
    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = colorRef.current;
    ctx.lineWidth = Math.max(1, sizeRef.current);
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
      ctx.fillStyle = colorRef.current;
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

    if (textEditor) commitText();

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

    // Free-draw: paint an initial dot so single taps are visible.
    drawingRef.current = true;
    lastPointRef.current = pos;
    midPointRef.current = pos;
    pendingPointsRef.current = [];

    const ctx = getCtx();
    if (ctx) {
      ctx.globalCompositeOperation = tool === "eraser" ? "destination-out" : "source-over";
      ctx.fillStyle = color;
      const r = (tool === "pencil" ? Math.max(1, Math.round(size / 3)) : size) / 2;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;

    if (SHAPE_TOOLS.includes(tool) && shapeStartRef.current) {
      const pos = getPos(e);
      const ctx = getPreviewCtx();
      if (!ctx) return;
      clearPreview();
      drawShape(ctx, tool, shapeStartRef.current, pos);
      return;
    }

    // Free-draw: collect coalesced events for accuracy, then flush on rAF.
    const events = (e.nativeEvent.getCoalescedEvents?.() ?? []) as PointerEvent[];
    if (events.length > 1) {
      for (const ev of events) queuePoint(getPos(ev));
    } else {
      queuePoint(getPos(e));
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

    // Flush any queued points synchronously so the snapshot includes them.
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (pendingPointsRef.current.length) flushStroke();

    drawingRef.current = false;
    lastPointRef.current = null;
    midPointRef.current = null;
    pushHistory();
  };

  const wipeCanvas = () => {
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

  // Composite the drawing onto an opaque white background and download.
  // JPEG has no alpha channel, so we always flatten to white before exporting
  // — otherwise transparent pixels become black in some encoders.
  const exportImage = (format: "png" | "jpg") => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const out = document.createElement("canvas");
    out.width = canvas.width;
    out.height = canvas.height;
    const ctx = out.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.drawImage(canvas, 0, 0);

    const mime = format === "png" ? "image/png" : "image/jpeg";
    const ext = format === "png" ? "png" : "jpg";
    const url = out.toDataURL(mime, format === "jpg" ? 0.92 : undefined);
    const link = document.createElement("a");
    link.download = `painting.${ext}`;
    link.href = url;
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
  const currentPreset = PRESETS.find((p) => p.id === presetId)!;

  return (
    <div className="flex h-screen w-screen flex-col bg-background text-foreground">
      {/* Top bar */}
      <header className="flex h-12 items-center justify-between border-b border-border bg-toolbar px-4 shadow-soft">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-semibold tracking-tight">Paint</h1>
          <div className="hidden items-center gap-1 sm:flex">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1.5 px-2 text-xs"
                  onClick={() => setConfirmNew(true)}
                >
                  <FilePlus className="h-3.5 w-3.5" />
                  New
                </Button>
              </TooltipTrigger>
              <TooltipContent>New canvas</TooltipContent>
            </Tooltip>

            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 gap-1.5 px-2 text-xs">
                      <Maximize2 className="h-3.5 w-3.5" />
                      <span className="max-w-[110px] truncate">{currentPreset.label}</span>
                      <ChevronDown className="h-3 w-3 opacity-60" />
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent>Canvas size</TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="start" className="w-52">
                <DropdownMenuLabel>Canvas size</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {PRESETS.map((p) => (
                  <DropdownMenuItem
                    key={p.id}
                    onSelect={() => setPresetId(p.id)}
                    className={cn(
                      "flex items-center justify-between text-xs",
                      p.id === presetId && "bg-accent/10 text-accent",
                    )}
                  >
                    <span>{p.label}</span>
                    {p.id !== "fit" && (
                      <span className="ml-2 text-[10px] tabular-nums text-muted-foreground">
                        {p.width}×{p.height}
                      </span>
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

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
            <TooltipContent>Redo (⌘Y / ⌘⇧Z)</TooltipContent>
          </Tooltip>
          <div className="mx-2 h-5 w-px bg-border" />
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 gap-1.5 px-2 text-xs">
                    <Download className="h-3.5 w-3.5" />
                    Export
                    <ChevronDown className="h-3 w-3 opacity-60" />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>Export</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Download as</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => exportImage("png")} className="text-xs">
                PNG image
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => exportImage("jpg")} className="text-xs">
                JPG image
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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

        {/* Canvas area */}
        <main className="flex flex-1 items-center justify-center overflow-auto bg-secondary p-4">
          <div
            ref={containerRef}
            className={cn(
              "relative overflow-hidden rounded-lg border border-border bg-canvas shadow-panel",
              presetId === "fit" ? "h-full w-full" : "shrink-0",
            )}
            style={
              presetId === "fit"
                ? undefined
                : { width: currentPreset.width, height: currentPreset.height }
            }
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

      <AlertDialog open={confirmNew} onOpenChange={setConfirmNew}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Start a new canvas?</AlertDialogTitle>
            <AlertDialogDescription>
              This will clear your current drawing. This action can be undone with ⌘Z.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                wipeCanvas();
                setConfirmNew(false);
              }}
            >
              New canvas
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PaintApp;
