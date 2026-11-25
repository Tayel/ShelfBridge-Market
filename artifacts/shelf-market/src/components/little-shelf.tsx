import { motion } from "framer-motion";

/** A small wooden shelf with a few makers' goods: the InRaf idea in one picture. Decorative. */
export function LittleShelf({ className = "" }: { className?: string }) {
  const items = [
    { x: 22, w: 18, h: 30, c: "#DD502C", r: 3, lid: "#8a3a22" }, // jam jar
    { x: 46, w: 14, h: 40, c: "#5E8C61", r: 2, lid: "#3d5e40" }, // olive oil bottle
    { x: 66, w: 22, h: 24, c: "#E8B04B", r: 4, lid: "#a8782a" }, // honey
    { x: 94, w: 26, h: 34, c: "#C98B6B", r: 2 },                // soap box
    { x: 126, w: 16, h: 28, c: "#7A6FB0", r: 3, lid: "#4f477a" }, // spice
    { x: 148, w: 20, h: 36, c: "#2F6F7E", r: 3, lid: "#1e4a54" }, // tea tin
  ];
  return (
    <svg viewBox="0 0 190 72" role="img" aria-label="A small shelf stocked by local makers" className={className}>
      {items.map((it, i) => (
        <motion.g key={i} initial={{ y: -14, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.25 + i * 0.08, type: "spring", stiffness: 300, damping: 18 }}>
          <rect x={it.x} y={58 - it.h} width={it.w} height={it.h} rx={it.r} fill={it.c} />
          {it.lid && <rect x={it.x + 2} y={58 - it.h - 4} width={it.w - 4} height={5} rx={1.5} fill={it.lid} />}
          <rect x={it.x + 3} y={58 - it.h * 0.62} width={it.w - 6} height={it.h * 0.28} rx={1.5} fill="#FBFAF8" opacity={0.85} />
        </motion.g>
      ))}
      <rect x={6} y={58} width={178} height={7} rx={2} fill="#9C6B43" />
      <rect x={14} y={65} width={6} height={6} rx={1} fill="#7d5434" />
      <rect x={170} y={65} width={6} height={6} rx={1} fill="#7d5434" />
    </svg>
  );
}
