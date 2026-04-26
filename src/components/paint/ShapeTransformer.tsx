import { useEffect, useRef, useState } from "react";
import type { DrawnShape } from "./shapes";

interface Props {
  shape: DrawnShape;
  containerWidth: number;
  containerHeight: number;
  onChange: (s: DrawnShape) => void;
  onCommit: () => void;
}

type HandleId = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "rotate" | "move";

interface DragState {
  handle: HandleId;
  startPointer: { x: number; y: number };
  startShape: DrawnShape;
}

const HANDLE_OFFSETS: Record<Exclude<HandleId, "rotate" | "move">, [number, number]> = {
  nw: [0, 0],
  n: [0.5, 0],
  ne: [1, 0],
  e: [1, 0.5],
  se: [1, 1],
  s: [0.5, 1],
  sw: [0, 1],
  w: [0, 0.5],
};

export function ShapeTransformer({ shape, onChange, onCommit }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const [, force] = useState(0);

  // Keep latest props accessible inside global pointer listeners.
  const shapeRef = useRef(shape);
  shapeRef.current = shape;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const drag = dragRef.current;
      const overlay = overlayRef.current;
      if (!drag || !overlay) return;
      const rect = overlay.getBoundingClientRect();
      const pointer = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      const next = applyDrag(drag, pointer, e.shiftKey);
      onChangeRef.current(next);
      force((n) => n + 1);
    };
    const onUp = () => {
      if (dragRef.current) {
        dragRef.current = null;
      }
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

  // Commit (rasterize the shape) when Enter is pressed.
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

  const startDrag = (handle: HandleId) => (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const overlay = overlayRef.current;
    if (!overlay) return;
    const rect = overlay.getBoundingClientRect();
    dragRef.current = {
      handle,
      startPointer: { x: e.clientX - rect.left, y: e.clientY - rect.top },
      startShape: { ...shapeRef.current },
    };
  };

  const cx = shape.x + shape.w / 2;
  const cy = shape.y + shape.h / 2;
  const cos = Math.cos(shape.rotation);
  const sin = Math.sin(shape.rotation);

  // Compute screen positions of the 8 resize handles by rotating around the center.
  const handlePos = (id: Exclude<HandleId, "rotate" | "move">) => {
    const [u, v] = HANDLE_OFFSETS[id];
    const lx = (u - 0.5) * shape.w;
    const ly = (v - 0.5) * shape.h;
    return { x: cx + lx * cos - ly * sin, y: cy + lx * sin + ly * cos };
  };

  // Rotation handle sits 28px above the top edge.
  const rotateLocal = { x: 0, y: -shape.h / 2 - 28 };
  const rotatePos = {
    x: cx + rotateLocal.x * cos - rotateLocal.y * sin,
    y: cy + rotateLocal.x * sin + rotateLocal.y * cos,
  };
  const topMid = handlePos("n");

  return (
    <div
      ref={overlayRef}
      className="pointer-events-none absolute inset-0 z-20"
    >
      {/* Bounding box: a rotated rectangle that exactly hugs the shape. */}
      <div
        className="pointer-events-auto absolute cursor-move border border-dashed border-tool-active"
        style={{
          left: cx,
          top: cy,
          width: shape.w,
          height: shape.h,
          transform: `translate(-50%, -50%) rotate(${shape.rotation}rad)`,
          boxShadow: "0 0 0 1px hsl(var(--canvas))",
        }}
        onPointerDown={startDrag("move")}
      />

      {/* Rotation tether */}
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full"
        aria-hidden
      >
        <line
          x1={topMid.x}
          y1={topMid.y}
          x2={rotatePos.x}
          y2={rotatePos.y}
          stroke="hsl(var(--tool-active))"
          strokeWidth={1}
          strokeDasharray="3 3"
        />
      </svg>

      {/* Resize handles */}
      {(Object.keys(HANDLE_OFFSETS) as Array<keyof typeof HANDLE_OFFSETS>).map((id) => {
        const pos = handlePos(id);
        return (
          <div
            key={id}
            onPointerDown={startDrag(id)}
            className="pointer-events-auto absolute h-2.5 w-2.5 rounded-sm border border-tool-active bg-canvas shadow-soft"
            style={{
              left: pos.x,
              top: pos.y,
              transform: `translate(-50%, -50%) rotate(${shape.rotation}rad)`,
              cursor: cursorForHandle(id, shape.rotation),
            }}
          />
        );
      })}

      {/* Rotation handle */}
      <div
        onPointerDown={startDrag("rotate")}
        className="pointer-events-auto absolute h-3 w-3 cursor-grab rounded-full border border-tool-active bg-canvas shadow-soft"
        style={{
          left: rotatePos.x,
          top: rotatePos.y,
          transform: "translate(-50%, -50%)",
        }}
        title="Drag to rotate"
      />
    </div>
  );
}

function cursorForHandle(id: keyof typeof HANDLE_OFFSETS, rotation: number): string {
  // Rotate the cursor direction by the shape's rotation so the cursor
  // matches the perceived edge orientation.
  const baseAngles: Record<keyof typeof HANDLE_OFFSETS, number> = {
    n: -90, e: 0, s: 90, w: 180,
    ne: -45, se: 45, sw: 135, nw: -135,
  };
  const deg = (baseAngles[id] + (rotation * 180) / Math.PI + 360) % 360;
  // Pick the closest of 4 cursor variants.
  const variants = [
    { angle: 0, cursor: "ew-resize" },
    { angle: 45, cursor: "nwse-resize" },
    { angle: 90, cursor: "ns-resize" },
    { angle: 135, cursor: "nesw-resize" },
    { angle: 180, cursor: "ew-resize" },
    { angle: 225, cursor: "nwse-resize" },
    { angle: 270, cursor: "ns-resize" },
    { angle: 315, cursor: "nesw-resize" },
  ];
  let best = variants[0];
  let bestDiff = 360;
  for (const v of variants) {
    const d = Math.abs(((deg - v.angle + 540) % 360) - 180);
    if (d < bestDiff) {
      bestDiff = d;
      best = v;
    }
  }
  return best.cursor;
}

function applyDrag(
  drag: DragState,
  pointer: { x: number; y: number },
  shiftKey: boolean,
): DrawnShape {
  const { handle, startPointer, startShape } = drag;
  const dx = pointer.x - startPointer.x;
  const dy = pointer.y - startPointer.y;

  if (handle === "move") {
    return { ...startShape, x: startShape.x + dx, y: startShape.y + dy };
  }

  const cx = startShape.x + startShape.w / 2;
  const cy = startShape.y + startShape.h / 2;

  if (handle === "rotate") {
    const angle = Math.atan2(pointer.y - cy, pointer.x - cx);
    // Handle is positioned above the shape, so 0 rotation = -PI/2 from center.
    let rotation = angle + Math.PI / 2;
    if (shiftKey) {
      // Snap to 15° increments
      const step = Math.PI / 12;
      rotation = Math.round(rotation / step) * step;
    }
    return { ...startShape, rotation };
  }

  // Resize: convert pointer delta into the shape's local space (un-rotated),
  // adjust the corresponding edge(s), then re-anchor so the opposite edge
  // stays in place in screen space.
  const cos = Math.cos(startShape.rotation);
  const sin = Math.sin(startShape.rotation);
  const localDx = dx * cos + dy * sin;
  const localDy = -dx * sin + dy * cos;

  let newW = startShape.w;
  let newH = startShape.h;
  let anchorU = 0.5; // 0..1 — local-space anchor that should stay fixed
  let anchorV = 0.5;

  if (handle.includes("e")) { newW = startShape.w + localDx; anchorU = 0; }
  if (handle.includes("w")) { newW = startShape.w - localDx; anchorU = 1; }
  if (handle.includes("s")) { newH = startShape.h + localDy; anchorV = 0; }
  if (handle.includes("n")) { newH = startShape.h - localDy; anchorV = 1; }

  // Allow a minimum size; flip via negative not supported (keeps math simple).
  newW = Math.max(4, newW);
  newH = Math.max(4, newH);

  // The anchor (in start-shape local space) must keep its world position.
  const anchorLocalX = (anchorU - 0.5) * startShape.w;
  const anchorLocalY = (anchorV - 0.5) * startShape.h;
  const anchorWorld = {
    x: cx + anchorLocalX * cos - anchorLocalY * sin,
    y: cy + anchorLocalX * sin + anchorLocalY * cos,
  };

  // Solve for the new center such that the same anchor (in new local space)
  // maps to anchorWorld under the same rotation.
  const newAnchorLocalX = (anchorU - 0.5) * newW;
  const newAnchorLocalY = (anchorV - 0.5) * newH;
  const newCx = anchorWorld.x - (newAnchorLocalX * cos - newAnchorLocalY * sin);
  const newCy = anchorWorld.y - (newAnchorLocalX * sin + newAnchorLocalY * cos);

  return {
    ...startShape,
    w: newW,
    h: newH,
    x: newCx - newW / 2,
    y: newCy - newH / 2,
  };
}
