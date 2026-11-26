import { motion } from "framer-motion";
import type { ShelfType, VenueType } from "@/lib/types";

/**
 * Drawn commercial spaces for the "I have a shop" journey: one scene per kind of business, each with the display
 * areas an owner can click (wall shelves, vitrines, counters, windows...). Illustrations in the warm InRaf style,
 * drawn in an 800×500 box so hotspots can be placed and zoomed in the same coordinates.
 */

const C = {
  cream: "#FAF6F0", sand: "#F3ECE1", plaster: "#EFE6D8", terra: "#D95D39", terraDk: "#A9432A", espresso: "#181412",
  sage: "#5E6E58", sageLt: "#A9B8A0", oak: "#C8955F", oakDk: "#9C6B43", oakLt: "#E2BC8C", brass: "#C9A45C",
  glass: "#DCEBEF", glassDk: "#B9D3DA", steel: "#8C8F94", steelLt: "#C9CCD1", night: "#2D3A4A",
};
const GOODS = ["#D95D39", "#5E6E58", "#E8B04B", "#C98B6B", "#7A6FB0", "#2F6F7E", "#B5651D", "#E9D8C4", "#8E3B46"];

export interface Hotspot {
  id: string; label: string; kind: ShelfType; dims: string;
  /** Default units and monthly price per unit (USD); the owner can change both. */
  units: number; price: number;
  x: number; y: number; w: number; h: number;
  hint: string;
}

// ---------- drawing primitives ----------
function Room({ wall = C.plaster, floor = C.oakLt, horizon = 330, boards = true }: { wall?: string; floor?: string; horizon?: number; boards?: boolean }) {
  return (
    <g>
      <rect width={800} height={horizon} fill={wall} />
      <polygon points={`0,${horizon} 800,${horizon} 800,500 0,500`} fill={floor} />
      {boards && Array.from({ length: 13 }).map((_, i) => <line key={i} x1={400 + (i - 6) * 40} y1={horizon} x2={400 + (i - 6) * 150} y2={500} stroke="#000" strokeOpacity={0.06} />)}
      <rect y={horizon - 4} width={800} height={6} fill="#000" opacity={0.06} />
    </g>
  );
}

function Goods({ x, y, w, h = 26, seed = 0, gap = 3 }: { x: number; y: number; w: number; h?: number; seed?: number; gap?: number }) {
  const out: React.ReactElement[] = [];
  let cx = x + 4, i = seed;
  while (cx < x + w - 10) {
    const iw = 8 + ((i * 7) % 11), ih = h * (0.55 + ((i * 13) % 45) / 100);
    if (cx + iw > x + w - 4) break;
    const col = GOODS[i % GOODS.length];
    out.push(<g key={i}><rect x={cx} y={y - ih} width={iw} height={ih} rx={2} fill={col} /><rect x={cx + 1.5} y={y - ih * 0.6} width={iw - 3} height={ih * 0.25} rx={1} fill="#fff" opacity={0.7} /></g>);
    cx += iw + gap; i++;
  }
  return <g>{out}</g>;
}

function WallShelf({ x, y, w, rows = 3, gap = 46, seed = 0, wood = C.oak }: { x: number; y: number; w: number; rows?: number; gap?: number; seed?: number; wood?: string }) {
  return (
    <g>
      {Array.from({ length: rows }).map((_, r) => (
        <g key={r}>
          <Goods x={x} y={y + r * gap} w={w} seed={seed + r * 5} h={gap * 0.62} />
          <rect x={x} y={y + r * gap} width={w} height={6} rx={1.5} fill={wood} />
          <rect x={x} y={y + r * gap + 6} width={w} height={3} fill="#000" opacity={0.08} />
        </g>
      ))}
    </g>
  );
}

function ArchWindow({ x, y, w, h, sun = true }: { x: number; y: number; w: number; h: number; sun?: boolean }) {
  const r = w / 2;
  return (
    <g>
      {sun && <polygon points={`${x + w},${y + 30} ${x + w + 220},${500} ${x + w + 60},500 ${x},${y + h}`} fill="#FFE7B8" opacity={0.35} />}
      <path d={`M${x},${y + h} V${y + r} A${r},${r} 0 0 1 ${x + w},${y + r} V${y + h} Z`} fill={C.glass} stroke={C.espresso} strokeWidth={5} />
      <line x1={x + r} y1={y} x2={x + r} y2={y + h} stroke={C.espresso} strokeWidth={3} />
      <line x1={x} y1={y + r + 40} x2={x + w} y2={y + r + 40} stroke={C.espresso} strokeWidth={3} />
      <line x1={x} y1={y + h - 60} x2={x + w} y2={y + h - 60} stroke={C.espresso} strokeWidth={3} />
    </g>
  );
}

function Vitrine({ x, y, w, h, frame = C.brass, seed = 0, lit = true }: { x: number; y: number; w: number; h: number; frame?: string; seed?: number; lit?: boolean }) {
  return (
    <g>
      <rect x={x} y={y + h * 0.55} width={w} height={h * 0.45} rx={3} fill={C.oakDk} />
      <rect x={x} y={y} width={w} height={h * 0.55} rx={3} fill={lit ? "#FFF6DF" : C.glass} opacity={0.9} stroke={frame} strokeWidth={4} />
      <rect x={x + 6} y={y + h * 0.3} width={w - 12} height={3} fill={frame} />
      {Array.from({ length: Math.floor((w - 20) / 26) }).map((_, i) => (
        <g key={i}>
          <circle cx={x + 20 + i * 26} cy={y + h * 0.22} r={5} fill="none" stroke={GOODS[(seed + i) % 4 === 0 ? 2 : 6]} strokeWidth={2.5} />
          <rect x={x + 14 + i * 26} y={y + h * 0.41} width={12} height={7} rx={2} fill={GOODS[(seed + i * 3) % GOODS.length]} />
        </g>
      ))}
    </g>
  );
}

function Counter({ x, y, w, h, top = C.oakLt, body = C.oakDk }: { x: number; y: number; w: number; h: number; top?: string; body?: string }) {
  return <g><rect x={x} y={y + 8} width={w} height={h - 8} rx={4} fill={body} /><rect x={x - 6} y={y} width={w + 12} height={10} rx={3} fill={top} /></g>;
}

function Table({ x, y, w, seed = 0 }: { x: number; y: number; w: number; seed?: number }) {
  return (
    <g>
      <rect x={x + 12} y={y + 14} width={14} height={70} fill={C.oakDk} />
      <rect x={x + w - 26} y={y + 14} width={14} height={70} fill={C.oakDk} />
      <rect x={x} y={y} width={w} height={16} rx={3} fill={C.oak} />
      <Goods x={x + 10} y={y} w={w - 20} h={34} seed={seed} gap={8} />
    </g>
  );
}

function Rack({ x, y, w }: { x: number; y: number; w: number }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={4} fill={C.brass} />
      <rect x={x} y={y} width={4} height={150} fill={C.brass} /><rect x={x + w - 4} y={y} width={4} height={150} fill={C.brass} />
      {Array.from({ length: Math.floor(w / 22) }).map((_, i) => (
        <path key={i} d={`M${x + 10 + i * 22},${y + 4} l-9,14 v70 h20 v-70 z`} fill={["#E9D8C4", "#C98B6B", C.sageLt, "#F1E4D3"][i % 4]} stroke="#000" strokeOpacity={0.08} />
      ))}
    </g>
  );
}

function Awning({ x, y, w }: { x: number; y: number; w: number }) {
  const n = Math.floor(w / 20);
  return (
    <g>
      {Array.from({ length: n }).map((_, i) => <path key={i} d={`M${x + i * 20},${y} h20 v26 a10,10 0 0 1 -20,0 z`} fill={i % 2 ? C.cream : C.terra} />)}
    </g>
  );
}

function Plant({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x},${y}) scale(${s})`}>
      {[-30, -12, 8, 26, 0].map((a, i) => <ellipse key={i} cx={0} cy={-46} rx={9} ry={34} fill={i % 2 ? C.sage : "#71836A"} transform={`rotate(${a} 0 -10)`} />)}
      <path d="M-18,-12 h36 l-5,32 h-26 z" fill={C.terra} />
    </g>
  );
}

function Pendant({ x, y, len = 60 }: { x: number; y: number; len?: number }) {
  return <g><line x1={x} y1={y} x2={x} y2={y + len} stroke={C.espresso} strokeWidth={1.5} /><path d={`M${x - 16},${y + len + 14} a16,14 0 0 1 32,0 z`} fill={C.brass} /><circle cx={x} cy={y + len + 16} r={4} fill="#FFE7B8" /></g>;
}

function Fridge({ x, y, w, h, seed = 0 }: { x: number; y: number; w: number; h: number; seed?: number }) {
  const rows = 4, gap = (h - 30) / rows;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={6} fill={C.steelLt} />
      <rect x={x + 8} y={y + 18} width={w - 16} height={h - 26} rx={3} fill="#EAF6F8" />
      {Array.from({ length: rows }).map((_, r) => <g key={r}><Goods x={x + 10} y={y + 18 + (r + 1) * gap} w={w - 20} h={gap * 0.7} seed={seed + r * 3} /><rect x={x + 8} y={y + 18 + (r + 1) * gap} width={w - 16} height={3} fill={C.steel} /></g>)}
      <rect x={x} y={y} width={w} height={14} rx={6} fill={C.night} />
      <line x1={x + w / 2} y1={y + 18} x2={x + w / 2} y2={y + h - 8} stroke={C.steel} strokeWidth={2} />
    </g>
  );
}

function Gondola({ x, y, w, h, seed = 0, rows = 4, color = C.steelLt }: { x: number; y: number; w: number; h: number; seed?: number; rows?: number; color?: string }) {
  const gap = (h - 10) / rows;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill={color} />
      {Array.from({ length: rows }).map((_, r) => <g key={r}><Goods x={x + 2} y={y + 6 + (r + 1) * gap - 4} w={w - 4} h={gap * 0.75} seed={seed + r * 4} gap={2} /><rect x={x} y={y + 6 + (r + 1) * gap - 4} width={w} height={4} fill={C.steel} /></g>)}
    </g>
  );
}

function Sign({ x, y, w, text, bg = C.espresso, fg = C.cream, size = 16 }: { x: number; y: number; w: number; text: string; bg?: string; fg?: string; size?: number }) {
  return <g><rect x={x} y={y} width={w} height={size + 14} rx={4} fill={bg} /><text x={x + w / 2} y={y + size + 3} textAnchor="middle" fontSize={size} fontWeight={700} fill={fg} fontFamily="system-ui, -apple-system, sans-serif">{text}</text></g>;
}

// ---------- scenes ----------
const SCENES: Record<VenueType, { title: string; draw: () => React.ReactElement; hotspots: Hotspot[] }> = {
  street: {
    title: "A street boutique",
    draw: () => (
      <g>
        <Room />
        <ArchWindow x={30} y={50} w={140} h={260} />
        <Goods x={36} y={250} w={128} h={30} seed={2} />
        <rect x={34} y={250} width={132} height={6} fill={C.oak} />
        <WallShelf x={250} y={90} w={210} rows={4} gap={52} seed={1} />
        <Vitrine x={300} y={300} w={190} h={100} />
        <Awning x={560} y={110} w={200} />
        <rect x={560} y={136} width={200} height={194} fill={C.sand} />
        <Rack x={580} y={160} w={160} />
        <Table x={90} y={380} w={200} seed={4} />
        <Plant x={520} y={330} s={1.1} />
        <Pendant x={390} y={0} len={30} /><Pendant x={660} y={0} len={50} />
      </g>
    ),
    hotspots: [
      { id: "window", label: "Window display", kind: "window", dims: "120 × 40 cm ledge", units: 2, price: 60, x: 30, y: 170, w: 140, h: 100, hint: "Seen from the street by everyone who walks past." },
      { id: "wall", label: "Floating wall shelves", kind: "eye-level", dims: "4 shelves · 90 × 30 cm each", units: 4, price: 35, x: 245, y: 50, w: 220, h: 220, hint: "Eye-level oak shelves for ceramics, bottles and gifts." },
      { id: "vitrine", label: "Glass vitrine counter", kind: "checkout", dims: "Lit case · 6 trays", units: 3, price: 55, x: 294, y: 294, w: 202, h: 110, hint: "Locked, lit case by the till for jewellery and watches." },
      { id: "corner", label: "Brand corner", kind: "endcap", dims: "Alcove · 2 m rail", units: 1, price: 180, x: 560, y: 108, w: 200, h: 222, hint: "A whole alcove for one brand: rail, awning and sign." },
      { id: "table", label: "Central display table", kind: "endcap", dims: "160 × 80 cm top", units: 2, price: 70, x: 84, y: 340, w: 212, h: 130, hint: "The first thing shoppers reach when they come in." },
    ],
  },
  mall: {
    title: "A shopping mall store",
    draw: () => (
      <g>
        <Room wall="#EDEFF0" floor="#E5E1DA" boards={false} />
        {Array.from({ length: 8 }).map((_, i) => <line key={i} x1={i * 110} y1={330} x2={i * 110 - 200} y2={500} stroke="#000" strokeOpacity={0.05} />)}
        <rect x={40} y={60} width={340} height={270} fill={C.glass} stroke={C.steel} strokeWidth={6} />
        <Sign x={130} y={30} w={160} text="BOUTIQUE" />
        <WallShelf x={60} y={140} w={300} rows={3} gap={56} seed={3} wood={C.steelLt} />
        <rect x={420} y={60} width={340} height={270} fill={C.glass} stroke={C.steel} strokeWidth={6} />
        <Sign x={520} y={30} w={140} text="NEW IN" bg={C.terra} />
        <Rack x={450} y={150} w={140} />
        <WallShelf x={610} y={140} w={130} rows={3} gap={56} seed={7} wood={C.steelLt} />
        <g><ellipse cx={400} cy={455} rx={120} ry={18} fill="#000" opacity={0.07} /><rect x={290} y={380} width={220} height={70} rx={10} fill={C.cream} stroke={C.oak} strokeWidth={4} /><Goods x={300} y={380} w={200} h={36} seed={5} gap={6} /></g>
        <g><rect x={620} y={360} width={130} height={100} rx={10} fill={C.terra} /><rect x={612} y={350} width={146} height={14} rx={4} fill={C.espresso} /><Goods x={630} y={350} w={110} h={28} seed={9} /><text x={685} y={420} textAnchor="middle" fill={C.cream} fontSize={14} fontWeight={700} fontFamily="system-ui, -apple-system, sans-serif">POP-UP</text></g>
        <Counter x={60} y={380} w={160} h={70} />
        <Plant x={560} y={470} s={0.9} />
      </g>
    ),
    hotspots: [
      { id: "storefront", label: "Glass storefront window", kind: "window", dims: "3 m frontage · 2 levels", units: 2, price: 120, x: 40, y: 60, w: 340, h: 70, hint: "Facing the mall corridor and its foot traffic." },
      { id: "promo", label: "Promotional wall shelving", kind: "eye-level", dims: "3 shelves · 3 m run", units: 6, price: 60, x: 50, y: 130, w: 320, h: 180, hint: "Steel shelving for packaged goods and gifts." },
      { id: "island", label: "Brand display island", kind: "endcap", dims: "220 × 70 cm island", units: 2, price: 150, x: 284, y: 360, w: 232, h: 100, hint: "Centre of the store, seen from every side." },
      { id: "kiosk", label: "Pop-up kiosk", kind: "endcap", dims: "1.5 × 1 m kiosk", units: 1, price: 400, x: 606, y: 344, w: 160, h: 122, hint: "Short-term pop-ups for launches and seasonal brands." },
      { id: "checkout", label: "Checkout counter", kind: "checkout", dims: "Counter-top and front rail", units: 3, price: 45, x: 50, y: 370, w: 180, h: 84, hint: "Small add-on items every shopper sees while paying." },
    ],
  },
  airport: {
    title: "An airport departure shop",
    draw: () => (
      <g>
        <Room wall="#E8ECEF" floor="#D9D5CF" boards={false} />
        <rect x={0} y={20} width={800} height={150} fill="#BFD8E2" />
        {Array.from({ length: 7 }).map((_, i) => <rect key={i} x={i * 120} y={20} width={8} height={150} fill={C.steel} />)}
        <path d="M520,90 l120,-8 l30,-14 l8,4 l-20,18 l60,-2 l6,6 l-66,8 l-30,22 l-12,0 l14,-20 l-104,4 z" fill="#fff" opacity={0.9} />
        <g><rect x={40} y={40} width={300} height={74} rx={4} fill={C.night} /><text x={56} y={66} fill="#F6C453" fontSize={14} fontWeight={700} fontFamily="ui-monospace, monospace">DEPARTURES</text><text x={56} y={90} fill="#E8ECEF" fontSize={12} fontFamily="ui-monospace, monospace">EK 921  CAI  GATE B12  BOARDING</text><text x={56} y={104} fill="#E8ECEF" fontSize={12} fontFamily="ui-monospace, monospace">TK 763  IST  GATE B07  ON TIME</text></g>
        <Sign x={330} y={186} w={180} text="DUTY FREE" bg={C.terra} />
        <Gondola x={40} y={190} w={240} h={140} seed={2} />
        <Gondola x={540} y={190} w={220} h={140} seed={6} color="#F1E9DE" />
        <g><rect x={330} y={330} width={140} height={120} rx={6} fill={C.cream} stroke={C.brass} strokeWidth={3} /><Goods x={340} y={360} w={120} h={22} seed={1} /><rect x={336} y={360} width={128} height={3} fill={C.brass} /><Goods x={340} y={395} w={120} h={22} seed={4} /><rect x={336} y={395} width={128} height={3} fill={C.brass} /><text x={400} y={432} textAnchor="middle" fontSize={11} fontWeight={700} fill={C.espresso} fontFamily="system-ui, -apple-system, sans-serif">PERFUME</text></g>
        <g><rect x={90} y={360} width={120} height={110} rx={8} fill={C.sage} /><Goods x={100} y={392} w={100} h={24} seed={3} /><Goods x={100} y={430} w={100} h={24} seed={8} /><text x={150} y={378} textAnchor="middle" fontSize={11} fontWeight={700} fill={C.cream} fontFamily="system-ui, -apple-system, sans-serif">TRAVEL ESSENTIALS</text></g>
        <Fridge x={600} y={340} w={90} h={130} seed={2} />
        <Counter x={480} y={410} w={100} h={60} top={C.steelLt} body={C.night} />
      </g>
    ),
    hotspots: [
      { id: "gate", label: "Departure-gate stand", kind: "endcap", dims: "120 × 60 cm stand", units: 2, price: 220, x: 84, y: 350, w: 132, h: 124, hint: "Last-minute travel essentials for passengers about to board." },
      { id: "dutyfree", label: "Duty-free wall", kind: "eye-level", dims: "4 shelves · 2.4 m run", units: 8, price: 140, x: 36, y: 180, w: 248, h: 154, hint: "Local specialties and souvenirs for travellers." },
      { id: "perfume", label: "Perfume & beauty gondola", kind: "endcap", dims: "Lit gondola · 2 tiers", units: 4, price: 180, x: 324, y: 324, w: 152, h: 132, hint: "High-value beauty and fragrance, seen from the walkway." },
      { id: "chiller", label: "Snack & drinks chiller", kind: "fridge", dims: "4 chilled shelves", units: 4, price: 120, x: 594, y: 334, w: 102, h: 140, hint: "Packaged snacks and drinks for the flight." },
      { id: "till", label: "Checkout counter", kind: "checkout", dims: "Counter rail · 60 cm", units: 2, price: 90, x: 472, y: 400, w: 116, h: 72, hint: "Chargers, adapters and small gifts while paying." },
    ],
  },
  hotel: {
    title: "A hotel lobby",
    draw: () => (
      <g>
        <Room wall="#EDE2D2" floor="#E6D9C6" boards={false} />
        {Array.from({ length: 6 }).map((_, i) => <rect key={i} x={i * 140} y={330} width={140} height={170} fill={i % 2 ? "#E1D2BC" : "#E9DDCB"} opacity={0.6} />)}
        <g><line x1={400} y1={0} x2={400} y2={36} stroke={C.brass} strokeWidth={2} />{[-60, -30, 0, 30, 60].map((d) => <g key={d}><line x1={400} y1={36} x2={400 + d} y2={56} stroke={C.brass} /><circle cx={400 + d} cy={60} r={6} fill="#FFE7B8" stroke={C.brass} /></g>)}</g>
        <rect x={260} y={110} width={280} height={60} rx={4} fill={C.sage} opacity={0.25} />
        <text x={400} y={150} textAnchor="middle" fontSize={22} fontFamily="Georgia, serif" fill={C.espresso} letterSpacing={6}>RECEPTION</text>
        <Counter x={250} y={260} w={300} h={90} top={C.brass} body="#5C4636" />
        <Goods x={270} y={260} w={110} h={28} seed={2} gap={6} />
        <WallShelf x={40} y={110} w={170} rows={4} gap={50} seed={4} wood={C.oakDk} />
        <Vitrine x={590} y={180} w={170} h={150} />
        <text x={675} y={172} textAnchor="middle" fontSize={12} fontWeight={700} fill={C.espresso} fontFamily="system-ui, -apple-system, sans-serif" letterSpacing={2}>GIFT SHOP</text>
        <Table x={120} y={380} w={180} seed={6} />
        <Plant x={600} y={460} s={1.2} /><Plant x={230} y={330} s={0.8} />
        <g><rect x={480} y={390} width={60} height={80} rx={6} fill={C.oakDk} /><rect x={470} y={380} width={80} height={14} rx={4} fill={C.oak} /><Goods x={478} y={380} w={64} h={22} seed={7} /></g>
      </g>
    ),
    hotspots: [
      { id: "reception", label: "Reception counter display", kind: "checkout", dims: "Counter top · 1 m", units: 2, price: 90, x: 244, y: 250, w: 312, h: 104, hint: "Every guest stops here at check-in and check-out." },
      { id: "giftshop", label: "Gift shop vitrine", kind: "eye-level", dims: "Lit case · 6 trays", units: 4, price: 110, x: 584, y: 160, w: 182, h: 174, hint: "Curated local gifts, jewellery and souvenirs." },
      { id: "lobbyshelf", label: "Lobby wall shelf", kind: "eye-level", dims: "4 shelves · 1.7 m", units: 4, price: 70, x: 34, y: 70, w: 182, h: 220, hint: "Books, ceramics and packaged specialties." },
      { id: "console", label: "Lobby console table", kind: "endcap", dims: "180 × 60 cm", units: 2, price: 85, x: 114, y: 344, w: 192, h: 126, hint: "Seen by guests waiting in the lounge." },
      { id: "concierge", label: "Concierge stand", kind: "checkout", dims: "Small stand · 80 cm", units: 1, price: 60, x: 464, y: 360, w: 92, h: 114, hint: "Travel essentials and last-minute items." },
    ],
  },
  factory: {
    title: "A factory outlet and warehouse",
    draw: () => (
      <g>
        <Room wall="#E2E0DA" floor="#CFCAC1" boards={false} />
        {Array.from({ length: 8 }).map((_, i) => <line key={i} x1={i * 110} y1={0} x2={i * 110} y2={330} stroke="#000" strokeOpacity={0.05} strokeWidth={8} />)}
        <g><rect x={560} y={90} width={200} height={240} fill={C.steel} />{Array.from({ length: 12 }).map((_, i) => <line key={i} x1={560} y1={100 + i * 19} x2={760} y2={100 + i * 19} stroke="#fff" strokeOpacity={0.35} />)}<Sign x={600} y={56} w={120} text="LOADING BAY" size={12} bg={C.night} /></g>
        {[0, 1].map((col) => <g key={col}><rect x={40 + col * 220} y={70} width={6} height={260} fill={C.terra} /><rect x={240 + col * 220 - 40} y={70} width={6} height={260} fill={C.terra} />{[0, 1, 2].map((r) => <g key={r}><rect x={40 + col * 220} y={150 + r * 80} width={166} height={7} fill="#3E5C76" />{[0, 1, 2].map((b) => <rect key={b} x={52 + col * 220 + b * 50} y={110 + r * 80} width={44} height={40} fill={["#C9A27A", "#B98E63", "#D6B48F"][(b + r + col) % 3]} stroke="#8a6a4a" />)}</g>)}</g>)}
        <Table x={70} y={390} w={220} seed={3} />
        <g><rect x={340} y={400} width={90} height={70} fill="#3E5C76" /><rect x={440} y={400} width={90} height={70} fill="#3E5C76" /><Goods x={344} y={402} w={82} h={28} seed={5} /><Goods x={444} y={402} w={82} h={28} seed={8} /><text x={435} y={444} textAnchor="middle" fill="#fff" fontSize={12} fontWeight={700} fontFamily="system-ui, -apple-system, sans-serif">CLEARANCE</text></g>
        <Counter x={600} y={390} w={150} h={80} top={C.steelLt} body={C.night} />
      </g>
    ),
    hotspots: [
      { id: "outlet", label: "Outlet display table", kind: "endcap", dims: "220 × 90 cm", units: 3, price: 40, x: 64, y: 350, w: 232, h: 124, hint: "Factory-direct products for walk-in buyers." },
      { id: "racks", label: "Pallet racking (surplus stock)", kind: "eye-level", dims: "6 bays · 3 levels", units: 6, price: 50, x: 36, y: 66, w: 434, h: 268, hint: "Excess production and overstock, stored and listed." },
      { id: "clearance", label: "Clearance bins", kind: "endcap", dims: "2 bins · 90 × 70 cm", units: 2, price: 30, x: 334, y: 380, w: 202, h: 94, hint: "Seasonal, discontinued and packaging-change stock." },
      { id: "wholesale", label: "Wholesale counter", kind: "checkout", dims: "Trade counter", units: 1, price: 80, x: 594, y: 380, w: 162, h: 94, hint: "Bulk orders from shops and hotels." },
      { id: "bay", label: "Loading-bay collection", kind: "endcap", dims: "Collection point", units: 1, price: 60, x: 556, y: 50, w: 208, h: 284, hint: "Buyers and InRaf couriers collect from here." },
    ],
  },
  supermarket: {
    title: "A supermarket",
    draw: () => (
      <g>
        <Room wall="#EEF0EC" floor="#E4E2DC" boards={false} />
        {Array.from({ length: 10 }).map((_, i) => <line key={i} x1={i * 90} y1={330} x2={i * 90 - 250} y2={500} stroke="#000" strokeOpacity={0.04} />)}
        <Sign x={300} y={20} w={200} text="FRESH · LOCAL · DAILY" size={13} bg={C.sage} />
        <Gondola x={30} y={70} w={220} h={260} seed={1} rows={5} />
        <Gondola x={290} y={110} w={220} h={220} seed={5} rows={4} color="#F1E9DE" />
        <Fridge x={560} y={70} w={200} h={260} seed={3} />
        <g><rect x={290} y={70} width={220} height={36} rx={4} fill={C.terra} /><text x={400} y={94} textAnchor="middle" fill={C.cream} fontSize={14} fontWeight={700} fontFamily="system-ui, -apple-system, sans-serif">LOCAL BRANDS</text></g>
        <g><rect x={60} y={360} width={150} height={110} fill={C.terra} /><Goods x={66} y={395} w={138} h={28} seed={2} /><Goods x={66} y={435} w={138} h={28} seed={6} /><rect x={60} y={395} width={150} height={4} fill={C.terraDk} /><rect x={60} y={435} width={150} height={4} fill={C.terraDk} /></g>
        <g><Counter x={520} y={400} w={220} h={70} top={C.steelLt} body={C.night} /><rect x={530} y={360} width={50} height={40} fill={C.steelLt} /><Goods x={600} y={400} w={120} h={22} seed={9} /></g>
      </g>
    ),
    hotspots: [
      { id: "aisle", label: "Eye-level aisle shelves", kind: "eye-level", dims: "5 shelves · 2.2 m", units: 10, price: 30, x: 26, y: 66, w: 228, h: 268, hint: "The shelves shoppers see first in the aisle." },
      { id: "brand", label: "Dedicated brand section", kind: "eye-level", dims: "4 shelves · 2.2 m", units: 4, price: 90, x: 286, y: 66, w: 228, h: 268, hint: "A signed section for local or independent brands." },
      { id: "fridge", label: "Chilled cabinet", kind: "fridge", dims: "4 chilled shelves", units: 4, price: 70, x: 556, y: 66, w: 208, h: 268, hint: "Dairy, drinks and chilled specialties." },
      { id: "endcap", label: "Promotional endcap", kind: "endcap", dims: "150 cm endcap", units: 2, price: 110, x: 54, y: 350, w: 162, h: 124, hint: "End of the aisle, seen from two directions." },
      { id: "checkout", label: "Checkout display", kind: "checkout", dims: "Till rail · 1 m", units: 3, price: 45, x: 510, y: 352, w: 240, h: 122, hint: "Impulse buys while shoppers queue." },
    ],
  },
  cafe: {
    title: "A café",
    draw: () => (
      <g>
        <Room wall="#EADFD0" />
        <rect x={0} y={210} width={800} height={120} fill={C.sage} opacity={0.18} />
        <g><rect x={300} y={40} width={200} height={110} rx={6} fill={C.espresso} /><text x={400} y={70} textAnchor="middle" fill={C.cream} fontSize={16} fontFamily="Georgia, serif">MENU</text>{["Espresso", "Flat white", "Mint tea"].map((m, i) => <text key={m} x={320} y={96 + i * 18} fill={C.cream} fontSize={12} fontFamily="system-ui, -apple-system, sans-serif">{m}</text>)}</g>
        <WallShelf x={40} y={100} w={200} rows={4} gap={52} seed={2} />
        <ArchWindow x={620} y={50} w={130} h={250} />
        <Counter x={260} y={290} w={300} h={110} />
        <Vitrine x={280} y={220} w={150} h={70} lit />
        <g><rect x={460} y={250} width={30} height={40} rx={4} fill={C.night} /><rect x={500} y={240} width={40} height={50} rx={4} fill={C.steel} /></g>
        <g><rect x={70} y={380} width={160} height={90} fill={C.oakDk} /><rect x={64} y={370} width={172} height={12} rx={3} fill={C.oak} /><Goods x={74} y={370} w={152} h={30} seed={7} /><text x={150} y={430} textAnchor="middle" fill={C.cream} fontSize={12} fontWeight={700} fontFamily="system-ui, -apple-system, sans-serif">TAKE HOME</text></g>
        <Pendant x={330} y={0} len={20} /><Pendant x={480} y={0} len={20} />
        <Plant x={600} y={470} s={1} />
      </g>
    ),
    hotspots: [
      { id: "retail", label: "Retail wall shelf", kind: "eye-level", dims: "4 shelves · 2 m", units: 4, price: 40, x: 34, y: 60, w: 212, h: 216, hint: "Coffee beans, tea, honey and packaged treats." },
      { id: "counter", label: "Counter display", kind: "checkout", dims: "Counter top · 1 m", units: 2, price: 50, x: 440, y: 230, w: 120, h: 70, hint: "Small items customers add while ordering." },
      { id: "pastry", label: "Pastry vitrine", kind: "fridge", dims: "Chilled case · 3 trays", units: 3, price: 60, x: 274, y: 214, w: 162, h: 82, hint: "Chilled case for cakes, chocolates and dates." },
      { id: "corner", label: "Take-home corner", kind: "endcap", dims: "Cabinet · 160 cm", units: 2, price: 55, x: 60, y: 350, w: 182, h: 124, hint: "Gift boxes and packaged products to take away." },
      { id: "window", label: "Window ledge", kind: "window", dims: "130 × 30 cm ledge", units: 1, price: 45, x: 620, y: 200, w: 130, h: 100, hint: "Street-facing display by the seating." },
    ],
  },
  other: {
    title: "Your commercial space",
    draw: () => (
      <g>
        <Room />
        <WallShelf x={60} y={100} w={240} rows={4} gap={50} seed={3} />
        <ArchWindow x={600} y={60} w={140} h={250} />
        <Counter x={360} y={300} w={200} h={100} />
        <Goods x={380} y={300} w={150} h={28} seed={6} gap={6} />
        <Table x={110} y={390} w={200} seed={2} />
        <Plant x={640} y={470} s={1} />
      </g>
    ),
    hotspots: [
      { id: "shelf", label: "Wall shelves", kind: "eye-level", dims: "4 shelves · 2.4 m", units: 4, price: 35, x: 54, y: 60, w: 252, h: 216, hint: "Any shelving you can free up." },
      { id: "counter", label: "Counter", kind: "checkout", dims: "Counter top · 1 m", units: 2, price: 45, x: 354, y: 290, w: 212, h: 114, hint: "Small items near where customers pay." },
      { id: "table", label: "Display table", kind: "endcap", dims: "160 × 80 cm", units: 2, price: 60, x: 104, y: 350, w: 212, h: 124, hint: "A table or stand in the middle of the space." },
      { id: "window", label: "Window", kind: "window", dims: "140 × 40 cm ledge", units: 1, price: 50, x: 600, y: 180, w: 140, h: 130, hint: "Facing the street or a corridor." },
    ],
  },
};

export const sceneHotspots = (v: VenueType) => SCENES[v].hotspots;
export const sceneTitle = (v: VenueType) => SCENES[v].title;

/** The scene alone, for cards. */
export function SceneArt({ venue, className = "" }: { venue: VenueType; className?: string }) {
  return <svg viewBox="0 0 800 500" className={className} aria-hidden="true" preserveAspectRatio="xMidYMid slice">{SCENES[venue].draw()}</svg>;
}

/**
 * The interactive scene: numbered pins on each display area; clicking one zooms the view onto it.
 * `active` areas are terracotta, inactive ones grey.
 */
export function SceneInteractive({ venue, selected, active, onSelect }: { venue: VenueType; selected: string | null; active: Record<string, boolean>; onSelect: (id: string | null) => void }) {
  const s = SCENES[venue];
  const h = s.hotspots.find((x) => x.id === selected);
  // Zoom: a viewBox around the selected area, kept inside the picture and at the picture's 8:5 shape.
  let vb = "0 0 800 500";
  if (h) {
    const w = Math.min(800, Math.max(380, h.w * 1.9, h.h * 1.9 * 1.6)), hh = w / 1.6;
    const x = Math.min(800 - w, Math.max(0, h.x + h.w / 2 - w / 2)), y = Math.min(500 - hh, Math.max(0, h.y + h.h / 2 - hh / 2));
    vb = `${x.toFixed(1)} ${y.toFixed(1)} ${w.toFixed(1)} ${hh.toFixed(1)}`;
  }
  return (
    <motion.svg viewBox="0 0 800 500" animate={{ viewBox: vb }} transition={{ type: "spring", stiffness: 90, damping: 20 }}
      className="block w-full" role="group" aria-label={`${s.title}: choose a display area`} data-testid={`scene-${venue}`}>
      <g onClick={() => onSelect(null)}>{s.draw()}</g>
      {s.hotspots.map((p, i) => {
        const on = active[p.id] ?? false, sel = selected === p.id;
        return (
          <g key={p.id} role="button" tabIndex={0} aria-label={`${p.label}${on ? ", offered" : ""}`} aria-pressed={sel} data-testid={`hotspot-${p.id}`}
            onClick={(e) => { e.stopPropagation(); onSelect(sel ? null : p.id); }}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(sel ? null : p.id); } }}
            className="group cursor-pointer focus:outline-none">
            <rect x={p.x} y={p.y} width={p.w} height={p.h} rx={10} fill={on ? C.terra : "#fff"} fillOpacity={sel ? 0.16 : on ? 0.08 : 0}
              stroke={sel ? C.terra : on ? C.terra : "#fff"} strokeWidth={sel ? 3 : 2} strokeDasharray={sel || on ? undefined : "8 6"}
              className="opacity-70 transition group-hover:opacity-100 group-focus-visible:opacity-100" />
            <g transform={`translate(${p.x + p.w / 2},${p.y - 4})`}>
              {!sel && <circle r={16} fill={on ? C.terra : C.espresso} opacity={0.3} className="animate-ping motion-reduce:animate-none" style={{ transformOrigin: "center", transformBox: "fill-box" }} />}
              <circle r={14} fill={on ? C.terra : C.espresso} stroke="#fff" strokeWidth={3} />
              <text y={5} textAnchor="middle" fontSize={14} fontWeight={800} fill="#fff" fontFamily="system-ui, -apple-system, sans-serif">{i + 1}</text>
            </g>
          </g>
        );
      })}
    </motion.svg>
  );
}
