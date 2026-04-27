import { useEffect, useMemo, useRef, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Palette } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  color: string;
  onChange: (hex: string) => void;
  customSlots: string[];
  onSaveSlot: (index: number, hex: string) => void;
}

function hexToHsv(hex: string): { h: number; s: number; v: number } {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
  }
  h = (h * 60 + 360) % 360;
  const s = max === 0 ? 0 : d / max;
  return { h, s, v: max };
}

function hsvToHex(h: number, s: number, v: number): string {
  const c = v * s;
  const hh = h / 60;
  const x = c * (1 - Math.abs((hh % 2) - 1));
  let r = 0, g = 0, b = 0;
  if (hh >= 0 && hh < 1) [r, g, b] = [c, x, 0];
  else if (hh < 2) [r, g, b] = [x, c, 0];
  else if (hh < 3) [r, g, b] = [0, c, x];
  else if (hh < 4) [r, g, b] = [0, x, c];
  else if (hh < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const m = v - c;
  const to = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

export function ColorPickerPopover({ color, onChange, customSlots, onSaveSlot }: Props) {
  const [open, setOpen] = useState(false);
  const hsv = useMemo(() => hexToHsv(color), [color]);
  const [h, setH] = useState(hsv.h);
  const [s, setS] = useState(hsv.s);
  const [v, setV] = useState(hsv.v);
  const [hex, setHex] = useState(color);

  useEffect(() => {
    if (!open) {
      const cur = hexToHsv(color);
      setH(cur.h);
      setS(cur.s);
      setV(cur.v);
      setHex(color);
    }
  }, [color, open]);

  const apply = (nh: number, ns: number, nv: number) => {
    const c = hsvToHex(nh, ns, nv);
    setH(nh); setS(ns); setV(nv); setHex(c);
    onChange(c);
  };

  const svRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef<"sv" | "hue" | null>(null);

  const handleSv = (e: React.PointerEvent | PointerEvent) => {
    const el = svRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const ns = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    const nv = Math.max(0, Math.min(1, 1 - (e.clientY - r.top) / r.height));
    apply(h, ns, nv);
  };

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (draggingRef.current === "sv") handleSv(e);
    };
    const onUp = () => (draggingRef.current = null);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [h]);

  const baseHueColor = hsvToHex(h, 1, 1);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-tool-hover"
          aria-label="Open color picker"
        >
          <Palette className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" align="start" className="w-[260px] p-3">
        <div
          ref={svRef}
          onPointerDown={(e) => {
            draggingRef.current = "sv";
            (e.target as Element).setPointerCapture(e.pointerId);
            handleSv(e);
          }}
          className="relative h-36 w-full cursor-crosshair rounded-md"
          style={{
            background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${baseHueColor})`,
          }}
        >
          <div
            className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
            style={{
              left: `${s * 100}%`,
              top: `${(1 - v) * 100}%`,
              backgroundColor: hex,
            }}
          />
        </div>

        {/* Hue slider */}
        <div className="mt-3">
          <input
            type="range"
            min={0}
            max={360}
            value={Math.round(h)}
            onChange={(e) => apply(parseInt(e.target.value, 10), s, v)}
            className="h-3 w-full appearance-none rounded-full"
            style={{
              background:
                "linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)",
            }}
          />
        </div>

        {/* Hex input */}
        <div className="mt-3 flex items-center gap-2">
          <div
            className="h-7 w-7 shrink-0 rounded-md border border-border"
            style={{ backgroundColor: hex }}
          />
          <Input
            value={hex}
            onChange={(e) => {
              const v = e.target.value;
              setHex(v);
              if (/^#[0-9a-fA-F]{6}$/.test(v)) {
                const c = hexToHsv(v);
                setH(c.h); setS(c.s); setV(c.v);
                onChange(v);
              }
            }}
            className="h-8 font-mono text-xs"
          />
        </div>

        {/* Custom slots */}
        <div className="mt-3 border-t border-border pt-2">
          <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Custom slots — click to use, long-click to save current
          </div>
          <div className="grid grid-cols-5 gap-1.5">
            {customSlots.map((slot, i) => (
              <SlotButton
                key={i}
                slot={slot}
                current={hex}
                onUse={() => slot && onChange(slot)}
                onSave={() => onSaveSlot(i, hex)}
              />
            ))}
          </div>
          <Button
            size="sm"
            variant="secondary"
            className="mt-2 w-full text-xs"
            onClick={() => {
              const idx = customSlots.findIndex((c) => !c);
              onSaveSlot(idx === -1 ? 0 : idx, hex);
            }}
          >
            Save current to next slot
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function SlotButton({
  slot, current, onUse, onSave,
}: { slot: string; current: string; onUse: () => void; onSave: () => void }) {
  const timer = useRef<number | null>(null);
  return (
    <button
      onPointerDown={() => {
        timer.current = window.setTimeout(() => {
          onSave();
          timer.current = null;
        }, 450);
      }}
      onPointerUp={() => {
        if (timer.current != null) {
          window.clearTimeout(timer.current);
          timer.current = null;
          onUse();
        }
      }}
      onPointerLeave={() => {
        if (timer.current != null) {
          window.clearTimeout(timer.current);
          timer.current = null;
        }
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        onSave();
      }}
      className={cn(
        "h-7 w-full rounded-md border transition-transform hover:scale-105",
        slot ? "border-border" : "border-dashed border-border bg-muted/30",
      )}
      style={{ backgroundColor: slot || undefined }}
      title={slot ? `${slot} (long-press to overwrite)` : "Empty slot — long-press to save current color"}
      aria-label={slot ? `Use ${slot}` : "Empty slot"}
    >
      {!slot && <span className="text-[10px] text-muted-foreground">+</span>}
    </button>
  );
}
