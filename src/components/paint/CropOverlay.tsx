import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, X } from "lucide-react";

export type CropAspect = "free" | "1:1" | "4:3" | "16:9";

interface Props {
  cssWidth: number;
  cssHeight: number;
  aspect: CropAspect;
  onCancel: () => void;
  onConfirm: (rect: { x: number; y: number; w: number; h: number }) => void;
}

interface Rect { x: number; y: number; w: number; h: number; }

function aspectRatio(a: CropAspect): number | null {
  if (a === "1:1") return 1;
  if (a === "4:3") return 4 / 3;
  if (a === "16:9") return 16 / 9;
  return null;
}

export function CropOverlay({ cssWidth, cssHeight, aspect, onCancel, onConfirm }: Props) {
  const [rect, setRect] = useState<Rect | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ mode: "create" | "move"; sx: number; sy: number; orig?: Rect } | null>(null);

  // Re-clamp / re-fit when aspect changes.
  useEffect(() => {
    if (!rect) return;
    const ar = aspectRatio(aspect);
    if (ar == null) return;
    const newH = rect.w / ar;
    setRect({ ...rect, h: Math.min(newH, cssHeight - rect.y) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aspect]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
      else if (e.key === "Enter" && rect) onConfirm(rect);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel, onConfirm, rect]);

  const localPos = (e: React.PointerEvent | PointerEvent) => {
    const r = overlayRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const onDown = (e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as Element).setPointerCapture(e.pointerId);
    const p = localPos(e);
    if (rect && p.x >= rect.x && p.x <= rect.x + rect.w && p.y >= rect.y && p.y <= rect.y + rect.h) {
      dragRef.current = { mode: "move", sx: p.x, sy: p.y, orig: rect };
    } else {
      dragRef.current = { mode: "create", sx: p.x, sy: p.y };
      setRect({ x: p.x, y: p.y, w: 0, h: 0 });
    }
  };

  const onMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const p = localPos(e);
    if (drag.mode === "create") {
      let x = Math.min(drag.sx, p.x);
      let y = Math.min(drag.sy, p.y);
      let w = Math.abs(p.x - drag.sx);
      let h = Math.abs(p.y - drag.sy);
      const ar = aspectRatio(aspect);
      if (ar != null) {
        // Lock height to width based on aspect; keep upper-left anchor consistent.
        h = w / ar;
        if (p.y < drag.sy) y = drag.sy - h;
      }
      // Clamp
      x = Math.max(0, x); y = Math.max(0, y);
      w = Math.min(w, cssWidth - x); h = Math.min(h, cssHeight - y);
      setRect({ x, y, w, h });
    } else if (drag.mode === "move" && drag.orig) {
      const dx = p.x - drag.sx;
      const dy = p.y - drag.sy;
      const x = Math.max(0, Math.min(cssWidth - drag.orig.w, drag.orig.x + dx));
      const y = Math.max(0, Math.min(cssHeight - drag.orig.h, drag.orig.y + dy));
      setRect({ ...drag.orig, x, y });
    }
  };

  const onUp = () => { dragRef.current = null; };

  return (
    <div
      ref={overlayRef}
      className="absolute inset-0 z-30 cursor-crosshair"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    >
      {/* Dark mask */}
      {rect ? (
        <svg className="pointer-events-none absolute inset-0 h-full w-full">
          <defs>
            <mask id="crop-mask">
              <rect width="100%" height="100%" fill="white" />
              <rect x={rect.x} y={rect.y} width={rect.w} height={rect.h} fill="black" />
            </mask>
          </defs>
          <rect width="100%" height="100%" fill="rgba(0,0,0,0.5)" mask="url(#crop-mask)" />
        </svg>
      ) : (
        <div className="pointer-events-none absolute inset-0 bg-black/50" />
      )}

      {rect && rect.w > 4 && rect.h > 4 && (
        <>
          <div
            className="pointer-events-none absolute border-2 border-dashed border-tool-active"
            style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}
          />
          <div
            className="absolute flex gap-1.5 rounded-md bg-card p-1 shadow-panel"
            style={{
              left: Math.max(0, Math.min(cssWidth - 90, rect.x + rect.w - 90)),
              top: Math.min(cssHeight - 36, rect.y + rect.h + 4),
            }}
          >
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={onCancel}>
              <X className="mr-1 h-3 w-3" /> Cancel
            </Button>
            <Button size="sm" className="h-7 px-2 text-xs" onClick={() => onConfirm(rect)}>
              <Check className="mr-1 h-3 w-3" /> Crop
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
