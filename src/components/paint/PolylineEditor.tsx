import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, X } from "lucide-react";

export interface PolylineDraft {
  // Number of vertices to collect (2-5).
  pointCount: number;
  // Whether straight (polyline) or smoothed (Catmull-Rom-ish curve).
  curved: boolean;
  color: string;
  strokeWidth: number;
  points: { x: number; y: number }[];
}

interface Props {
  draft: PolylineDraft;
  cssWidth: number;
  cssHeight: number;
  onChange: (d: PolylineDraft) => void;
  onCancel: () => void;
  onCommit: (d: PolylineDraft) => void;
}

/**
 * Click to drop the next vertex. Once `pointCount` vertices are placed, the
 * user can drag any handle to fine-tune, then press Confirm / Enter.
 */
export function PolylineEditor({ draft, cssWidth, cssHeight, onChange, onCancel, onCommit }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const dragIdxRef = useRef<number | null>(null);

  const localPos = (e: React.PointerEvent | PointerEvent) => {
    const overlay = overlayRef.current!;
    const r = overlay.getBoundingClientRect();
    return {
      x: r.width ? ((e.clientX - r.left) / r.width) * overlay.clientWidth : 0,
      y: r.height ? ((e.clientY - r.top) / r.height) * overlay.clientHeight : 0,
    };
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
      else if (e.key === "Enter" && draft.points.length === draft.pointCount) onCommit(draft);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [draft, onCancel, onCommit]);

  const placing = draft.points.length < draft.pointCount;

  const onDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    (e.target as Element).setPointerCapture(e.pointerId);
    const p = localPos(e);
    if (placing) {
      onChange({ ...draft, points: [...draft.points, p] });
      return;
    }
    // Hit-test handles to start a drag
    for (let i = 0; i < draft.points.length; i++) {
      const pt = draft.points[i];
      if (Math.hypot(pt.x - p.x, pt.y - p.y) < 14) {
        dragIdxRef.current = i;
        return;
      }
    }
  };

  const onMove = (e: React.PointerEvent) => {
    const p = localPos(e);
    setHover(p);
    const idx = dragIdxRef.current;
    if (idx != null) {
      const pts = draft.points.slice();
      pts[idx] = p;
      onChange({ ...draft, points: pts });
    }
  };

  const onUp = () => { dragIdxRef.current = null; };

  // Build SVG path: straight polyline OR smooth Catmull-Rom for "curved".
  const pts = draft.points;
  let pathD = "";
  if (pts.length > 0) {
    pathD = `M ${pts[0].x} ${pts[0].y}`;
    if (!draft.curved) {
      for (let i = 1; i < pts.length; i++) pathD += ` L ${pts[i].x} ${pts[i].y}`;
    } else {
      // Smooth curve through points using Catmull-Rom -> Bezier conversion.
      for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[i - 1] ?? pts[i];
        const p1 = pts[i];
        const p2 = pts[i + 1];
        const p3 = pts[i + 2] ?? pts[i + 1];
        const c1x = p1.x + (p2.x - p0.x) / 6;
        const c1y = p1.y + (p2.y - p0.y) / 6;
        const c2x = p2.x - (p3.x - p1.x) / 6;
        const c2y = p2.y - (p3.y - p1.y) / 6;
        pathD += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
      }
    }
  }

  // Preview line from last placed point to cursor while still placing.
  let ghostD = "";
  if (placing && pts.length > 0 && hover) {
    const last = pts[pts.length - 1];
    ghostD = `M ${last.x} ${last.y} L ${hover.x} ${hover.y}`;
  }

  const done = pts.length === draft.pointCount;

  return (
    <div
      ref={overlayRef}
      className="absolute inset-0 z-30"
      style={{ cursor: placing ? "crosshair" : "default" }}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onPointerLeave={() => setHover(null)}
    >
      <svg className="pointer-events-none absolute inset-0 h-full w-full">
        {pathD && (
          <path
            d={pathD}
            fill="none"
            stroke={draft.color}
            strokeWidth={draft.strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
        {ghostD && (
          <path
            d={ghostD}
            fill="none"
            stroke="hsl(var(--tool-active))"
            strokeWidth={1}
            strokeDasharray="4 4"
          />
        )}
        {pts.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={6}
            fill="hsl(var(--canvas))"
            stroke="hsl(var(--tool-active))"
            strokeWidth={1.5}
          />
        ))}
      </svg>

      <div
        className="absolute flex items-center gap-2 rounded-md bg-card px-2 py-1 text-xs shadow-panel"
        style={{ left: 12, top: 12 }}
      >
        <span className="text-muted-foreground">
          {placing
            ? `Click to place point ${pts.length + 1} of ${draft.pointCount}`
            : "Drag handles to adjust · Enter to confirm"}
        </span>
        <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={onCancel}>
          <X className="h-3 w-3" />
        </Button>
        <Button
          size="sm"
          className="h-6 px-2 text-xs"
          onClick={() => onCommit(draft)}
          disabled={!done}
        >
          <Check className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

// Render a polyline draft directly to a 2D canvas context (used to bake the
// committed line into the bitmap layer).
export function renderPolyline(ctx: CanvasRenderingContext2D, draft: PolylineDraft) {
  if (draft.points.length < 2) return;
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.strokeStyle = draft.color;
  ctx.lineWidth = Math.max(1, draft.strokeWidth);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  const pts = draft.points;
  ctx.moveTo(pts[0].x, pts[0].y);
  if (!draft.curved) {
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  } else {
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] ?? pts[i];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2] ?? pts[i + 1];
      const c1x = p1.x + (p2.x - p0.x) / 6;
      const c1y = p1.y + (p2.y - p0.y) / 6;
      const c2x = p2.x - (p3.x - p1.x) / 6;
      const c2y = p2.y - (p3.y - p1.y) / 6;
      ctx.bezierCurveTo(c1x, c1y, c2x, c2y, p2.x, p2.y);
    }
  }
  ctx.stroke();
  ctx.restore();
}
