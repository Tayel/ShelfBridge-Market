/** A front-view shelf unit; each tier shows product blocks. Pure SVG. */
export function ShelfArt({ tiers = 3, hue = 12, fill = [], className = "" }: { tiers?: number; hue?: number; fill?: (string | null)[]; className?: string }) {
  const h = 30 + tiers * 44;
  const palette = [`hsl(${hue} 60% 62%)`, "#E9A23B", "#9DB79A", "#5E7FA6", `hsl(${hue} 40% 82%)`];
  return (
    <svg viewBox={`0 0 200 ${h}`} className={className} aria-hidden>
      <rect x="10" y="6" width="180" height={h - 12} rx="8" fill={`hsl(${hue} 40% 96%)`} />
      {Array.from({ length: tiers }).map((_, t) => {
        const y = 14 + t * 44;
        const c = fill[t];
        return (
          <g key={t}>
            {Array.from({ length: 6 }).map((_, k) => {
              const hh = 14 + ((k * 7 + t * 5) % 3) * 6;
              const col = c === undefined ? palette[(k + t) % palette.length] : c;
              if (col === null) return null;
              return <rect key={k} x={22 + k * 27} y={y + 34 - hh} width="20" height={hh} rx="4" fill={col} opacity={c === undefined ? 0.85 : 1} />;
            })}
            {c === null && <rect x="24" y={y + 14} width="152" height="20" rx="6" fill="none" stroke={`hsl(${hue} 30% 75%)`} strokeDasharray="5 5" />}
            <rect x="14" y={y + 34} width="172" height="6" rx="3" fill={`hsl(${hue} 35% 45%)`} />
          </g>
        );
      })}
    </svg>
  );
}
