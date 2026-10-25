interface Props {
  width: number; depth: number;
  bricks: number[]; // selected (shelf) bricks
  onToggle?: (i: number) => void;
  highlight?: number | null; // brick index highlighted
  busy?: Set<number>; // bricks fully rented
  onPick?: (i: number) => void;
  hue?: number;
}

/** Isometric shop floor. Each brick is a button; raised bricks are shelf spots. */
export function IsoFloor({ width, depth, bricks, onToggle, highlight, busy, onPick, hue = 12 }: Props) {
  const size = Math.min(56, Math.floor(300 / Math.max(width, depth)));
  const sel = new Set(bricks);
  return (
    <div className="iso-stage flex items-center justify-center py-10" style={{ minHeight: size * Math.max(width, depth) * 0.9 + 80 }}>
      <div className="iso-plane grid gap-1.5 rounded-2xl bg-muted p-3 shadow-[20px_20px_40px_-20px_rgba(60,40,20,.25)]"
        style={{ gridTemplateColumns: `repeat(${width}, ${size}px)` }}>
        {Array.from({ length: width * depth }).map((_, i) => {
          const on = sel.has(i);
          const full = busy?.has(i);
          const hl = highlight === i;
          const interactive = onToggle || (onPick && on && !full);
          return (
            <button key={i} type="button" data-testid={`brick-${i}`}
              aria-label={on ? `Shelf spot ${i + 1}${full ? ", rented" : ""}` : `Floor ${i + 1}`}
              aria-pressed={onToggle ? on : hl}
              disabled={!interactive}
              onClick={() => (onToggle ? onToggle(i) : onPick?.(i))}
              className={`brick ${on ? "raised" : ""} rounded-md disabled:cursor-default`}
              style={{
                width: size, height: size,
                background: on
                  ? full ? "hsl(30 10% 78%)" : hl ? `hsl(${hue} 72% 52%)` : `hsl(${hue} 55% 72%)`
                  : "hsl(0 0% 100%)",
                boxShadow: on
                  ? `-6px 6px 0 ${full ? "hsl(30 8% 62%)" : `hsl(${hue} 45% ${hl ? 38 : 55}%)`}`
                  : "inset 0 0 0 1px hsl(30 14% 88%)",
              }} />
          );
        })}
      </div>
    </div>
  );
}
