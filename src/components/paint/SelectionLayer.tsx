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

interface DragState {
  startPointer: { x: number; y: number };
  startX: number;
  startY: number;
}

/**
 * Floating bounding box for the lifted selection. The bitmap itself is drawn
 * on the preview canvas by the parent; this component only renders the
 * dashed outline + handles users grab to move the region.
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
      const cur = selRef.current;
      if (!drag || !cur) return;
      const p = localPos(e);
      const dx = p.x - drag.startPointer.x;
      const dy = p.y - drag.startPointer.y;
      onChangeRef.current({
        ...cur,
        x: drag.startX + dx,
        y: drag.startY + dy,
      });
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

  const startDrag = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    dragRef.current = {
      startPointer: localPos(e),
      startX: selection.x,
      startY: selection.y,
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
        onPointerDown={startDrag}
      />
    </div>
  );
}
