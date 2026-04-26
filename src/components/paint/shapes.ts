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
  { id: "banner", label: "Banner", icon: Flag },
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

// Build the shape's path inside a unit box [0,1] x [0,1].
// The caller scales/rotates as needed. Returns null when nothing should be drawn.
const unitPath = (kind: ShapeKind): Path2D | null => {
  const p = new Path2D();

  switch (kind) {
    case "rectangle":
      p.rect(0, 0, 1, 1);
      return p;
    case "rounded-rectangle": {
      const r = 0.15;
      p.moveTo(r, 0);
      p.lineTo(1 - r, 0);
      p.quadraticCurveTo(1, 0, 1, r);
      p.lineTo(1, 1 - r);
      p.quadraticCurveTo(1, 1, 1 - r, 1);
      p.lineTo(r, 1);
      p.quadraticCurveTo(0, 1, 0, 1 - r);
      p.lineTo(0, r);
      p.quadraticCurveTo(0, 0, r, 0);
      p.closePath();
      return p;
    }
    case "ellipse":
      p.ellipse(0.5, 0.5, 0.5, 0.5, 0, 0, Math.PI * 2);
      return p;
    case "triangle":
      p.moveTo(0.5, 0);
      p.lineTo(1, 1);
      p.lineTo(0, 1);
      p.closePath();
      return p;
    case "right-triangle":
      p.moveTo(0, 0);
      p.lineTo(0, 1);
      p.lineTo(1, 1);
      p.closePath();
      return p;
    case "diamond":
      p.moveTo(0.5, 0);
      p.lineTo(1, 0.5);
      p.lineTo(0.5, 1);
      p.lineTo(0, 0.5);
      p.closePath();
      return p;
    case "pentagon":
      return regularPolygon(5, -Math.PI / 2);
    case "hexagon":
      return regularPolygon(6, 0);
    case "octagon":
      return regularPolygon(8, Math.PI / 8);
    case "star-4":
      return star(4, -Math.PI / 2, 0.4);
    case "star-5":
      return star(5, -Math.PI / 2, 0.4);
    case "star-6":
      return star(6, -Math.PI / 2, 0.45);
    case "arrow-right":
      return arrow("right");
    case "arrow-left":
      return arrow("left");
    case "arrow-up":
      return arrow("up");
    case "arrow-down":
      return arrow("down");
    case "callout": {
      const r = 0.12;
      // Rounded rectangle (top portion) with a tail in the bottom-left corner.
      const bottom = 0.78;
      p.moveTo(r, 0);
      p.lineTo(1 - r, 0);
      p.quadraticCurveTo(1, 0, 1, r);
      p.lineTo(1, bottom - r);
      p.quadraticCurveTo(1, bottom, 1 - r, bottom);
      p.lineTo(0.4, bottom);
      p.lineTo(0.2, 1);
      p.lineTo(0.3, bottom);
      p.lineTo(r, bottom);
      p.quadraticCurveTo(0, bottom, 0, bottom - r);
      p.lineTo(0, r);
      p.quadraticCurveTo(0, 0, r, 0);
      p.closePath();
      return p;
    }
    case "heart": {
      // Two arcs forming the lobes, then converge at the bottom point.
      p.moveTo(0.5, 1);
      p.bezierCurveTo(-0.1, 0.6, 0.1, -0.05, 0.5, 0.3);
      p.bezierCurveTo(0.9, -0.05, 1.1, 0.6, 0.5, 1);
      p.closePath();
      return p;
    }
    case "lightning": {
      p.moveTo(0.55, 0);
      p.lineTo(0.1, 0.55);
      p.lineTo(0.45, 0.55);
      p.lineTo(0.3, 1);
      p.lineTo(0.85, 0.4);
      p.lineTo(0.5, 0.4);
      p.lineTo(0.7, 0);
      p.closePath();
      return p;
    }
    case "cloud": {
      // Series of arcs along the top, flat-ish bottom.
      p.moveTo(0.15, 0.85);
      p.bezierCurveTo(-0.1, 0.85, -0.05, 0.45, 0.2, 0.45);
      p.bezierCurveTo(0.18, 0.15, 0.55, 0.1, 0.6, 0.35);
      p.bezierCurveTo(0.7, 0.1, 1.05, 0.25, 0.9, 0.5);
      p.bezierCurveTo(1.15, 0.55, 1.05, 0.9, 0.85, 0.85);
      p.closePath();
      return p;
    }
    case "parallelogram": {
      const skew = 0.25;
      p.moveTo(skew, 0);
      p.lineTo(1, 0);
      p.lineTo(1 - skew, 1);
      p.lineTo(0, 1);
      p.closePath();
      return p;
    }
    case "trapezoid": {
      const inset = 0.2;
      p.moveTo(inset, 0);
      p.lineTo(1 - inset, 0);
      p.lineTo(1, 1);
      p.lineTo(0, 1);
      p.closePath();
      return p;
    }
    case "arrow-ne":
    case "arrow-se":
    case "arrow-sw":
    case "arrow-nw":
      return diagonalArrow(kind);
    case "double-arrow-h":
      return doubleArrow("horizontal");
    case "double-arrow-v":
      return doubleArrow("vertical");
    case "chevron": {
      // Right-pointing chevron / block arrow segment.
      p.moveTo(0, 0);
      p.lineTo(0.6, 0);
      p.lineTo(1, 0.5);
      p.lineTo(0.6, 1);
      p.lineTo(0, 1);
      p.lineTo(0.4, 0.5);
      p.closePath();
      return p;
    }
    case "thought-bubble": {
      // Main rounded body
      p.ellipse(0.5, 0.42, 0.45, 0.32, 0, 0, Math.PI * 2);
      // Two small bubbles in the bottom-left tail
      p.moveTo(0.28, 0.85);
      p.ellipse(0.22, 0.82, 0.08, 0.06, 0, 0, Math.PI * 2);
      p.moveTo(0.16, 0.98);
      p.ellipse(0.12, 0.96, 0.045, 0.035, 0, 0, Math.PI * 2);
      return p;
    }
    case "moon": {
      // Crescent: outer arc minus inner arc
      p.arc(0.4, 0.5, 0.45, Math.PI * 0.5, Math.PI * 1.5, false);
      p.arc(0.55, 0.5, 0.4, Math.PI * 1.5, Math.PI * 0.5, true);
      p.closePath();
      return p;
    }
    case "sun": {
      // Center disk + 8 triangular rays
      const cx = 0.5, cy = 0.5;
      const rIn = 0.22;
      const rOut = 0.5;
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
      // Inner disk
      p.moveTo(cx + rIn * 0.6, cy);
      p.arc(cx, cy, rIn * 0.6, 0, Math.PI * 2);
      return p;
    }
    case "cross": {
      // Plus / Greek cross
      const t = 0.32; // arm thickness ratio
      const a = (1 - t) / 2;
      const b = a + t;
      p.moveTo(a, 0);
      p.lineTo(b, 0);
      p.lineTo(b, a);
      p.lineTo(1, a);
      p.lineTo(1, b);
      p.lineTo(b, b);
      p.lineTo(b, 1);
      p.lineTo(a, 1);
      p.lineTo(a, b);
      p.lineTo(0, b);
      p.lineTo(0, a);
      p.lineTo(a, a);
      p.closePath();
      return p;
    }
    case "pie": {
      // 3/4 pie wedge
      p.moveTo(0.5, 0.5);
      p.lineTo(1, 0.5);
      p.arc(0.5, 0.5, 0.5, 0, Math.PI * 1.5, false);
      p.closePath();
      return p;
    }
    case "chord": {
      // Circular arc closed with a straight chord
      p.moveTo(1, 0.5);
      p.arc(0.5, 0.5, 0.5, 0, Math.PI * 1.25, false);
      p.closePath();
      return p;
    }
    case "banner": {
      // Ribbon banner with notched ends
      const top = 0.25;
      const bot = 0.75;
      const notch = 0.08;
      p.moveTo(0, top);
      p.lineTo(0.15, top);
      p.lineTo(0.15, top - 0.1);
      p.lineTo(0.85, top - 0.1);
      p.lineTo(0.85, top);
      p.lineTo(1, top);
      p.lineTo(1 - notch, 0.5);
      p.lineTo(1, bot);
      p.lineTo(0.85, bot);
      p.lineTo(0.85, bot + 0.1);
      p.lineTo(0.15, bot + 0.1);
      p.lineTo(0.15, bot);
      p.lineTo(0, bot);
      p.lineTo(notch, 0.5);
      p.closePath();
      return p;
    }
    case "line":
    case "diagonal-line":
      // Lines are handled separately because they don't fit the unit-box model.
      return null;
  }
};

function regularPolygon(sides: number, rotation: number): Path2D {
  const p = new Path2D();
  for (let i = 0; i < sides; i++) {
    const a = rotation + (i * Math.PI * 2) / sides;
    const x = 0.5 + Math.cos(a) * 0.5;
    const y = 0.5 + Math.sin(a) * 0.5;
    if (i === 0) p.moveTo(x, y);
    else p.lineTo(x, y);
  }
  p.closePath();
  return p;
}

function star(points: number, rotation: number, innerRatio: number): Path2D {
  const p = new Path2D();
  const total = points * 2;
  for (let i = 0; i < total; i++) {
    const a = rotation + (i * Math.PI) / points;
    const r = i % 2 === 0 ? 0.5 : 0.5 * innerRatio;
    const x = 0.5 + Math.cos(a) * r;
    const y = 0.5 + Math.sin(a) * r;
    if (i === 0) p.moveTo(x, y);
    else p.lineTo(x, y);
  }
  p.closePath();
  return p;
}

function arrow(direction: "right" | "left" | "up" | "down"): Path2D {
  // Default: right-pointing arrow inside unit box.
  // Body height = 0.5 (centered), head extends from x=0.6 to x=1.
  const p = new Path2D();
  const pts: [number, number][] = [
    [0, 0.3],
    [0.6, 0.3],
    [0.6, 0.05],
    [1, 0.5],
    [0.6, 0.95],
    [0.6, 0.7],
    [0, 0.7],
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
    if (i === 0) p.moveTo(tx, ty);
    else p.lineTo(tx, ty);
  });
  p.closePath();
  return p;
}

function diagonalArrow(kind: "arrow-ne" | "arrow-se" | "arrow-sw" | "arrow-nw"): Path2D {
  // Build a NE arrow inside the unit box, then mirror as needed.
  // Shaft from bottom-left to roughly (0.7, 0.3); arrowhead at top-right.
  const p = new Path2D();
  // NE base polygon points
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
    if (i === 0) p.moveTo(tx, ty);
    else p.lineTo(tx, ty);
  });
  p.closePath();
  return p;
}

function doubleArrow(orientation: "horizontal" | "vertical"): Path2D {
  // Horizontal: arrowheads on both left and right.
  const p = new Path2D();
  const pts: [number, number][] = [
    [0, 0.5],
    [0.15, 0.2],
    [0.15, 0.38],
    [0.85, 0.38],
    [0.85, 0.2],
    [1, 0.5],
    [0.85, 0.8],
    [0.85, 0.62],
    [0.15, 0.62],
    [0.15, 0.8],
  ];
  const transform = (x: number, y: number): [number, number] =>
    orientation === "horizontal" ? [x, y] : [y, x];
  pts.forEach(([x, y], i) => {
    const [tx, ty] = transform(x, y);
    if (i === 0) p.moveTo(tx, ty);
    else p.lineTo(tx, ty);
  });
  p.closePath();
  return p;
}

// Render a shape onto a 2D context at its bbox/rotation.
// startPoint and endPoint are only used for line shapes (which don't fit the
// bounding-box model nicely when rotated).
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
  ctx.lineJoin = "round";

  if (shape.kind === "line" || shape.kind === "diagonal-line") {
    // Use start/end if provided, otherwise derive from bbox + rotation.
    let a = start;
    let b = end;
    if (!a || !b) {
      const cx = shape.x + shape.w / 2;
      const cy = shape.y + shape.h / 2;
      const cos = Math.cos(shape.rotation);
      const sin = Math.sin(shape.rotation);
      const halfW = shape.w / 2;
      const halfH = shape.h / 2;
      // Use the bbox's diagonal as the line direction.
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

  const path = unitPath(shape.kind);
  if (!path) {
    ctx.restore();
    return;
  }

  const cx = shape.x + shape.w / 2;
  const cy = shape.y + shape.h / 2;
  ctx.translate(cx, cy);
  ctx.rotate(shape.rotation);
  ctx.translate(-shape.w / 2, -shape.h / 2);
  ctx.scale(shape.w, shape.h);

  // Strokes get scaled by the transform; counter-scale the line width so it
  // stays visually consistent regardless of the shape's size.
  ctx.lineWidth = Math.max(1, shape.strokeWidth) / Math.max(0.0001, Math.min(shape.w, shape.h));

  if (shape.fill) {
    ctx.fillStyle = shape.fill;
    ctx.fill(path);
  }
  ctx.stroke(path);
  ctx.restore();
}
