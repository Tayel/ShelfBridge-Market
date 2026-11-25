import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Play, Volume2, X } from "lucide-react";

const base = import.meta.env.BASE_URL;

type Country = {
  id: string; name: string;
  /** Pin position on the street picture, in % of its width and height. */
  x: number; y: number;
  story?: { title: string; preview: string; full: string; poster: string };
};

/** One pin per country InRaf is open in. Egypt has Tita Samira's story; the others say "Coming soon" until theirs exist. */
const COUNTRIES: Country[] = [
  { id: "eg", name: "Egypt", x: 81, y: 50, story: { title: "Tita Samira's shelf", preview: `${base}videos/inraf-story-loop.mp4`, full: `${base}videos/inraf-story.mp4`, poster: `${base}videos/inraf-story-poster.jpg` } },
  { id: "ae", name: "UAE", x: 77, y: 31 },
  { id: "tr", name: "Türkiye", x: 91, y: 60 },
  { id: "pt", name: "Portugal", x: 51, y: 38 },
  { id: "hu", name: "Hungary", x: 26, y: 36 },
];

/** Where a country's card opens: beside its pin on wide screens, below it on phones. */
type Place = "left" | "right" | "below";
const placeFor = (x: number, narrow: boolean): Place => (narrow ? "below" : x > 55 ? "left" : "right");

function useNarrow() {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const set = () => setNarrow(mq.matches);
    set(); mq.addEventListener("change", set);
    return () => mq.removeEventListener("change", set);
  }, []);
  return narrow;
}

/**
 * The street picture with a pin for each country. Hovering (or tapping) a pin opens a small card that grows out
 * of that spot: Egypt plays Tita Samira's story silently, with a button for the full film with sound; the other
 * countries say "Story coming soon".
 */
export function CountryStreet() {
  const [open, setOpen] = useState<string | null>(null);
  const [withSound, setWithSound] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<number | undefined>(undefined);
  const narrow = useNarrow();

  const show = (id: string) => { window.clearTimeout(closeTimer.current); if (open !== id) setWithSound(false); setOpen(id); };
  const hideSoon = () => { if (withSound) return; window.clearTimeout(closeTimer.current); closeTimer.current = window.setTimeout(() => setOpen(null), 250); };
  const close = () => { window.clearTimeout(closeTimer.current); setOpen(null); setWithSound(false); };
  const hover = {
    onPointerEnter: (id: string) => (e: React.PointerEvent) => { if (e.pointerType === "mouse") show(id); },
    onPointerLeave: (e: React.PointerEvent) => { if (e.pointerType === "mouse") hideSoon(); },
  };

  // Tapping outside the picture, or Escape, closes the card.
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => { if (!wrap.current?.contains(e.target as Node)) close(); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("pointerdown", away);
    window.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", away); window.removeEventListener("keydown", esc); };
  }, [open]);

  const c = COUNTRIES.find((x) => x.id === open);
  const place = c ? placeFor(c.x, narrow) : "right";
  const width = c?.story ? (withSound ? (narrow ? "100%" : "min(480px, 46vw)") : narrow ? "100%" : "300px") : narrow ? "12rem" : "12rem";
  // Card position inside the picture, measured from the pin.
  const pos: React.CSSProperties = !c ? {} :
    place === "left" ? { right: `calc(${100 - c.x}% + 2.75rem)`, top: `${c.y}%` } :
    place === "right" ? { left: `calc(${c.x}% + 2.75rem)`, top: `${c.y}%` } :
    c.story ? { left: 0, right: 0, top: `calc(${c.y}% + 1.4rem)` } : { left: `clamp(0%, calc(${c.x}% - 6rem), calc(100% - 12rem))`, top: `calc(${c.y}% + 1.4rem)` };
  const origin = !c ? "50% 50%" : place === "left" ? "100% 50%" : place === "right" ? "0% 50%" : `${c.story ? c.x : 50}% 0%`;
  const yShift = place === "below" ? 0 : "-50%";

  return (
    <div ref={wrap} className="mx-auto w-full max-w-xl" data-testid="country-street">
      {/* The picture has wide white margins: negative margins (a % of this box's width, which equals the picture's height) trim them without clipping the cards. */}
      <div className="relative" style={{ marginTop: "-7%", marginBottom: "-9%" }}>
        <img src={`${base}images/street.png`} alt="A street of small shops from the countries InRaf is open in" className="w-full select-none" draggable={false} />

        {COUNTRIES.map((p) => {
          const active = open === p.id;
          return (
            <button key={p.id} type="button" aria-expanded={active} aria-label={p.story ? `${p.name}: ${p.story.title}` : `${p.name}: story coming soon`}
              onPointerEnter={hover.onPointerEnter(p.id)} onPointerLeave={hover.onPointerLeave}
              onClick={() => (active ? close() : show(p.id))} onFocus={() => show(p.id)}
              className="group absolute -translate-x-1/2 -translate-y-1/2 focus-visible:outline-none" style={{ left: `${p.x}%`, top: `${p.y}%`, zIndex: active ? 21 : 10 }}
              data-testid={`pin-${p.id}`}>
              {p.story && <span className="absolute inset-0 animate-ping rounded-full bg-primary/50 motion-reduce:animate-none" />}
              <span className={`relative flex items-center gap-1.5 whitespace-nowrap rounded-full border-2 border-white px-2 py-0.5 text-[11px] font-semibold shadow-[0_8px_20px_-6px_rgba(0,0,0,.45)] transition group-hover:scale-110 group-focus-visible:ring-4 group-focus-visible:ring-ring/40 sm:px-2.5 sm:py-1 sm:text-xs ${active ? "scale-110 " : ""}${p.story ? "bg-primary text-primary-foreground" : "bg-white/95 text-foreground"}`}>
                <span aria-hidden="true" className={`h-2 w-2 rounded-full ${p.story ? "bg-white" : "bg-primary/60"}`} />{p.name}
              </span>
            </button>
          );
        })}

        <AnimatePresence>
          {c && (
            <motion.div key={c.id}
              initial={{ opacity: 0, scale: 0.15, y: yShift }} animate={{ opacity: 1, scale: 1, y: yShift }} exit={{ opacity: 0, scale: 0.15, y: yShift }}
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
              style={{ ...pos, width, transformOrigin: origin, zIndex: 20 }}
              onPointerEnter={hover.onPointerEnter(c.id)} onPointerLeave={hover.onPointerLeave}
              className="absolute overflow-hidden rounded-3xl border border-border bg-card text-left shadow-[0_30px_60px_-20px_rgba(60,30,15,.45)]"
              data-testid={`popup-${c.id}`}>
              {c.story ? (
                <>
                  <div className="relative aspect-video bg-black">
                    {withSound ? (
                      <video key="full" src={c.story.full} poster={c.story.poster} controls autoPlay playsInline className="h-full w-full" onEnded={() => setWithSound(false)} data-testid="story-full" />
                    ) : (
                      <video key="preview" src={c.story.preview} poster={c.story.poster} muted loop autoPlay playsInline className="h-full w-full object-cover" aria-hidden="true" />
                    )}
                    {withSound && (
                      <button type="button" onClick={close} aria-label="Close the story" className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-black/55 text-white hover:bg-black/75" data-testid="story-close"><X className="h-4 w-4" /></button>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-3 p-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">{c.name}</p>
                      <p className="font-display text-base font-bold leading-tight">{c.story.title}</p>
                    </div>
                    {!withSound && (
                      <button type="button" onClick={() => setWithSound(true)} className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition hover:gap-2" data-testid="story-sound">
                        <Volume2 className="h-3.5 w-3.5" /> With sound
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <div className="p-4 text-center">
                  <p className="font-display font-bold">{c.name}</p>
                  <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground"><Play className="h-3 w-3" /> Story coming soon</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
