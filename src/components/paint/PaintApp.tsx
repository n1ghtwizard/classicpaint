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
  Type,
  Maximize2,
  ChevronDown,
  Sun,
  Moon,
  MousePointer2,
  Bold,
  Italic,
  Underline,
} from "lucide-react";
import { Toggle } from "@/components/ui/toggle";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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

import { SHAPES, SHAPE_LOOKUP, renderShape, type DrawnShape, type ShapeKind } from "./shapes";
import { ShapeTransformer } from "./ShapeTransformer";
import { SelectionLayer, type FloatingSelection } from "./SelectionLayer";
import { useTheme } from "./useTheme";

type Tool = "select" | "pencil" | "brush" | "eraser" | "fill" | "picker" | "shape" | "text";

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
  { id: "select", icon: MousePointer2, label: "Select", shortcut: "V" },
  { id: "pencil", icon: Pencil, label: "Pencil", shortcut: "P" },
  { id: "brush", icon: Brush, label: "Brush", shortcut: "B" },
  { id: "eraser", icon: Eraser, label: "Eraser", shortcut: "E" },
  { id: "fill", icon: PaintBucket, label: "Fill bucket", shortcut: "F" },
  { id: "picker", icon: Pipette, label: "Color picker", shortcut: "I" },
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

type CanvasPreset =
  | { id: "fit"; label: "Fit to window" }
  | { id: "a4-portrait"; label: "A4 (portrait)"; width: number; height: number }
  | { id: "a4-landscape"; label: "A4 (landscape)"; width: number; height: number }
  | { id: "square"; label: "Square 1:1"; width: number; height: number }
  | { id: "widescreen"; label: "Widescreen 16:9"; width: number; height: number };

const PRESETS: CanvasPreset[] = [
  { id: "fit", label: "Fit to window" },
  { id: "a4-portrait", label: "A4 (portrait)", width: 794, height: 1123 },
  { id: "a4-landscape", label: "A4 (landscape)", width: 1123, height: 794 },
  { id: "square", label: "Square 1:1", width: 1000, height: 1000 },
  { id: "widescreen", label: "Widescreen 16:9", width: 1280, height: 720 },
];

const MIN_SHAPE_SIZE = 4;

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
  const [shapeKind, setShapeKind] = useState<ShapeKind>("rectangle");
  const [shapesMenuOpen, setShapesMenuOpen] = useState(false);
  const [color, setColor] = useState("#000000");
  const [size, setSize] = useState(6);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const [fontSize, setFontSize] = useState(24);
  const [fontFamily, setFontFamily] = useState(FONT_FAMILIES[0]);
  const [textBold, setTextBold] = useState(false);
  const [textItalic, setTextItalic] = useState(false);
  const [textUnderline, setTextUnderline] = useState(false);
  const [textEditor, setTextEditor] = useState<TextEditor | null>(null);

  const [presetId, setPresetId] = useState<CanvasPreset["id"]>("fit");
  const [confirmNew, setConfirmNew] = useState(false);

  // The currently-editing shape — drawn into the preview canvas, not yet
  // committed to the main canvas. While set, the transformer overlay is shown.
  const [activeShape, setActiveShape] = useState<DrawnShape | null>(null);
  const activeShapeRef = useRef<DrawnShape | null>(null);
  activeShapeRef.current = activeShape;

  // History of placed shape objects so they remain editable via double-click
  // until the user takes a destructive action (e.g. uses a pixel tool over
  // them, exports, or starts a new canvas).
  const [placedShapes, setPlacedShapes] = useState<DrawnShape[]>([]);
  const placedShapesRef = useRef<DrawnShape[]>([]);
  placedShapesRef.current = placedShapes;

  // Lifted selection (a region of pixels detached from the canvas, draggable).
  const [selection, setSelection] = useState<FloatingSelection | null>(null);
  const selectionRef = useRef<FloatingSelection | null>(null);
  selectionRef.current = selection;

  // In-progress marquee while the user drags out a selection rectangle.
  const marqueeRef = useRef<{ startX: number; startY: number } | null>(null);
  const [marquee, setMarquee] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  // Pointer position over the canvas, used to render a placement ghost when
  // the shape or text tool is active.
  const [hoverPos, setHoverPos] = useState<Point | null>(null);

  const { theme, toggle: toggleTheme } = useTheme();

  const toolRef = useRef(tool);
  const colorRef = useRef(color);
  const sizeRef = useRef(size);
  toolRef.current = tool;
  colorRef.current = color;
  sizeRef.current = size;

  const getCtx = () => canvasRef.current?.getContext("2d") ?? null;
  const getPreviewCtx = () => previewRef.current?.getContext("2d") ?? null;

  const clearPreview = useCallback(() => {
    const preview = previewRef.current;
    const ctx = getPreviewCtx();
    if (!preview || !ctx) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, preview.width, preview.height);
    ctx.restore();
    const ratio = window.devicePixelRatio || 1;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }, []);

  // Draw the lifted selection bitmap onto the preview canvas at its current
  // floating position. Called on every selection change.
  const renderSelectionToPreview = useCallback((sel: FloatingSelection) => {
    const ctx = getPreviewCtx();
    if (!ctx) return;
    const ratio = window.devicePixelRatio || 1;
    // We need to draw the ImageData (in physical pixels) at a CSS-pixel
    // location. Use a temp canvas to convert, then drawImage with scaling.
    const tmp = document.createElement("canvas");
    tmp.width = sel.imageData.width;
    tmp.height = sel.imageData.height;
    const tctx = tmp.getContext("2d");
    if (!tctx) return;
    tctx.putImageData(sel.imageData, 0, 0);
    ctx.save();
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.drawImage(tmp, sel.x, sel.y, sel.w, sel.h);
    ctx.restore();
  }, []);

  const renderActiveShapeToPreview = useCallback(() => {
    const ctx = getPreviewCtx();
    clearPreview();
    if (!ctx) return;
    for (const s of placedShapesRef.current) renderShape(ctx, s);
    const shape = activeShapeRef.current;
    if (shape) renderShape(ctx, shape);
  }, [clearPreview]);

  // Re-render the preview whenever the active shape, placed shapes, or
  // selection changes.
  useEffect(() => {
    const ctx = getPreviewCtx();
    if (!ctx) return;
    clearPreview();
    for (const s of placedShapes) renderShape(ctx, s);
    if (activeShape) renderShape(ctx, activeShape);
    if (selection) renderSelectionToPreview(selection);
    // marquee is drawn separately via overlay div
  }, [activeShape, placedShapes, selection, clearPreview, renderSelectionToPreview]);

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

    // Re-render any active shape on top of the resized preview.
    renderActiveShapeToPreview();
  }, [presetId, renderActiveShapeToPreview]);

  useEffect(() => {
    resizeCanvas();
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

  // Commit the current shape — moves it from the editing slot into the
  // placedShapes list (still vector / re-editable). Switches the tool back
  // to pencil so adding more shapes requires re-opening the shapes menu.
  const commitActiveShape = useCallback(() => {
    const shape = activeShapeRef.current;
    if (!shape) {
      setActiveShape(null);
      return;
    }
    setPlacedShapes((prev) => [...prev, shape]);
    setActiveShape(null);
    setTool("pencil");
  }, []);

  // Stamp the floating selection back onto the main canvas at its current
  // position, then clear the floating layer.
  const commitSelection = useCallback(() => {
    const sel = selectionRef.current;
    const ctx = getCtx();
    if (!sel || !ctx) {
      setSelection(null);
      return;
    }
    const tmp = document.createElement("canvas");
    tmp.width = sel.imageData.width;
    tmp.height = sel.imageData.height;
    const tctx = tmp.getContext("2d");
    if (tctx) {
      tctx.putImageData(sel.imageData, 0, 0);
      ctx.drawImage(tmp, sel.x, sel.y, sel.w, sel.h);
    }
    setSelection(null);
    clearPreview();
    pushHistory();
  }, [clearPreview]);

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
      if (e.key === "Escape") {
        if (textEditor) setTextEditor(null);
        if (activeShapeRef.current) {
          setActiveShape(null);
          clearPreview();
        }
        if (selectionRef.current) {
          // Restore the lifted region back to its origin.
          const sel = selectionRef.current;
          const ctx = getCtx();
          if (ctx) {
            const tmp = document.createElement("canvas");
            tmp.width = sel.imageData.width;
            tmp.height = sel.imageData.height;
            const tctx = tmp.getContext("2d");
            if (tctx) {
              tctx.putImageData(sel.imageData, 0, 0);
              ctx.drawImage(tmp, sel.originX, sel.originY, sel.w, sel.h);
            }
          }
          setSelection(null);
          clearPreview();
        }
        return;
      }
      const map: Record<string, Tool> = {
        v: "select", p: "pencil", b: "brush", e: "eraser", f: "fill", i: "picker", t: "text",
      };
      const t = map[e.key.toLowerCase()];
      if (t && !e.ctrlKey && !e.metaKey) {
        // Switching tools commits any pending shape/selection.
        if (activeShapeRef.current) commitActiveShape();
        if (selectionRef.current) commitSelection();
        setTool(t);
      }
      if (e.key.toLowerCase() === "s" && !e.ctrlKey && !e.metaKey) {
        setTool("shape");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [textEditor, commitActiveShape, commitSelection, clearPreview]);

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
    if (activeShapeRef.current) {
      // Cancel the in-progress shape rather than walking history.
      setActiveShape(null);
      clearPreview();
      return;
    }
    if (selectionRef.current) {
      // Drop the floating selection back at its origin first.
      const sel = selectionRef.current;
      const ctx = getCtx();
      if (ctx) {
        const tmp = document.createElement("canvas");
        tmp.width = sel.imageData.width;
        tmp.height = sel.imageData.height;
        const tctx = tmp.getContext("2d");
        if (tctx) {
          tctx.putImageData(sel.imageData, 0, 0);
          ctx.drawImage(tmp, sel.originX, sel.originY, sel.w, sel.h);
        }
      }
      setSelection(null);
      clearPreview();
      return;
    }
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

  // Lift the pixels under the marquee into a floating selection.
  const liftSelection = useCallback((rect: { x: number; y: number; w: number; h: number }) => {
    const canvas = canvasRef.current;
    const ctx = getCtx();
    if (!canvas || !ctx) return;
    const ratio = window.devicePixelRatio || 1;
    const px = Math.max(0, Math.floor(rect.x * ratio));
    const py = Math.max(0, Math.floor(rect.y * ratio));
    const pw = Math.min(canvas.width - px, Math.floor(rect.w * ratio));
    const ph = Math.min(canvas.height - py, Math.floor(rect.h * ratio));
    if (pw <= 0 || ph <= 0) return;

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const data = ctx.getImageData(px, py, pw, ph);
    // Knock the lifted region out of the canvas with white.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(px, py, pw, ph);
    ctx.restore();
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

    setSelection({
      originX: px / ratio,
      originY: py / ratio,
      x: px / ratio,
      y: py / ratio,
      w: pw / ratio,
      h: ph / ratio,
      imageData: data,
    });
    pushHistory();
  }, []);

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    (e.target as Element).setPointerCapture(e.pointerId);
    const pos = getPos(e);

    // Selection tool: clicking outside an existing floating selection commits
    // it and starts a new marquee.
    if (tool === "select") {
      if (selectionRef.current) {
        const sel = selectionRef.current;
        const inside =
          pos.x >= sel.x && pos.x <= sel.x + sel.w &&
          pos.y >= sel.y && pos.y <= sel.y + sel.h;
        if (inside) {
          // Drag handled by the SelectionLayer overlay — let it through.
          return;
        }
        commitSelection();
      }
      drawingRef.current = true;
      marqueeRef.current = { startX: pos.x, startY: pos.y };
      setMarquee({ x: pos.x, y: pos.y, w: 0, h: 0 });
      return;
    }

    // Any other tool: bake any pending overlays first.
    if (activeShapeRef.current) commitActiveShape();
    if (selectionRef.current) commitSelection();
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
    if (tool === "shape") {
      // Drop a default-sized shape centered on the click; user adjusts via the
      // transformer overlay. No drag-to-draw — keeps the workflow predictable.
      const isLine = shapeKind === "line" || shapeKind === "diagonal-line";
      const w = 200;
      const h = isLine ? 200 : 140;
      setActiveShape({
        kind: shapeKind,
        x: pos.x - w / 2,
        y: pos.y - h / 2,
        w,
        h,
        rotation: 0,
        color,
        strokeWidth: size,
        fill: null,
      });
      return;
    }

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

    if (tool === "select" && marqueeRef.current) {
      const pos = getPos(e);
      const start = marqueeRef.current;
      setMarquee({
        x: Math.min(start.startX, pos.x),
        y: Math.min(start.startY, pos.y),
        w: Math.abs(pos.x - start.startX),
        h: Math.abs(pos.y - start.startY),
      });
      return;
    }

    const events = (e.nativeEvent.getCoalescedEvents?.() ?? []) as PointerEvent[];
    if (events.length > 1) {
      for (const ev of events) queuePoint(getPos(ev));
    } else {
      queuePoint(getPos(e));
    }
  };

  const endStroke = (e?: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;

    if (tool === "select" && marqueeRef.current) {
      const m = marquee;
      marqueeRef.current = null;
      setMarquee(null);
      drawingRef.current = false;
      if (m && m.w > 4 && m.h > 4) {
        liftSelection(m);
      }
      return;
    }

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
    setActiveShape(null);
    setSelection(null);
    clearPreview();
    const ratio = window.devicePixelRatio || 1;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    pushHistory();
  };

  const exportImage = (format: "png" | "jpg") => {
    // Make sure pending overlays are baked in before exporting.
    if (activeShapeRef.current) commitActiveShape();
    if (selectionRef.current) commitSelection();
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
  const currentShape = SHAPE_LOOKUP[shapeKind];
  const ShapeIcon = currentShape.icon;
  const containerRect = containerRef.current?.getBoundingClientRect();

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
              <Button variant="ghost" size="icon" onClick={undo} disabled={!canUndo && !activeShape && !selection} aria-label="Undo">
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
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle theme">
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{theme === "dark" ? "Light mode" : "Dark mode"}</TooltipContent>
          </Tooltip>
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
                    onClick={() => {
                      if (activeShapeRef.current) commitActiveShape();
                      if (selectionRef.current) commitSelection();
                      setTool(t.id);
                    }}
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

          {/* Shapes button — opens a popover with the full shape grid */}
          <Popover open={shapesMenuOpen} onOpenChange={setShapesMenuOpen}>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <button
                    onClick={() => {
                      if (activeShapeRef.current) commitActiveShape();
                      if (selectionRef.current) commitSelection();
                      setTool("shape");
                    }}
                    className={cn(
                      "relative flex h-10 w-10 shrink-0 items-center justify-center rounded-md transition-colors",
                      tool === "shape"
                        ? "bg-tool-active text-accent-foreground"
                        : "text-foreground hover:bg-tool-hover",
                    )}
                    aria-label="Shapes"
                    aria-pressed={tool === "shape"}
                  >
                    <ShapeIcon className="h-[18px] w-[18px]" />
                    <ChevronDown className="absolute bottom-0.5 right-0.5 h-2.5 w-2.5 opacity-70" />
                  </button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent side="right">
                Shapes <span className="ml-1 text-muted-foreground">(S)</span>
              </TooltipContent>
            </Tooltip>
            <PopoverContent side="right" align="start" className="w-[260px] p-2">
              <div className="mb-2 px-1 text-[11px] font-medium text-muted-foreground">
                Shapes
              </div>
              <div className="grid grid-cols-6 gap-1">
                {SHAPES.map((s) => {
                  const Icon = s.icon;
                  const active = s.id === shapeKind && tool === "shape";
                  return (
                    <Tooltip key={s.id}>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => {
                            if (activeShapeRef.current) commitActiveShape();
                            if (selectionRef.current) commitSelection();
                            setShapeKind(s.id);
                            setTool("shape");
                            setShapesMenuOpen(false);
                          }}
                          className={cn(
                            "flex h-9 w-9 items-center justify-center rounded-md transition-colors",
                            active
                              ? "bg-tool-active text-accent-foreground"
                              : "text-foreground hover:bg-tool-hover",
                          )}
                          aria-label={s.label}
                        >
                          <Icon className="h-4 w-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">{s.label}</TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>

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
                onValueChange={(v) => {
                  setSize(v[0]);
                  if (activeShape) {
                    setActiveShape({ ...activeShape, strokeWidth: v[0] });
                  }
                }}
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
              currentPreset.id === "fit" ? "h-full w-full" : "shrink-0",
            )}
            style={
              currentPreset.id === "fit"
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

            {/* Shape transformer overlay — shown only after a shape is drawn,
                while the user is still adjusting it. */}
            {activeShape && containerRect && (
              <ShapeTransformer
                shape={activeShape}
                containerWidth={containerRect.width}
                containerHeight={containerRect.height}
                onChange={(s) => {
                  // Live re-color/size from the toolbar still works because
                  // the strokeWidth/color come from the shape itself.
                  setActiveShape(s);
                }}
                onCommit={commitActiveShape}
              />
            )}

            {/* Floating selection — draggable bounding box around lifted pixels */}
            {selection && (
              <SelectionLayer
                selection={selection}
                onChange={setSelection}
                onCommit={commitSelection}
              />
            )}

            {/* In-progress marquee rectangle (selection tool, while dragging) */}
            {marquee && (
              <div
                className="pointer-events-none absolute z-20 border border-dashed border-tool-active/80 bg-tool-active/10"
                style={{
                  left: marquee.x,
                  top: marquee.y,
                  width: marquee.w,
                  height: marquee.h,
                }}
              />
            )}

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
                  className="min-w-[120px] resize-none overflow-hidden whitespace-pre rounded-sm border border-dashed border-tool-active bg-canvas/80 p-1 leading-tight text-foreground outline-none ring-1 ring-tool-active/30 backdrop-blur-sm"
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
              onChange={(e) => {
                setColor(e.target.value);
                if (activeShape) setActiveShape({ ...activeShape, color: e.target.value });
              }}
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
                onClick={() => {
                  setColor(c);
                  if (activeShape) setActiveShape({ ...activeShape, color: c });
                }}
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

        <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
          {activeShape && (
            <span className="hidden md:inline">
              Drag handles to resize · top dot rotates · Enter to confirm · Esc to cancel
            </span>
          )}
          {selection && !activeShape && (
            <span className="hidden md:inline">
              Drag the box to move · Enter to drop · Esc to cancel
            </span>
          )}
          {tool === "select" && !selection && !activeShape && (
            <span className="hidden md:inline">
              Drag a rectangle to lift a region as a floating layer
            </span>
          )}
          <span>{tool === "shape" ? `Shape: ${currentShape.label}` : TOOLS.find((t) => t.id === tool)?.label}</span>
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
