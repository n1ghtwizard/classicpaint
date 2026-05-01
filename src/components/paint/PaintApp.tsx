import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
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
  Highlighter,
  PenTool,
  PenLine,
  Feather,
  SprayCan,
  Palette,
  Crop,
  Spline,
  ZoomIn,
  ZoomOut,
  LogIn,
  LogOut,
  Save,
  User as UserIcon,
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
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
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
import { toast } from "sonner";
import jsPDF from "jspdf";

import { SHAPES, SHAPE_LOOKUP, renderShape, type DrawnShape, type ShapeKind } from "./shapes";
import { ShapeTransformer } from "./ShapeTransformer";
import { SelectionLayer, type FloatingSelection } from "./SelectionLayer";
import { useTheme } from "./useTheme";
import { CropOverlay, type CropAspect } from "./CropOverlay";
import { PolylineEditor, renderPolyline, type PolylineDraft } from "./PolylineEditor";
import { ColorPickerPopover } from "./ColorPickerPopover";
import { SaveLoadDialog } from "./SaveLoadDialog";
import { useAuth } from "@/contexts/AuthContext";

type Tool =
  | "select"
  | "pencil"
  | "brush"
  | "marker"
  | "calligraphy"
  | "ink"
  | "watercolor"
  | "crayon"
  | "spray"
  | "eraser"
  | "fill"
  | "picker"
  | "shape"
  | "text"
  | "crop"
  | "polyline";

// 2/3/4/5 point lines, straight or curved.
type PolylineKind = "polyline-2" | "polyline-3" | "polyline-4" | "polyline-5"
  | "curve-2" | "curve-3" | "curve-4" | "curve-5";
const POLYLINE_KINDS: { id: PolylineKind; label: string; points: number; curved: boolean }[] = [
  { id: "polyline-2", label: "Line (2 pts)",   points: 2, curved: false },
  { id: "polyline-3", label: "Line (3 pts)",   points: 3, curved: false },
  { id: "polyline-4", label: "Line (4 pts)",   points: 4, curved: false },
  { id: "polyline-5", label: "Line (5 pts)",   points: 5, curved: false },
  { id: "curve-2",    label: "Curve (2 pts)",  points: 2, curved: true  },
  { id: "curve-3",    label: "Curve (3 pts)",  points: 3, curved: true  },
  { id: "curve-4",    label: "Curve (4 pts)",  points: 4, curved: true  },
  { id: "curve-5",    label: "Curve (5 pts)",  points: 5, curved: true  },
];

// Tools that paint freehand strokes on the bitmap canvas.
const BRUSH_TOOLS: Tool[] = [
  "pencil",
  "brush",
  "marker",
  "calligraphy",
  "ink",
  "watercolor",
  "crayon",
  "spray",
];

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

// Top-level sidebar buttons (not inside the brushes dropdown).
const TOOLS: ToolBtn[] = [
  { id: "select", icon: MousePointer2, label: "Select", shortcut: "V" },
];

const TEXT_TOOL: ToolBtn = { id: "text", icon: Type, label: "Text", shortcut: "T" };

// All hand/painting tools that live inside the Brushes dropdown.
const BRUSHES: ToolBtn[] = [
  { id: "pencil", icon: Pencil, label: "Pencil", shortcut: "P" },
  { id: "brush", icon: Brush, label: "Brush", shortcut: "B" },
  { id: "marker", icon: Highlighter, label: "Marker", shortcut: "" },
  { id: "calligraphy", icon: PenTool, label: "Calligraphy", shortcut: "" },
  { id: "ink", icon: PenLine, label: "Ink pen", shortcut: "" },
  { id: "watercolor", icon: Feather, label: "Watercolor", shortcut: "" },
  { id: "crayon", icon: Palette, label: "Crayon", shortcut: "" },
  { id: "spray", icon: SprayCan, label: "Spray", shortcut: "" },
  { id: "eraser", icon: Eraser, label: "Eraser", shortcut: "E" },
  { id: "fill", icon: PaintBucket, label: "Fill bucket", shortcut: "F" },
  { id: "picker", icon: Pipette, label: "Color picker", shortcut: "I" },
];

interface Point {
  x: number;
  y: number;
}

interface AppClipboard {
  imageData: ImageData;
  w: number;
  h: number;
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
  // Per-stroke offscreen buffer for translucent brushes (e.g. watercolor).
  // Drawn at full opacity, then composited once at low alpha so overlapping
  // segments don't stack up and produce visible "dots" between flushes.
  const strokeBufferRef = useRef<HTMLCanvasElement | null>(null);
  const strokeBufferAlphaRef = useRef<number>(1);

  const historyRef = useRef<ImageData[]>([]);
  const historyIndexRef = useRef(-1);

  const textInputRef = useRef<HTMLTextAreaElement>(null);

  const [tool, setTool] = useState<Tool>("select");
  const [shapeKind, setShapeKind] = useState<ShapeKind>("rectangle");
  const [shapesMenuOpen, setShapesMenuOpen] = useState(false);
  const [brushesMenuOpen, setBrushesMenuOpen] = useState(false);
  // Last brush picked from the brushes dropdown — used for the dropdown's
  // current icon and quick re-selection.
  const [lastBrush, setLastBrush] = useState<Tool>("pencil");
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
  // Custom canvas size (e.g. after a crop) — overrides preset sizing.
  const [customSize, setCustomSize] = useState<{ width: number; height: number } | null>(null);
  const [canvasSize, setCanvasSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(1);
  const ZOOM_MIN = 0.1;
  const ZOOM_MAX = 8;
  const clampZoom = (z: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);
  const appClipboardRef = useRef<AppClipboard | null>(null);
  const panRef = useRef<{ startX: number; startY: number; scrollLeft: number; scrollTop: number; moved: boolean } | null>(null);
  const suppressContextMenuRef = useRef(false);
  const mainRef = useRef<HTMLElement | null>(null);
  const [confirmNew, setConfirmNew] = useState(false);

  // Crop state
  const [cropAspect, setCropAspect] = useState<CropAspect>("free");

  // In-progress polyline (bendable line) draft + which sub-tool is active.
  const [polylineKind, setPolylineKind] = useState<PolylineKind>("polyline-3");
  const [polylineDraft, setPolylineDraft] = useState<PolylineDraft | null>(null);

  // Custom color slots (5) persisted to localStorage; synced to DB if logged in.
  const [customSlots, setCustomSlots] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem("paint:customSlots");
      if (raw) {
        const arr = JSON.parse(raw) as string[];
        return [0, 1, 2, 3, 4].map((i) => arr[i] ?? "");
      }
    } catch {/* noop */}
    return ["", "", "", "", ""];
  });
  useEffect(() => {
    localStorage.setItem("paint:customSlots", JSON.stringify(customSlots));
  }, [customSlots]);

  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const { user, signOut } = useAuth();

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
  const zoomRef = useRef(zoom);
  toolRef.current = tool;
  colorRef.current = color;
  sizeRef.current = size;
  zoomRef.current = zoom;

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

  const getFitCanvasSize = useCallback(() => {
    const main = mainRef.current;
    if (!main) return { width: 1, height: 1 };
    const style = window.getComputedStyle(main);
    const padX = parseFloat(style.paddingLeft || "0") + parseFloat(style.paddingRight || "0");
    const padY = parseFloat(style.paddingTop || "0") + parseFloat(style.paddingBottom || "0");
    return {
      width: Math.max(1, Math.floor(main.clientWidth - padX - 32)),
      height: Math.max(1, Math.floor(main.clientHeight - padY - 32)),
    };
  }, []);

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const preview = previewRef.current;
    if (!canvas || !preview) return;

    const ratio = window.devicePixelRatio || 1;
    const preset = PRESETS.find((p) => p.id === presetId)!;

    let cssW: number;
    let cssH: number;
    if (customSize) {
      cssW = customSize.width;
      cssH = customSize.height;
    } else if (preset.id === "fit") {
      const fit = getFitCanvasSize();
      cssW = fit.width;
      cssH = fit.height;
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

    setCanvasSize((prevSize) =>
      prevSize.width === cssW && prevSize.height === cssH ? prevSize : { width: cssW, height: cssH },
    );

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
  }, [presetId, customSize, getFitCanvasSize, renderActiveShapeToPreview]);

  useEffect(() => {
    resizeCanvas();
    if (historyRef.current.length === 0) pushHistory();
    let raf = 0;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => resizeCanvas());
    });
    if (mainRef.current) ro.observe(mainRef.current);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetId, customSize]);

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

  const cloneImageData = (data: ImageData) =>
    new ImageData(new Uint8ClampedArray(data.data), data.width, data.height);

  const clipboardToBlob = async (clip: AppClipboard): Promise<Blob | null> => {
    const tmp = document.createElement("canvas");
    tmp.width = clip.imageData.width;
    tmp.height = clip.imageData.height;
    const tctx = tmp.getContext("2d");
    if (!tctx) return null;
    tctx.putImageData(clip.imageData, 0, 0);
    return await new Promise<Blob | null>((resolve) => tmp.toBlob((b) => resolve(b), "image/png"));
  };

  const writeSystemClipboard = async (clip: AppClipboard) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const Item = (window as any).ClipboardItem;
      if (!Item || !navigator.clipboard?.write) return false;
      const blob = await clipboardToBlob(clip);
      if (!blob) return false;
      await navigator.clipboard.write([new Item({ "image/png": blob })]);
      return true;
    } catch {
      return false;
    }
  };

  // Copy the current floating selection, or the flattened canvas if no selection.
  // Always stores an internal ClassicPaint clipboard so copy/paste works even when
  // the browser blocks system image clipboard access.
  const copyToClipboard = useCallback(async () => {
    const sel = selectionRef.current;
    let clip: AppClipboard | null = null;

    if (sel) {
      clip = { imageData: cloneImageData(sel.imageData), w: sel.w, h: sel.h };
    } else {
      const out = flattenToCanvas();
      const ctx = out?.getContext("2d");
      if (!out || !ctx) {
        toast.error("Nothing to copy");
        return false;
      }
      const ratio = window.devicePixelRatio || 1;
      const data = ctx.getImageData(0, 0, out.width, out.height);
      clip = { imageData: data, w: out.width / ratio, h: out.height / ratio };
    }

    appClipboardRef.current = clip;
    const systemOk = await writeSystemClipboard(clip);
    toast.success(systemOk ? "Copied" : "Copied inside ClassicPaint");
    return true;
  }, []);

  const cutToClipboard = useCallback(async () => {
    if (!selectionRef.current) return false;
    const ok = await copyToClipboard();
    if (!ok) return false;
    // Drop floating selection without restoring it — that's the "cut".
    setSelection(null);
    clearPreview();
    pushHistory();
    toast.success("Cut");
    return true;
  }, [copyToClipboard, clearPreview]);

  const placeClipboardAsSelection = useCallback((clip: AppClipboard) => {
    const canvas = canvasRef.current;
    if (!canvas) return false;
    const ratio = window.devicePixelRatio || 1;
    const cssW = canvas.width / ratio;
    const cssH = canvas.height / ratio;
    const w = Math.min(clip.w, cssW);
    const h = Math.min(clip.h, cssH);
    if (activeShapeRef.current) commitActiveShape();
    if (selectionRef.current) commitSelection();
    setSelection({
      originX: Math.max(0, (cssW - w) / 2),
      originY: Math.max(0, (cssH - h) / 2),
      x: Math.max(0, (cssW - w) / 2),
      y: Math.max(0, (cssH - h) / 2),
      w,
      h,
      imageData: cloneImageData(clip.imageData),
    });
    setTool("select");
    return true;
  }, [commitActiveShape, commitSelection]);

  // Place a PNG blob on the canvas as a draggable floating selection. Shared
  // by the global paste handler and the right-click "Paste" menu item.
  const placeBlobAsSelection = useCallback((blob: Blob) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ratio = window.devicePixelRatio || 1;
      const cssW = canvas.width / ratio;
      const cssH = canvas.height / ratio;
      let w = img.naturalWidth;
      let h = img.naturalHeight;
      const max = Math.min(cssW * 0.8, cssH * 0.8);
      const scale = Math.min(1, max / Math.max(w, h));
      w = w * scale; h = h * scale;
      const off = document.createElement("canvas");
      off.width = Math.max(1, Math.floor(w * ratio));
      off.height = Math.max(1, Math.floor(h * ratio));
      const octx = off.getContext("2d");
      if (!octx) return;
      octx.drawImage(img, 0, 0, off.width, off.height);
      const data = octx.getImageData(0, 0, off.width, off.height);
      placeClipboardAsSelection({ imageData: data, w, h });
    };
    img.src = url;
  }, [placeClipboardAsSelection]);

  const pasteFromClipboard = useCallback(async () => {
    const internal = appClipboardRef.current;
    if (internal && placeClipboardAsSelection(internal)) {
      toast.success("Pasted");
      return true;
    }

    try {
      if (!navigator.clipboard?.read) {
        toast.error("Clipboard image access is blocked");
        return false;
      }
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const type = item.types.find((t) => t.startsWith("image/"));
        if (type) {
          const blob = await item.getType(type);
          placeBlobAsSelection(blob);
          toast.success("Pasted");
          return true;
        }
      }
      toast.error("No image found on clipboard");
      return false;
    } catch {
      toast.error("Clipboard image access is blocked");
      return false;
    }
  }, [placeBlobAsSelection, placeClipboardAsSelection]);

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
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c") {
        e.preventDefault();
        copyToClipboard();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "x") {
        e.preventDefault();
        cutToClipboard();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "v") {
        if (appClipboardRef.current) {
          e.preventDefault();
          pasteFromClipboard();
        }
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
  }, [textEditor, commitActiveShape, commitSelection, clearPreview, copyToClipboard, cutToClipboard, pasteFromClipboard]);

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
    const dpr = window.devicePixelRatio || 1;
    // Map screen coords to logical canvas coords (canvas pixels / dpr).
    const sx = rect.width ? canvas.width / rect.width / dpr : 1;
    const sy = rect.height ? canvas.height / rect.height / dpr : 1;
    return { x: (e.clientX - rect.left) * sx, y: (e.clientY - rect.top) * sy };
  };

  const flushStroke = () => {
    rafRef.current = null;
    const mainCtx = getCtx();
    const points = pendingPointsRef.current;
    if (!mainCtx || points.length === 0) return;
    pendingPointsRef.current = [];

    const t = toolRef.current;
    const baseSize = sizeRef.current;
    const col = colorRef.current;

    // For translucent brushes we draw onto an offscreen full-opacity buffer
    // and composite the buffer once per frame, so overlapping segments don't
    // visibly stack into "dots" along the stroke.
    const useBuffer = t === "watercolor";
    let ctx: CanvasRenderingContext2D = mainCtx;
    if (useBuffer && strokeBufferRef.current) {
      const bctx = strokeBufferRef.current.getContext("2d");
      if (bctx) ctx = bctx;
    }

    ctx.save();
    ctx.globalCompositeOperation = t === "eraser" ? "destination-out" : "source-over";
    ctx.strokeStyle = col;
    ctx.fillStyle = col;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // Per-brush style setup.
    let lineWidth = baseSize;
    if (t === "pencil") lineWidth = Math.max(1, Math.round(baseSize / 3));
    if (t === "marker") {
      lineWidth = baseSize * 1.4;
      ctx.lineCap = "round";
    }
    if (t === "ink") {
      lineWidth = Math.max(1, baseSize * 0.7);
    }
    if (t === "watercolor") {
      lineWidth = baseSize * 1.2;
      // Buffer is drawn at full opacity; alpha is applied at composite time.
      strokeBufferAlphaRef.current = 0.18;
    }
    if (t === "calligraphy") {
      lineWidth = baseSize;
      ctx.lineCap = "butt";
    }
    if (t === "crayon") {
      lineWidth = baseSize;
      ctx.globalAlpha = 0.55;
    }
    ctx.lineWidth = lineWidth;

    let prev = lastPointRef.current!;
    let mid = midPointRef.current!;

    if (t === "spray") {
      const radius = baseSize;
      const density = Math.max(6, Math.round(baseSize * 1.2));
      for (const p of points) {
        for (let i = 0; i < density; i++) {
          const a = Math.random() * Math.PI * 2;
          const r = Math.random() * radius;
          ctx.beginPath();
          ctx.arc(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r, 0.6, 0, Math.PI * 2);
          ctx.fill();
        }
        prev = p;
        mid = p;
      }
    } else if (t === "calligraphy") {
      const angle = -Math.PI / 4;
      const half = lineWidth / 2;
      for (const p of points) {
        ctx.beginPath();
        ctx.moveTo(prev.x - Math.cos(angle) * half, prev.y - Math.sin(angle) * half);
        ctx.lineTo(prev.x + Math.cos(angle) * half, prev.y + Math.sin(angle) * half);
        ctx.lineTo(p.x + Math.cos(angle) * half, p.y + Math.sin(angle) * half);
        ctx.lineTo(p.x - Math.cos(angle) * half, p.y - Math.sin(angle) * half);
        ctx.closePath();
        ctx.fill();
        prev = p;
        mid = p;
      }
    } else if (t === "crayon") {
      for (const p of points) {
        const newMid = { x: (prev.x + p.x) / 2, y: (prev.y + p.y) / 2 };
        for (let i = 0; i < 3; i++) {
          const jx = (Math.random() - 0.5) * lineWidth * 0.6;
          const jy = (Math.random() - 0.5) * lineWidth * 0.6;
          ctx.beginPath();
          ctx.moveTo(mid.x + jx, mid.y + jy);
          ctx.quadraticCurveTo(prev.x + jx, prev.y + jy, newMid.x + jx, newMid.y + jy);
          ctx.stroke();
        }
        mid = newMid;
        prev = p;
      }
    } else {
      for (const p of points) {
        const newMid = { x: (prev.x + p.x) / 2, y: (prev.y + p.y) / 2 };
        ctx.beginPath();
        ctx.moveTo(mid.x, mid.y);
        ctx.quadraticCurveTo(prev.x, prev.y, newMid.x, newMid.y);
        ctx.stroke();
        mid = newMid;
        prev = p;
      }
    }

    ctx.restore();

    // For buffered brushes, render the live preview by compositing the
    // full-opacity buffer onto the preview canvas at the target alpha.
    if (useBuffer && strokeBufferRef.current) {
      const preview = previewRef.current;
      const pctx = preview?.getContext("2d");
      if (preview && pctx) {
        pctx.save();
        pctx.setTransform(1, 0, 0, 1, 0, 0);
        pctx.clearRect(0, 0, preview.width, preview.height);
        pctx.globalAlpha = strokeBufferAlphaRef.current;
        pctx.drawImage(strokeBufferRef.current, 0, 0);
        pctx.restore();
      }
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
      const weight = textBold ? "bold" : "normal";
      const style = textItalic ? "italic" : "normal";
      ctx.font = `${style} ${weight} ${fontSize}px ${fontFamily}`;
      ctx.textBaseline = "top";
      const lines = value.split("\n");
      const lineHeight = Math.round(fontSize * 1.2);
      lines.forEach((line, i) => {
        const ly = textEditor.y + i * lineHeight;
        ctx.fillText(line, textEditor.x, ly);
        if (textUnderline && line.length > 0) {
          const w = ctx.measureText(line).width;
          const yLine = ly + Math.round(fontSize * 1.05);
          ctx.fillRect(textEditor.x, yLine, w, Math.max(1, Math.round(fontSize / 14)));
        }
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

    // Flatten placed shapes onto the bitmap first so the lifted region
    // captures everything that's visually on the canvas.
    if (placedShapesRef.current.length > 0) {
      ctx.save();
      for (const s of placedShapesRef.current) renderShape(ctx, s);
      ctx.restore();
      setPlacedShapes([]);
    }

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

  // Hit-test placedShapes (top-most first) at the given canvas-local point.
  const findShapeAt = (pos: Point): number => {
    const shapes = placedShapesRef.current;
    for (let i = shapes.length - 1; i >= 0; i--) {
      const s = shapes[i];
      // Convert pos into the shape's local space (un-rotate around center).
      const cx = s.x + s.w / 2;
      const cy = s.y + s.h / 2;
      const cos = Math.cos(-s.rotation);
      const sin = Math.sin(-s.rotation);
      const dx = pos.x - cx;
      const dy = pos.y - cy;
      const lx = dx * cos - dy * sin + s.w / 2;
      const ly = dx * sin + dy * cos + s.h / 2;
      const pad = Math.max(8, s.strokeWidth);
      if (lx >= -pad && lx <= s.w + pad && ly >= -pad && ly <= s.h + pad) {
        return i;
      }
    }
    return -1;
  };

  // Double-click: re-edit the topmost placed shape under the cursor.
  const onCanvasDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getPos(e as unknown as React.PointerEvent);
    const idx = findShapeAt(pos);
    if (idx === -1) return;
    if (activeShapeRef.current) commitActiveShape();
    if (selectionRef.current) commitSelection();
    const shape = placedShapesRef.current[idx];
    setPlacedShapes((prev) => prev.filter((_, i) => i !== idx));
    setActiveShape(shape);
    setTool("shape");
    setShapeKind(shape.kind);
  };

  // Paste external image data from the browser clipboard event.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (!file) continue;
          e.preventDefault();
          placeBlobAsSelection(file);
          toast.success("Pasted");
          return;
        }
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [placeBlobAsSelection]);

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    // Right- or middle-click is reserved for pan / context menu — never draw.
    if (e.button !== 0) return;
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
      // Drag-to-place: start a 0-sized shape at the click; resize during
      // pointermove; on pointerup the shape stays active (transformer shown).
      drawingRef.current = true;
      shapeStartRef.current = pos;
      setActiveShape({
        kind: shapeKind,
        x: pos.x,
        y: pos.y,
        w: 0,
        h: 0,
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

    // Allocate per-stroke offscreen buffer for translucent brushes so
    // overlapping segments composite at full opacity, not as visible dots.
    if (tool === "watercolor") {
      const main = canvasRef.current;
      if (main) {
        const buf = document.createElement("canvas");
        buf.width = main.width;
        buf.height = main.height;
        const bctx = buf.getContext("2d");
        if (bctx) {
          const ratio = window.devicePixelRatio || 1;
          bctx.setTransform(ratio, 0, 0, ratio, 0, 0);
        }
        strokeBufferRef.current = buf;
        strokeBufferAlphaRef.current = 0.18;
      }
    } else {
      strokeBufferRef.current = null;
    }

    const ctx = getCtx();
    if (ctx) {
      ctx.save();
      ctx.globalCompositeOperation = tool === "eraser" ? "destination-out" : "source-over";
      ctx.fillStyle = color;
      if (tool === "spray") {
        // No fat starter dot — emit a small spray burst instead.
        const radius = size;
        const density = Math.max(6, Math.round(size * 1.2));
        for (let i = 0; i < density; i++) {
          const a = Math.random() * Math.PI * 2;
          const r = Math.random() * radius;
          ctx.beginPath();
          ctx.arc(pos.x + Math.cos(a) * r, pos.y + Math.sin(a) * r, 0.6, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (tool === "watercolor" || tool === "crayon" || tool === "marker") {
        // Skip the solid starter dot for textured / translucent brushes —
        // it shows up as an obvious blob before the stroke begins.
      } else {
        const r = (tool === "pencil" ? Math.max(1, Math.round(size / 3)) : size) / 2;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    // Always track hover position for ghost cursor in shape/text mode.
    if (tool === "shape" || tool === "text") {
      setHoverPos(getPos(e));
    } else if (hoverPos) {
      setHoverPos(null);
    }

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

    if (tool === "shape" && shapeStartRef.current) {
      const pos = getPos(e);
      const start = shapeStartRef.current;
      const x = Math.min(start.x, pos.x);
      const y = Math.min(start.y, pos.y);
      const w = Math.abs(pos.x - start.x);
      const h = Math.abs(pos.y - start.y);
      setActiveShape((prev) =>
        prev ? { ...prev, x, y, w, h } : prev,
      );
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

    if (tool === "shape" && shapeStartRef.current) {
      shapeStartRef.current = null;
      drawingRef.current = false;
      // If the user just clicked (no drag), give the shape a sensible default
      // size so it's visible and editable instead of being collapsed to 0.
      setActiveShape((prev) => {
        if (!prev) return prev;
        if (prev.w < 8 || prev.h < 8) {
          const isLine = prev.kind === "line" || prev.kind === "diagonal-line";
          const dw = 200;
          const dh = isLine ? 200 : 140;
          return {
            ...prev,
            x: prev.x + prev.w / 2 - dw / 2,
            y: prev.y + prev.h / 2 - dh / 2,
            w: dw,
            h: dh,
          };
        }
        return prev;
      });
      return;
    }

    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (pendingPointsRef.current.length) flushStroke();

    // Commit translucent stroke buffer onto the main canvas at target alpha.
    if (strokeBufferRef.current) {
      const main = getCtx();
      if (main) {
        main.save();
        main.setTransform(1, 0, 0, 1, 0, 0);
        main.globalAlpha = strokeBufferAlphaRef.current;
        main.drawImage(strokeBufferRef.current, 0, 0);
        main.restore();
      }
      strokeBufferRef.current = null;
      clearPreview();
    }

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
    setPlacedShapes([]);
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

  // Composite the bitmap canvas + all placed/active shapes + selection into
  // a single canvas. Used by export and by paste/selection operations.
  function flattenToCanvas(): HTMLCanvasElement | null {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const out = document.createElement("canvas");
    out.width = canvas.width;
    out.height = canvas.height;
    const ctx = out.getContext("2d");
    if (!ctx) return null;
    const ratio = window.devicePixelRatio || 1;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.drawImage(canvas, 0, 0);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    for (const s of placedShapesRef.current) renderShape(ctx, s);
    if (activeShapeRef.current) renderShape(ctx, activeShapeRef.current);
    return out;
  }

  const exportImage = (format: "png" | "jpg" | "webp" | "pdf") => {
    if (activeShapeRef.current) commitActiveShape();
    if (selectionRef.current) commitSelection();
    const out = flattenToCanvas();
    if (!out) return;
    if (format === "pdf") {
      const ratio = window.devicePixelRatio || 1;
      const wPx = out.width / ratio;
      const hPx = out.height / ratio;
      const orientation = wPx >= hPx ? "landscape" : "portrait";
      const pdf = new jsPDF({ orientation, unit: "px", format: [wPx, hPx] });
      const dataUrl = out.toDataURL("image/png");
      pdf.addImage(dataUrl, "PNG", 0, 0, wPx, hPx);
      pdf.save("painting.pdf");
      return;
    }
    const mimeMap = { png: "image/png", jpg: "image/jpeg", webp: "image/webp" } as const;
    const mime = mimeMap[format];
    const ext = format;
    const quality = format === "png" ? undefined : 0.92;
    const url = out.toDataURL(mime, quality);
    const link = document.createElement("a");
    link.download = `painting.${ext}`;
    link.href = url;
    link.click();
  };

  // Apply a crop rectangle (in CSS pixels) to the bitmap canvas.
  const applyCrop = (rect: { x: number; y: number; w: number; h: number }) => {
    const canvas = canvasRef.current;
    const ctx = getCtx();
    if (!canvas || !ctx) return;
    if (rect.w < 4 || rect.h < 4) return;
    if (placedShapesRef.current.length > 0) {
      ctx.save();
      for (const s of placedShapesRef.current) renderShape(ctx, s);
      ctx.restore();
      setPlacedShapes([]);
    }
    if (selectionRef.current) commitSelection();

    const ratio = window.devicePixelRatio || 1;
    const px = Math.max(0, Math.round(rect.x * ratio));
    const py = Math.max(0, Math.round(rect.y * ratio));
    const pw = Math.min(canvas.width - px, Math.round(rect.w * ratio));
    const ph = Math.min(canvas.height - py, Math.round(rect.h * ratio));
    if (pw <= 0 || ph <= 0) return;

    // Snapshot the cropped region into a detached canvas.
    const snapshot = document.createElement("canvas");
    snapshot.width = pw;
    snapshot.height = ph;
    const sctx = snapshot.getContext("2d");
    if (!sctx) return;
    sctx.drawImage(canvas, px, py, pw, ph, 0, 0, pw, ph);

    // Switch to a custom canvas size — resizeCanvas will rebuild the
    // canvas at the new dimensions on the next layout pass.
    setTool("select");
    setCustomSize({ width: rect.w, height: rect.h });

    // After the layout/resize commits, paint the cropped snapshot back in.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const c = canvasRef.current;
        const cx = c?.getContext("2d");
        if (!c || !cx) return;
        cx.save();
        cx.setTransform(1, 0, 0, 1, 0, 0);
        cx.clearRect(0, 0, c.width, c.height);
        cx.fillStyle = "#ffffff";
        cx.fillRect(0, 0, c.width, c.height);
        cx.drawImage(snapshot, 0, 0);
        cx.restore();
        cx.setTransform(ratio, 0, 0, ratio, 0, 0);
        cx.lineCap = "round";
        cx.lineJoin = "round";
        pushHistory();
      });
    });
    toast.success("Cropped");
  };

  const commitPolyline = (draft: PolylineDraft) => {
    const ctx = getCtx();
    if (ctx && draft.points.length >= 2) {
      renderPolyline(ctx, draft);
      pushHistory();
    }
    setPolylineDraft(null);
    setTool("pencil");
  };

  const loadImageIntoCanvas = (img: HTMLImageElement) => {
    const canvas = canvasRef.current;
    const preview = previewRef.current;
    if (!canvas || !preview) return;
    setActiveShape(null);
    setSelection(null);
    setPlacedShapes([]);
    setPolylineDraft(null);
    clearPreview();
    const ratio = window.devicePixelRatio || 1;
    const cssW = img.naturalWidth;
    const cssH = img.naturalHeight;
    canvas.width = Math.floor(cssW * ratio);
    canvas.height = Math.floor(cssH * ratio);
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
    preview.width = canvas.width;
    preview.height = canvas.height;
    preview.style.width = `${cssW}px`;
    preview.style.height = `${cssH}px`;
    setCanvasSize({ width: cssW, height: cssH });
    const ctx = canvas.getContext("2d");
    const pctx = preview.getContext("2d");
    if (!ctx || !pctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    pctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    setCustomSize(null);
    setPresetId("fit");
    pushHistory();
    toast.success("Painting loaded");
  };

  const getPngBlob = async (): Promise<Blob | null> => {
    if (activeShapeRef.current) commitActiveShape();
    if (selectionRef.current) commitSelection();
    const out = flattenToCanvas();
    if (!out) return null;
    return await new Promise((res) => out.toBlob((b) => res(b), "image/png"));
  };

  const handleSlotSave = (idx: number, hex: string) => {
    setCustomSlots((prev) => {
      const next = prev.slice();
      next[Math.max(0, Math.min(4, idx))] = hex;
      return next;
    });
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
  const currentBrush =
    BRUSHES.find((b) => b.id === tool) ?? BRUSHES.find((b) => b.id === lastBrush) ?? BRUSHES[0];
  const BrushIcon = currentBrush.icon;
  const isBrushActive = BRUSH_TOOLS.includes(tool) || tool === "eraser" || tool === "fill" || tool === "picker";
  const containerRect = canvasSize.width > 0 && canvasSize.height > 0
    ? { width: canvasSize.width, height: canvasSize.height }
    : undefined;

  return (
    <div className="flex h-screen w-screen flex-col bg-background text-foreground">
      {/* Top bar */}
      <header className="flex h-12 items-center justify-between border-b border-border bg-toolbar px-4 shadow-soft">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-semibold tracking-tight">ClassicPaint</h1>
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
                    onSelect={() => { setCustomSize(null); setPresetId(p.id); }}
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
          {tool === "crop" && (
            <div className="mr-2 flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Aspect:</span>
              <Select value={cropAspect} onValueChange={(v) => setCropAspect(v as CropAspect)}>
                <SelectTrigger className="h-8 w-[110px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">Free</SelectItem>
                  <SelectItem value="1:1">Square 1:1</SelectItem>
                  <SelectItem value="4:3">4:3</SelectItem>
                  <SelectItem value="16:9">16:9</SelectItem>
                </SelectContent>
              </Select>
              <div className="mx-1 h-5 w-px bg-border" />
            </div>
          )}
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
              <Toggle
                size="sm"
                pressed={textBold}
                onPressedChange={setTextBold}
                aria-label="Bold"
                className="h-8 w-8 p-0 data-[state=on]:bg-tool-active data-[state=on]:text-accent-foreground"
              >
                <Bold className="h-3.5 w-3.5" />
              </Toggle>
              <Toggle
                size="sm"
                pressed={textItalic}
                onPressedChange={setTextItalic}
                aria-label="Italic"
                className="h-8 w-8 p-0 data-[state=on]:bg-tool-active data-[state=on]:text-accent-foreground"
              >
                <Italic className="h-3.5 w-3.5" />
              </Toggle>
              <Toggle
                size="sm"
                pressed={textUnderline}
                onPressedChange={setTextUnderline}
                aria-label="Underline"
                className="h-8 w-8 p-0 data-[state=on]:bg-tool-active data-[state=on]:text-accent-foreground"
              >
                <Underline className="h-3.5 w-3.5" />
              </Toggle>
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
              <div className="flex items-center gap-2 px-1">
                <ZoomOut className="h-3.5 w-3.5 text-muted-foreground" />
                <div className="w-32">
                  <Slider
                    value={[
                      Math.round(
                        ((Math.log(zoom) - Math.log(ZOOM_MIN)) /
                          (Math.log(ZOOM_MAX) - Math.log(ZOOM_MIN))) *
                          100,
                      ),
                    ]}
                    min={0}
                    max={100}
                    step={1}
                    onValueChange={(v) => {
                      const t = v[0] / 100;
                      const z =
                        Math.exp(Math.log(ZOOM_MIN) + t * (Math.log(ZOOM_MAX) - Math.log(ZOOM_MIN)));
                      setZoom(clampZoom(Math.round(z * 100) / 100));
                    }}
                    onDoubleClick={() => setZoom(1)}
                    aria-label="Zoom"
                  />
                </div>
                <ZoomIn className="h-3.5 w-3.5 text-muted-foreground" />
                <button
                  type="button"
                  onClick={() => setZoom(1)}
                  className="min-w-[44px] rounded px-1 text-xs tabular-nums text-muted-foreground hover:text-foreground"
                >
                  {Math.round(zoom * 100)}%
                </button>
              </div>
            </TooltipTrigger>
            <TooltipContent>Drag to zoom · click % to reset</TooltipContent>
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
          {user ? (
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 gap-1.5 px-2 text-xs">
                      <UserIcon className="h-3.5 w-3.5" />
                      <span className="max-w-[80px] truncate">
                        {user.user_metadata?.display_name ?? user.email?.split("@")[0]}
                      </span>
                      <ChevronDown className="h-3 w-3 opacity-60" />
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent>Account</TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => setSaveDialogOpen(true)} className="text-xs">
                  <Save className="mr-2 h-3 w-3" /> My paintings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => signOut()} className="text-xs">
                  <LogOut className="mr-2 h-3 w-3" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 gap-1.5 px-2 text-xs" asChild>
                  <Link to="/auth">
                    <LogIn className="h-3.5 w-3.5" /> Sign in
                  </Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Sign in to save</TooltipContent>
            </Tooltip>
          )}
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
              <DropdownMenuItem onSelect={() => exportImage("webp")} className="text-xs">
                WebP image
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => exportImage("pdf")} className="text-xs">
                PDF document
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

          {/* Brushes / hand tools dropdown — pencil, brush, marker, etc. */}
          <Popover open={brushesMenuOpen} onOpenChange={setBrushesMenuOpen}>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <button
                    onClick={() => {
                      if (activeShapeRef.current) commitActiveShape();
                      if (selectionRef.current) commitSelection();
                      setTool(lastBrush);
                    }}
                    className={cn(
                      "relative flex h-10 w-10 shrink-0 items-center justify-center rounded-md transition-colors",
                      isBrushActive
                        ? "bg-tool-active text-accent-foreground"
                        : "text-foreground hover:bg-tool-hover",
                    )}
                    aria-label="Brushes"
                    aria-pressed={isBrushActive}
                  >
                    <BrushIcon className="h-[18px] w-[18px]" />
                    <ChevronDown className="absolute bottom-0.5 right-0.5 h-2.5 w-2.5 opacity-70" />
                  </button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent side="right">
                Brushes <span className="ml-1 text-muted-foreground">(B)</span>
              </TooltipContent>
            </Tooltip>
            <PopoverContent side="right" align="start" className="w-[220px] p-2">
              <div className="mb-2 px-1 text-[11px] font-medium text-muted-foreground">
                Brushes &amp; tools
              </div>
              <div className="grid grid-cols-4 gap-1">
                {BRUSHES.map((b) => {
                  const Icon = b.icon;
                  const active = tool === b.id;
                  return (
                    <Tooltip key={b.id}>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => {
                            if (activeShapeRef.current) commitActiveShape();
                            if (selectionRef.current) commitSelection();
                            setTool(b.id);
                            setLastBrush(b.id);
                            setBrushesMenuOpen(false);
                          }}
                          className={cn(
                            "flex h-9 w-9 items-center justify-center rounded-md transition-colors",
                            active
                              ? "bg-tool-active text-accent-foreground"
                              : "text-foreground hover:bg-tool-hover",
                          )}
                          aria-label={b.label}
                          aria-pressed={active}
                        >
                          <Icon className="h-4 w-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">
                        {b.label}
                        {b.shortcut && (
                          <span className="ml-1 text-muted-foreground">({b.shortcut})</span>
                        )}
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>

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

          {/* Text tool */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => {
                  if (activeShapeRef.current) commitActiveShape();
                  if (selectionRef.current) commitSelection();
                  setTool("text");
                }}
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-md transition-colors",
                  tool === "text"
                    ? "bg-tool-active text-accent-foreground"
                    : "text-foreground hover:bg-tool-hover",
                )}
                aria-label="Text"
                aria-pressed={tool === "text"}
              >
                <Type className="h-[18px] w-[18px]" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">
              Text <span className="ml-1 text-muted-foreground">(T)</span>
            </TooltipContent>
          </Tooltip>

          {/* Bendable / multi-point lines */}
          <Popover>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <button
                    className={cn(
                      "relative flex h-10 w-10 shrink-0 items-center justify-center rounded-md transition-colors",
                      tool === "polyline"
                        ? "bg-tool-active text-accent-foreground"
                        : "text-foreground hover:bg-tool-hover",
                    )}
                    aria-label="Bendable lines"
                    aria-pressed={tool === "polyline"}
                  >
                    <Spline className="h-[18px] w-[18px]" />
                    <ChevronDown className="absolute bottom-0.5 right-0.5 h-2.5 w-2.5 opacity-70" />
                  </button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent side="right">Bendable lines</TooltipContent>
            </Tooltip>
            <PopoverContent side="right" align="start" className="w-[220px] p-2">
              <div className="mb-2 px-1 text-[11px] font-medium text-muted-foreground">
                Lines &amp; curves — pick one, then click on the canvas to drop each point
              </div>
              <div className="space-y-1">
                {POLYLINE_KINDS.map((k) => (
                  <button
                    key={k.id}
                    onClick={() => {
                      if (activeShapeRef.current) commitActiveShape();
                      if (selectionRef.current) commitSelection();
                      setPolylineKind(k.id);
                      setPolylineDraft({
                        pointCount: k.points,
                        curved: k.curved,
                        color,
                        strokeWidth: size,
                        points: [],
                      });
                      setTool("polyline");
                    }}
                    className={cn(
                      "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-xs transition-colors",
                      polylineKind === k.id && tool === "polyline"
                        ? "bg-tool-active text-accent-foreground"
                        : "hover:bg-tool-hover",
                    )}
                  >
                    <span>{k.label}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {k.curved ? "curved" : "straight"}
                    </span>
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          {/* Crop tool */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => {
                  if (activeShapeRef.current) commitActiveShape();
                  if (selectionRef.current) commitSelection();
                  setTool("crop");
                }}
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-md transition-colors",
                  tool === "crop"
                    ? "bg-tool-active text-accent-foreground"
                    : "text-foreground hover:bg-tool-hover",
                )}
                aria-label="Crop"
                aria-pressed={tool === "crop"}
              >
                <Crop className="h-[18px] w-[18px]" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">Crop canvas</TooltipContent>
          </Tooltip>

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
        <main
          ref={mainRef}
          className="relative flex-1 overflow-auto bg-secondary"
          onWheel={(e) => {
            if (!(e.ctrlKey || e.metaKey)) return;
            e.preventDefault();
            const delta = e.deltaY > 0 ? -0.1 : 0.1;
            setZoom((z) => clampZoom(Math.round((z + delta) * 100) / 100));
          }}
          onContextMenu={(e) => {
            // Always suppress the native menu — we either pan or show our own.
            e.preventDefault();
            const surface = containerRef.current;
            if (!surface || !surface.contains(e.target as Node)) return;
            if (panRef.current?.moved || suppressContextMenuRef.current) {
              suppressContextMenuRef.current = false;
              return;
            }
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            setCtxMenu({ x: e.clientX - rect.left, y: e.clientY - rect.top });
          }}
          onPointerDown={(e) => {
            if (e.button !== 2) return;
            const main = mainRef.current;
            const surface = containerRef.current;
            if (!main || !surface || !surface.contains(e.target as Node)) return;
            e.preventDefault();
            suppressContextMenuRef.current = false;
            panRef.current = {
              startX: e.clientX,
              startY: e.clientY,
              scrollLeft: main.scrollLeft,
              scrollTop: main.scrollTop,
              moved: false,
            };
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            setCtxMenu(null);
          }}
          onPointerMove={(e) => {
            const p = panRef.current;
            const main = mainRef.current;
            if (!p || !main) return;
            e.preventDefault();
            const dx = e.clientX - p.startX;
            const dy = e.clientY - p.startY;
            if (!p.moved && Math.hypot(dx, dy) > 4) {
              p.moved = true;
              suppressContextMenuRef.current = true;
            }
            if (p.moved) {
              main.scrollLeft = p.scrollLeft - dx;
              main.scrollTop = p.scrollTop - dy;
            }
          }}
          onPointerUp={(e) => {
            if (e.button !== 2) return;
            e.preventDefault();
            try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* noop */ }
            // Keep panRef.moved through the synthesized contextmenu event so
            // we can suppress the menu when the user actually panned, then
            // clear it on the next frame.
            requestAnimationFrame(() => { panRef.current = null; });
          }}
          onPointerCancel={() => { panRef.current = null; }}
          style={{ cursor: panRef.current?.moved ? "grabbing" : undefined }}
        >
          <div
            className="flex min-h-full min-w-full items-center justify-center p-4"
            style={{
              width: Math.max(canvasSize.width * zoom + 32, mainRef.current?.clientWidth ?? 0),
              height: Math.max(canvasSize.height * zoom + 32, mainRef.current?.clientHeight ?? 0),
            }}
          >
            <div
              className="relative shrink-0"
              style={{
                width: Math.max(1, canvasSize.width * zoom),
                height: Math.max(1, canvasSize.height * zoom),
              }}
            >
              <div
                ref={containerRef}
                className="relative origin-top-left overflow-hidden rounded-lg border border-border bg-canvas shadow-panel"
                style={{
                  width: Math.max(1, canvasSize.width),
                  height: Math.max(1, canvasSize.height),
                  transform: `scale(${zoom})`,
                  transformOrigin: "top left",
                }}
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
              onPointerLeave={() => {
                endStroke();
                setHoverPos(null);
              }}
              onDoubleClick={onCanvasDoubleClick}
            />

            {/* Ghost cursor: shown when about to place a shape or text box,
                so the user knows exactly where the object will land. */}
            {hoverPos && (tool === "shape" || tool === "text") && !activeShape && !drawingRef.current && (
              <div
                className="pointer-events-none absolute z-10"
                style={{ left: hoverPos.x, top: hoverPos.y }}
              >
                {tool === "text" ? (
                  <div
                    className="absolute"
                    style={{
                      left: 0,
                      top: 0,
                      width: 1,
                      height: Math.max(12, fontSize),
                      background: "hsl(var(--tool-active))",
                      animation: "pulse 1s ease-in-out infinite",
                    }}
                  />
                ) : (
                  <div
                    className="absolute -translate-x-1/2 -translate-y-1/2 rounded-sm border border-dashed border-tool-active/70 bg-tool-active/10"
                    style={{ width: 24, height: 24 }}
                  />
                )}
              </div>
            )}

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

            {/* Crop overlay */}
            {tool === "crop" && containerRect && (
              <CropOverlay
                cssWidth={containerRect.width}
                cssHeight={containerRect.height}
                aspect={cropAspect}
                onCancel={() => setTool("select")}
                onConfirm={applyCrop}
              />
            )}

            {/* Polyline (bendable line) editor */}
            {tool === "polyline" && polylineDraft && (
              <PolylineEditor
                draft={polylineDraft}
                cssWidth={containerRect?.width ?? 0}
                cssHeight={containerRect?.height ?? 0}
                onChange={setPolylineDraft}
                onCancel={() => {
                  setPolylineDraft(null);
                  setTool("pencil");
                }}
                onCommit={commitPolyline}
              />
            )}
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
                    fontWeight: textBold ? 700 : 400,
                    fontStyle: textItalic ? "italic" : "normal",
                    textDecoration: textUnderline ? "underline" : "none",
                    lineHeight: 1.2,
                  }}
                />
              </div>
            )}
              </div>
            </div>
          </div>
          {ctxMenu && (
            <>
              <div
                className="fixed inset-0 z-40"
                onPointerDown={() => setCtxMenu(null)}
                onContextMenu={(e) => { e.preventDefault(); setCtxMenu(null); }}
              />
              <div
                role="menu"
                className="absolute z-50 min-w-[160px] overflow-hidden rounded-md border border-border bg-popover py-1 text-xs text-popover-foreground shadow-md"
                style={{ left: ctxMenu.x, top: ctxMenu.y }}
              >
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-3 py-1.5 text-left hover:bg-accent hover:text-accent-foreground"
                  onClick={async () => { await copyToClipboard(); setCtxMenu(null); }}
                >
                  <span>Copy</span><span className="ml-4 text-muted-foreground">⌘C</span>
                </button>
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-3 py-1.5 text-left hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
                  disabled={!selection}
                  onClick={async () => { await cutToClipboard(); setCtxMenu(null); }}
                >
                  <span>Cut</span><span className="ml-4 text-muted-foreground">⌘X</span>
                </button>
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-3 py-1.5 text-left hover:bg-accent hover:text-accent-foreground"
                  onClick={async () => { await pasteFromClipboard(); setCtxMenu(null); }}
                >
                  <span>Paste</span><span className="ml-4 text-muted-foreground">⌘V</span>
                </button>
                <div className="my-1 h-px bg-border" />
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-3 py-1.5 text-left hover:bg-accent hover:text-accent-foreground"
                  onClick={() => { undo(); setCtxMenu(null); }}
                  disabled={!canUndo}
                >
                  <span>Undo</span><span className="ml-4 text-muted-foreground">⌘Z</span>
                </button>
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-3 py-1.5 text-left hover:bg-accent hover:text-accent-foreground"
                  onClick={() => { redo(); setCtxMenu(null); }}
                  disabled={!canRedo}
                >
                  <span>Redo</span><span className="ml-4 text-muted-foreground">⌘Y</span>
                </button>
              </div>
            </>
          )}
        </main>
      </div>

      {/* Bottom palette */}
      <footer className="flex flex-wrap items-center gap-4 border-t border-border bg-toolbar px-4 py-3 shadow-soft">
        <div className="flex items-center gap-2">
          <span
            className="h-7 w-7 rounded-md border border-border shadow-soft"
            style={{ backgroundColor: color }}
            aria-label="Current color"
          />
          <ColorPickerPopover
            color={color}
            onChange={(c) => {
              setColor(c);
              if (activeShape) setActiveShape({ ...activeShape, color: c });
              if (polylineDraft) setPolylineDraft({ ...polylineDraft, color: c });
            }}
            customSlots={customSlots}
            onSaveSlot={handleSlotSave}
          />
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
                  if (polylineDraft) setPolylineDraft({ ...polylineDraft, color: c });
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

        {/* 5 custom color slots */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Custom</span>
          {customSlots.map((slot, i) => (
            <button
              key={i}
              onClick={() => slot && setColor(slot)}
              onContextMenu={(e) => { e.preventDefault(); handleSlotSave(i, color); }}
              title={slot ? `${slot} (right-click to overwrite)` : "Empty — right-click to save current"}
              className={cn(
                "h-6 w-6 rounded-md border transition-transform hover:scale-110",
                slot ? "border-border" : "border-dashed border-border bg-muted/40",
                slot && slot.toLowerCase() === color.toLowerCase() && "ring-2 ring-tool-active/40",
              )}
              style={{ backgroundColor: slot || undefined }}
              aria-label={slot ? `Custom slot ${i + 1}` : `Empty slot ${i + 1}`}
            >
              {!slot && <span className="text-[10px] text-muted-foreground">+</span>}
            </button>
          ))}
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
          <span>
            {tool === "shape"
              ? `Shape: ${currentShape.label}`
              : TOOLS.find((t) => t.id === tool)?.label
                ?? BRUSHES.find((b) => b.id === tool)?.label
                ?? (tool === "text" ? "Text" : tool)}
          </span>
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
                setCustomSize(null);
                wipeCanvas();
                setConfirmNew(false);
              }}
            >
              New canvas
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <SaveLoadDialog
        open={saveDialogOpen}
        onOpenChange={setSaveDialogOpen}
        getPngBlob={getPngBlob}
        onLoad={loadImageIntoCanvas}
      />
    </div>
  );
};

export default PaintApp;
