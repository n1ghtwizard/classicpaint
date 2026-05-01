import { useEffect, useRef } from "react";

export interface FloatingSelection {
  // Original position the region was lifted from (in CSS pixels, canvas-local)
  originX: number;
  originY: number;
  // Current top-left position of the floating region
  x: number;
  y: number;
  // Size in CSS pixels (matches imageData / ratio)
  w: number;
  h: number;
  // The lifted bitmap, sized to physical pixels (devicePixelRatio applied).
  imageData: ImageData;
}

interface Props {
  selection: FloatingSelection;
  onChange: (s: FloatingSelection) => void;
  onCommit: () => void;
}

type HandleId = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

const HANDLE_OFFSETS: Record<HandleId, [number, number]> = {
  nw: [0, 0],
  n: [0.5, 0],
  ne: [1, 0],
  e: [1, 0.5],
  se: [1, 1],
  s: [0.5, 1],
  sw: [0, 1],
  w: [0, 0.5],
};

const HANDLE_CURSORS: Record<HandleId, string> = {
  nw: "nwse-resize",
  n: "ns-resize",
  ne: "nesw-resize",
  e: "ew-resize",
  se: "nwse-resize",
  s: "ns-resize",
  sw: "nesw-resize",
  w: "ew-resize",
};

interface DragState {
  mode: "move" | HandleId;
  startPointer: { x: number; y: number };
  startSel: FloatingSelection;
}

/**
 * Floating bounding box for the lifted selection. The bitmap itself is drawn
 * on the preview canvas by the parent; this component only renders the
 * dashed outline + handles users grab to move or resize the region.
 */
export function SelectionLayer({ selection, onChange, onCommit }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const selRef = useRef(selection);
  selRef.current = selection;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const p = localPos(e);
      const dx = p.x - drag.startPointer.x;
      const dy = p.y - drag.startPointer.y;
      const start = drag.startSel;
      if (drag.mode === "move") {
        onChangeRef.current({ ...start, x: start.x + dx, y: start.y + dy });
        return;
      }
      // Resize: adjust edges based on which handle is being dragged.
      let x = start.x;
      let y = start.y;
      let w = start.w;
      let h = start.h;
      const id = drag.mode;
      if (id.includes("e")) w = start.w + dx;
      if (id.includes("w")) { w = start.w - dx; x = start.x + dx; }
      if (id.includes("s")) h = start.h + dy;
      if (id.includes("n")) { h = start.h - dy; y = start.y + dy; }
      const min = 4;
      if (w < min) {
        if (id.includes("w")) x = start.x + start.w - min;
        w = min;
      }
      if (h < min) {
        if (id.includes("n")) y = start.y + start.h - min;
        h = min;
      }
      onChangeRef.current({ ...start, x, y, w, h });
    };
    const onUp = () => {
      dragRef.current = null;
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      if (e.key === "Enter") {
        e.preventDefault();
        onCommit();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCommit]);

  const localPos = (e: React.PointerEvent | PointerEvent) => {
    const overlay = overlayRef.current;
    if (!overlay) return { x: 0, y: 0 };
    const rect = overlay.getBoundingClientRect();
    return {
      x: rect.width ? ((e.clientX - rect.left) / rect.width) * overlay.clientWidth : 0,
      y: rect.height ? ((e.clientY - rect.top) / rect.height) * overlay.clientHeight : 0,
    };
  };

  const startDrag = (mode: DragState["mode"]) => (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    dragRef.current = {
      mode,
      startPointer: localPos(e),
      startSel: selRef.current,
    };
  };

  return (
    <div ref={overlayRef} className="pointer-events-none absolute inset-0 z-20">
      <div
        className="pointer-events-auto absolute cursor-move border-2 border-dashed border-tool-active"
        style={{
          left: selection.x,
          top: selection.y,
          width: selection.w,
          height: selection.h,
          boxShadow: "0 0 0 1px hsl(var(--canvas))",
        }}
        onPointerDown={startDrag("move")}
      />
      {(Object.keys(HANDLE_OFFSETS) as HandleId[]).map((id) => {
        const [u, v] = HANDLE_OFFSETS[id];
        return (
          <div
            key={id}
            onPointerDown={startDrag(id)}
            className="pointer-events-auto absolute h-2.5 w-2.5 rounded-sm border border-tool-active bg-canvas shadow-soft"
            style={{
              left: selection.x + u * selection.w,
              top: selection.y + v * selection.h,
              transform: "translate(-50%, -50%)",
              cursor: HANDLE_CURSORS[id],
            }}
          />
        );
      })}
    </div>
  );
}
