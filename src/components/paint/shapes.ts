import {
  Square,
  Circle,
  Minus,
  Triangle,
  Slash,
  Hexagon,
  Octagon,
  Pentagon,
  Star,
  Heart,
  Cloud,
  ArrowRight,
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  ArrowUpRight,
  ArrowDownRight,
  ArrowDownLeft,
  ArrowUpLeft,
  MessageSquare,
  MessageCircle,
  Diamond,
  Zap,
  Plus,
  Shapes,
  Flag,
  Moon,
  Sun,
  PieChart,
  Equal,
  CornerUpRight,
} from "lucide-react";

export type ShapeKind =
  | "rectangle"
  | "rounded-rectangle"
  | "ellipse"
  | "circle"
  | "line"
  | "diagonal-line"
  | "triangle"
  | "right-triangle"
  | "diamond"
  | "parallelogram"
  | "trapezoid"
  | "pentagon"
  | "hexagon"
  | "octagon"
  | "star-4"
  | "star-5"
  | "star-6"
  | "arrow-right"
  | "arrow-left"
  | "arrow-up"
  | "arrow-down"
  | "arrow-ne"
  | "arrow-se"
  | "arrow-sw"
  | "arrow-nw"
  | "double-arrow-h"
  | "double-arrow-v"
  | "callout"
  | "thought-bubble"
  | "heart"
  | "lightning"
  | "cloud"
  | "moon"
  | "sun"
  | "cross"
  | "pie"
  | "chord"
  | "banner"
  | "chevron";

export interface ShapeMeta {
  id: ShapeKind;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const SHAPES: ShapeMeta[] = [
  { id: "line", label: "Line", icon: Minus },
  { id: "diagonal-line", label: "Diagonal line", icon: Slash },
  { id: "rectangle", label: "Rectangle", icon: Square },
  { id: "rounded-rectangle", label: "Rounded rectangle", icon: Square },
  { id: "ellipse", label: "Ellipse", icon: Circle },
  { id: "circle", label: "Circle", icon: Circle },
  { id: "triangle", label: "Triangle", icon: Triangle },
  { id: "right-triangle", label: "Right triangle", icon: Triangle },
  { id: "diamond", label: "Diamond", icon: Diamond },
  { id: "parallelogram", label: "Parallelogram", icon: Equal },
  { id: "trapezoid", label: "Trapezoid", icon: Shapes },
  { id: "pentagon", label: "Pentagon", icon: Pentagon },
  { id: "hexagon", label: "Hexagon", icon: Hexagon },
  { id: "octagon", label: "Octagon", icon: Octagon },
  { id: "star-4", label: "4-point star", icon: Star },
  { id: "star-5", label: "5-point star", icon: Star },
  { id: "star-6", label: "6-point star", icon: Star },
  { id: "arrow-right", label: "Right arrow", icon: ArrowRight },
  { id: "arrow-left", label: "Left arrow", icon: ArrowLeft },
  { id: "arrow-up", label: "Up arrow", icon: ArrowUp },
  { id: "arrow-down", label: "Down arrow", icon: ArrowDown },
  { id: "arrow-ne", label: "Up-right arrow", icon: ArrowUpRight },
  { id: "arrow-se", label: "Down-right arrow", icon: ArrowDownRight },
  { id: "arrow-sw", label: "Down-left arrow", icon: ArrowDownLeft },
  { id: "arrow-nw", label: "Up-left arrow", icon: ArrowUpLeft },
  { id: "double-arrow-h", label: "Double arrow (horizontal)", icon: ArrowRight },
  { id: "double-arrow-v", label: "Double arrow (vertical)", icon: ArrowUp },
  { id: "chevron", label: "Chevron", icon: CornerUpRight },
  { id: "callout", label: "Callout", icon: MessageSquare },
  { id: "thought-bubble", label: "Thought bubble", icon: MessageCircle },
  { id: "heart", label: "Heart", icon: Heart },
  { id: "lightning", label: "Lightning", icon: Zap },
  { id: "cloud", label: "Cloud", icon: Cloud },
  { id: "moon", label: "Moon", icon: Moon },
  { id: "sun", label: "Sun", icon: Sun },
  { id: "cross", label: "Cross", icon: Plus },
  { id: "pie", label: "Pie", icon: PieChart },
  { id: "chord", label: "Chord", icon: PieChart },
  { id: "banner", label: "Flag", icon: Flag },
];

export const SHAPE_LOOKUP: Record<ShapeKind, ShapeMeta> = SHAPES.reduce(
  (acc, s) => ({ ...acc, [s.id]: s }),
  {} as Record<ShapeKind, ShapeMeta>,
);

export interface DrawnShape {
  kind: ShapeKind;
  // Bounding box in CSS pixels, relative to the canvas
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number; // radians
  color: string;
  strokeWidth: number;
  fill?: string | null;
}

// Build the shape's path scaled into a w×h box at origin (0,0).
// The caller translates/rotates around the box center before calling.
// Because we scale point-by-point (not via ctx.scale), strokes stay uniform.
const buildPath = (kind: ShapeKind, w: number, h: number): Path2D | null => {
  const p = new Path2D();
  const sx = (u: number) => u * w;
  const sy = (v: number) => v * h;
  const move = (u: number, v: number) => p.moveTo(sx(u), sy(v));
  const line = (u: number, v: number) => p.lineTo(sx(u), sy(v));
  const quad = (cu: number, cv: number, u: number, v: number) =>
    p.quadraticCurveTo(sx(cu), sy(cv), sx(u), sy(v));
  const bez = (
    c1u: number, c1v: number, c2u: number, c2v: number, u: number, v: number,
  ) => p.bezierCurveTo(sx(c1u), sy(c1v), sx(c2u), sy(c2v), sx(u), sy(v));

  switch (kind) {
    case "rectangle":
      p.rect(0, 0, w, h);
      return p;
    case "rounded-rectangle": {
      const r = Math.min(w, h) * 0.15;
      p.moveTo(r, 0);
      p.lineTo(w - r, 0);
      p.quadraticCurveTo(w, 0, w, r);
      p.lineTo(w, h - r);
      p.quadraticCurveTo(w, h, w - r, h);
      p.lineTo(r, h);
      p.quadraticCurveTo(0, h, 0, h - r);
      p.lineTo(0, r);
      p.quadraticCurveTo(0, 0, r, 0);
      p.closePath();
      return p;
    }
    case "ellipse":
      p.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
      return p;
    case "circle": {
      const r = Math.min(w, h) / 2;
      p.arc(w / 2, h / 2, r, 0, Math.PI * 2);
      return p;
    }
    case "triangle":
      move(0.5, 0); line(1, 1); line(0, 1); p.closePath(); return p;
    case "right-triangle":
      move(0, 0); line(0, 1); line(1, 1); p.closePath(); return p;
    case "diamond":
      move(0.5, 0); line(1, 0.5); line(0.5, 1); line(0, 0.5); p.closePath(); return p;
    case "pentagon":
      return regularPolygon(5, -Math.PI / 2, w, h);
    case "hexagon":
      return regularPolygon(6, 0, w, h);
    case "octagon":
      return regularPolygon(8, Math.PI / 8, w, h);
    case "star-4":
      return star(4, -Math.PI / 2, 0.4, w, h);
    case "star-5":
      return star(5, -Math.PI / 2, 0.4, w, h);
    case "star-6":
      return star(6, -Math.PI / 2, 0.45, w, h);
    case "arrow-right":
      return arrow("right", w, h);
    case "arrow-left":
      return arrow("left", w, h);
    case "arrow-up":
      return arrow("up", w, h);
    case "arrow-down":
      return arrow("down", w, h);
    case "arrow-ne":
    case "arrow-se":
    case "arrow-sw":
    case "arrow-nw":
      return diagonalArrow(kind, w, h);
    case "double-arrow-h":
      return doubleArrow("horizontal", w, h);
    case "double-arrow-v":
      return doubleArrow("vertical", w, h);
    case "callout": {
      const r = Math.min(w, h) * 0.12;
      const bottom = h * 0.78;
      p.moveTo(r, 0);
      p.lineTo(w - r, 0);
      p.quadraticCurveTo(w, 0, w, r);
      p.lineTo(w, bottom - r);
      p.quadraticCurveTo(w, bottom, w - r, bottom);
      p.lineTo(w * 0.4, bottom);
      p.lineTo(w * 0.2, h);
      p.lineTo(w * 0.3, bottom);
      p.lineTo(r, bottom);
      p.quadraticCurveTo(0, bottom, 0, bottom - r);
      p.lineTo(0, r);
      p.quadraticCurveTo(0, 0, r, 0);
      p.closePath();
      return p;
    }
    case "heart":
      move(0.5, 1);
      bez(-0.1, 0.6, 0.1, -0.05, 0.5, 0.3);
      bez(0.9, -0.05, 1.1, 0.6, 0.5, 1);
      p.closePath();
      return p;
    case "lightning":
      move(0.55, 0); line(0.1, 0.55); line(0.45, 0.55); line(0.3, 1);
      line(0.85, 0.4); line(0.5, 0.4); line(0.7, 0); p.closePath(); return p;
    case "cloud":
      move(0.15, 0.85);
      bez(-0.1, 0.85, -0.05, 0.45, 0.2, 0.45);
      bez(0.18, 0.15, 0.55, 0.1, 0.6, 0.35);
      bez(0.7, 0.1, 1.05, 0.25, 0.9, 0.5);
      bez(1.15, 0.55, 1.05, 0.9, 0.85, 0.85);
      p.closePath();
      return p;
    case "parallelogram": {
      const skew = 0.25;
      move(skew, 0); line(1, 0); line(1 - skew, 1); line(0, 1); p.closePath(); return p;
    }
    case "trapezoid": {
      const inset = 0.2;
      move(inset, 0); line(1 - inset, 0); line(1, 1); line(0, 1); p.closePath(); return p;
    }
    case "chevron":
      move(0, 0); line(0.6, 0); line(1, 0.5); line(0.6, 1); line(0, 1); line(0.4, 0.5);
      p.closePath(); return p;
    case "thought-bubble":
      p.ellipse(w * 0.5, h * 0.42, w * 0.45, h * 0.32, 0, 0, Math.PI * 2);
      p.moveTo(w * 0.3, h * 0.82);
      p.ellipse(w * 0.22, h * 0.82, w * 0.08, h * 0.06, 0, 0, Math.PI * 2);
      p.moveTo(w * 0.16, h * 0.96);
      p.ellipse(w * 0.12, h * 0.96, w * 0.045, h * 0.035, 0, 0, Math.PI * 2);
      return p;
    case "moon": {
      // Crescent built from an outer half-circle + an inner offset arc that carves it
      const R = Math.min(w, h) * 0.48;
      const cx = w * 0.5;
      const cy = h * 0.5;
      const offset = R * 0.55;
      const r = Math.sqrt(offset * offset + R * R);
      const a = Math.atan2(R, -offset);
      // Outer left half (counter-clockwise from top to bottom through the left)
      p.arc(cx - offset * 0.15, cy, R, -Math.PI / 2, Math.PI / 2, true);
      // Inner arc carves the right side, sweeping clockwise through the left of the inner circle
      p.arc(cx + offset * 0.85, cy, r, a, 2 * Math.PI - a, false);
      p.closePath();
      return p;
    }
    case "sun": {
      const cx = w / 2, cy = h / 2;
      const radius = Math.min(w, h) / 2;
      const rIn = radius * 0.44;
      const rOut = radius;
      const rays = 12;
      for (let i = 0; i < rays; i++) {
        const a1 = (i / rays) * Math.PI * 2;
        const a2 = ((i + 0.5) / rays) * Math.PI * 2;
        const a3 = ((i + 1) / rays) * Math.PI * 2;
        const x1 = cx + Math.cos(a1) * rIn;
        const y1 = cy + Math.sin(a1) * rIn;
        const x2 = cx + Math.cos(a2) * rOut;
        const y2 = cy + Math.sin(a2) * rOut;
        const x3 = cx + Math.cos(a3) * rIn;
        const y3 = cy + Math.sin(a3) * rIn;
        if (i === 0) p.moveTo(x1, y1);
        else p.lineTo(x1, y1);
        p.lineTo(x2, y2);
        p.lineTo(x3, y3);
      }
      p.closePath();
      p.moveTo(cx + rIn * 0.6, cy);
      p.arc(cx, cy, rIn * 0.6, 0, Math.PI * 2);
      return p;
    }
    case "cross": {
      const t = 0.32;
      const a = (1 - t) / 2;
      const b = a + t;
      move(a, 0); line(b, 0); line(b, a); line(1, a); line(1, b); line(b, b);
      line(b, 1); line(a, 1); line(a, b); line(0, b); line(0, a); line(a, a);
      p.closePath();
      return p;
    }
    case "pie": {
      const cx = w / 2, cy = h / 2;
      const r = Math.min(w, h) / 2;
      p.moveTo(cx, cy);
      p.lineTo(cx + r, cy);
      p.arc(cx, cy, r, 0, Math.PI * 1.5, false);
      p.closePath();
      return p;
    }
    case "chord": {
      const cx = w / 2, cy = h / 2;
      const r = Math.min(w, h) / 2;
      p.moveTo(cx + r, cy);
      p.arc(cx, cy, r, 0, Math.PI * 1.25, false);
      p.closePath();
      return p;
    }
    case "banner": {
      // Flag on a pole, filling the full bounding box
      const poleW = w * 0.08;
      // Pole spanning full height
      p.moveTo(0, 0);
      p.lineTo(poleW, 0);
      p.lineTo(poleW, h);
      p.lineTo(0, h);
      p.closePath();
      // Waving flag attached to top portion of the pole
      p.moveTo(poleW, 0);
      p.lineTo(w, 0);
      p.bezierCurveTo(w * 0.82, h * 0.18, w, h * 0.36, w * 0.85, h * 0.55);
      p.lineTo(poleW, h * 0.55);
      p.closePath();
      return p;
    }
    case "line":
    case "diagonal-line":
      return null;
  }
};

function regularPolygon(sides: number, rotation: number, w: number, h: number): Path2D {
  const p = new Path2D();
  const cx = w / 2, cy = h / 2;
  const rx = w / 2, ry = h / 2;
  for (let i = 0; i < sides; i++) {
    const a = rotation + (i * Math.PI * 2) / sides;
    const x = cx + Math.cos(a) * rx;
    const y = cy + Math.sin(a) * ry;
    if (i === 0) p.moveTo(x, y);
    else p.lineTo(x, y);
  }
  p.closePath();
  return p;
}

function star(points: number, rotation: number, innerRatio: number, w: number, h: number): Path2D {
  const p = new Path2D();
  const cx = w / 2, cy = h / 2;
  const rx = w / 2, ry = h / 2;
  const total = points * 2;
  for (let i = 0; i < total; i++) {
    const a = rotation + (i * Math.PI) / points;
    const r = i % 2 === 0 ? 1 : innerRatio;
    const x = cx + Math.cos(a) * rx * r;
    const y = cy + Math.sin(a) * ry * r;
    if (i === 0) p.moveTo(x, y);
    else p.lineTo(x, y);
  }
  p.closePath();
  return p;
}

function arrow(direction: "right" | "left" | "up" | "down", w: number, h: number): Path2D {
  const p = new Path2D();
  const pts: [number, number][] = [
    [0, 0.3], [0.6, 0.3], [0.6, 0.05], [1, 0.5],
    [0.6, 0.95], [0.6, 0.7], [0, 0.7],
  ];
  const transform = (x: number, y: number): [number, number] => {
    switch (direction) {
      case "right": return [x, y];
      case "left": return [1 - x, y];
      case "down": return [y, x];
      case "up": return [y, 1 - x];
    }
  };
  pts.forEach(([x, y], i) => {
    const [tx, ty] = transform(x, y);
    if (i === 0) p.moveTo(tx * w, ty * h);
    else p.lineTo(tx * w, ty * h);
  });
  p.closePath();
  return p;
}

function diagonalArrow(kind: "arrow-ne" | "arrow-se" | "arrow-sw" | "arrow-nw", w: number, h: number): Path2D {
  const p = new Path2D();
  const pts: [number, number][] = [
    [0, 0.7], [0.5, 0.2], [0.35, 0.05], [0.95, 0.05],
    [0.95, 0.65], [0.8, 0.5], [0.3, 1],
  ];
  const transform = (x: number, y: number): [number, number] => {
    switch (kind) {
      case "arrow-ne": return [x, y];
      case "arrow-nw": return [1 - x, y];
      case "arrow-se": return [x, 1 - y];
      case "arrow-sw": return [1 - x, 1 - y];
    }
  };
  pts.forEach(([x, y], i) => {
    const [tx, ty] = transform(x, y);
    if (i === 0) p.moveTo(tx * w, ty * h);
    else p.lineTo(tx * w, ty * h);
  });
  p.closePath();
  return p;
}

function doubleArrow(orientation: "horizontal" | "vertical", w: number, h: number): Path2D {
  const p = new Path2D();
  const pts: [number, number][] = [
    [0, 0.5], [0.15, 0.2], [0.15, 0.38], [0.85, 0.38],
    [0.85, 0.2], [1, 0.5], [0.85, 0.8], [0.85, 0.62],
    [0.15, 0.62], [0.15, 0.8],
  ];
  const transform = (x: number, y: number): [number, number] =>
    orientation === "horizontal" ? [x, y] : [y, x];
  pts.forEach(([x, y], i) => {
    const [tx, ty] = transform(x, y);
    if (i === 0) p.moveTo(tx * w, ty * h);
    else p.lineTo(tx * w, ty * h);
  });
  p.closePath();
  return p;
}

// Render a shape onto a 2D context. Stroke width is applied in screen pixels
// (no ctx.scale of strokes), so all edges have uniform thickness.
export function renderShape(
  ctx: CanvasRenderingContext2D,
  shape: DrawnShape,
  start?: { x: number; y: number },
  end?: { x: number; y: number },
) {
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.strokeStyle = shape.color;
  ctx.lineWidth = Math.max(1, shape.strokeWidth);
  ctx.lineCap = "round";
  // Sharp corners for polygonal shapes; round for the rounded-rectangle which
  // already encodes its curves directly in the path.
  ctx.lineJoin = shape.kind === "rounded-rectangle" ? "round" : "miter";
  ctx.miterLimit = 10;

  if (shape.kind === "line" || shape.kind === "diagonal-line") {
    let a = start;
    let b = end;
    if (!a || !b) {
      const cx = shape.x + shape.w / 2;
      const cy = shape.y + shape.h / 2;
      const cos = Math.cos(shape.rotation);
      const sin = Math.sin(shape.rotation);
      const halfW = shape.w / 2;
      const halfH = shape.h / 2;
      const localA = { x: -halfW, y: -halfH };
      const localB = { x: halfW, y: halfH };
      a = {
        x: cx + localA.x * cos - localA.y * sin,
        y: cy + localA.x * sin + localA.y * cos,
      };
      b = {
        x: cx + localB.x * cos - localB.y * sin,
        y: cy + localB.x * sin + localB.y * cos,
      };
    }
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.restore();
    return;
  }

  const path = buildPath(shape.kind, shape.w, shape.h);
  if (!path) {
    ctx.restore();
    return;
  }

  const cx = shape.x + shape.w / 2;
  const cy = shape.y + shape.h / 2;
  ctx.translate(cx, cy);
  ctx.rotate(shape.rotation);
  ctx.translate(-shape.w / 2, -shape.h / 2);

  if (shape.fill) {
    ctx.fillStyle = shape.fill;
    ctx.fill(path);
  }
  ctx.stroke(path);
  ctx.restore();
}
