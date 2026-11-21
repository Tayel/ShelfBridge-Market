import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Maximize2, Play, X } from "lucide-react";
import { PRODUCT_JOURNEY, type ProductId } from "@/lib/data";
import { asset } from "@/components/product-bits";

const canHover = () => typeof window !== "undefined" && window.matchMedia?.("(hover: hover) and (pointer: fine)").matches;

/**
 * Mouse hover over a whole section (a card, say), ignoring touch and pen so a tap never counts as a hover.
 * Spread `bind` on the section and pass `hovered` to <ProductVideo active>.
 */
export function useMouseHover() {
  const [hovered, setHovered] = useState(false);
  const bind = {
    onPointerEnter: (e: React.PointerEvent) => { if (e.pointerType === "mouse") setHovered(true); },
    onPointerLeave: (e: React.PointerEvent) => { if (e.pointerType === "mouse") setHovered(false); },
  };
  return { hovered, bind };
}

/**
 * A product's picture that turns into its promo video.
 * - Mouse: plays while the pointer is over the section (`active`, or the picture itself), and returns to the
 *   picture when it leaves. A click opens the larger player.
 * - Touch: the first tap plays the preview in place, a second tap opens the larger player, and tapping
 *   anywhere else returns to the picture.
 * - Keyboard: focus plays the preview, Enter opens the larger player.
 * The preview is a small, muted, fast-start file; the larger player streams the full one with sound.
 */
export function ProductVideo({ product, active, className = "", imgClassName = "", alt = "", playerExtra }: {
  product: ProductId;
  /** The surrounding section is hovered (from useMouseHover). Leave unset to use the picture's own hover. */
  active?: boolean;
  className?: string;
  imgClassName?: string;
  alt?: string;
  /** Shown under the larger player, e.g. a call to action. */
  playerExtra?: ReactNode;
}) {
  const j = PRODUCT_JOURNEY[product];
  const box = useRef<HTMLButtonElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const pointer = useRef<string>("mouse");
  const [ownHover, setOwnHover] = useState(false);
  const [focused, setFocused] = useState(false);
  const [tapped, setTapped] = useState(false);
  const [showing, setShowing] = useState(false);
  const [open, setOpen] = useState(false);
  const [resumeAt, setResumeAt] = useState(0);
  const [touch, setTouch] = useState(false);

  const playing = !open && ((active ?? ownHover) || focused || tapped);

  // On mouse devices, buffer the preview shortly after load so the first hover starts at once.
  useEffect(() => {
    setTouch(!canHover());
    if (!canHover()) return;
    const t = window.setTimeout(() => { const v = video.current; if (v && v.preload !== "auto") { v.preload = "auto"; v.load(); } }, 1200);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    const v = video.current;
    if (!v) return;
    if (playing) {
      if (v.preload !== "auto") v.preload = "auto";
      v.play().catch(() => setShowing(false));
    } else {
      v.pause();
      v.currentTime = 0;
      setShowing(false);
    }
  }, [playing]);

  // Touch: a tap anywhere outside the picture stops the preview.
  useEffect(() => {
    if (!tapped) return;
    const off = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setTapped(false); };
    document.addEventListener("pointerdown", off);
    return () => document.removeEventListener("pointerdown", off);
  }, [tapped]);

  const enlarge = useCallback(() => {
    setResumeAt(video.current?.currentTime ?? 0);
    setTapped(false);
    setOpen(true);
  }, []);

  const onClick = () => {
    const isTouch = pointer.current === "touch" || pointer.current === "pen";
    if (isTouch && !tapped) { setTapped(true); return; }
    enlarge();
  };

  const hint = touch ? (tapped ? "Tap again to watch larger" : "Tap to play") : "Hover to play · click to watch larger";

  return (
    <>
      <button
        ref={box}
        type="button"
        aria-label={`Play the ${j.title} video`}
        onPointerDown={(e) => { pointer.current = e.pointerType; }}
        onPointerEnter={(e) => { if (e.pointerType === "mouse") setOwnHover(true); }}
        onPointerLeave={(e) => { if (e.pointerType === "mouse") setOwnHover(false); }}
        onFocus={(e) => { if (e.currentTarget.matches(":focus-visible")) setFocused(true); }}
        onBlur={() => setFocused(false)}
        onClick={onClick}
        className={`group/video relative block w-full cursor-pointer overflow-hidden bg-muted focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-ring/40 ${className}`}
        data-testid={`video-preview-${product}`}
        data-playing={showing ? "true" : "false"}
      >
        <img src={asset(j.illustration)} alt={alt} className={`h-full w-full object-cover object-center ${imgClassName}`} draggable={false} />
        <video
          ref={video}
          src={asset(j.video.preview)}
          poster={asset(j.illustration)}
          muted
          loop
          playsInline
          preload="metadata"
          aria-hidden
          tabIndex={-1}
          onPlaying={() => setShowing(true)}
          className={`pointer-events-none absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${showing ? "opacity-100" : "opacity-0"}`}
        />
        <span className={`pointer-events-none absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-background/90 px-3 py-1 text-xs font-semibold text-foreground shadow-sm transition-opacity duration-300 ${showing && !touch ? "opacity-0" : "opacity-100"}`}>
          {tapped ? <Maximize2 className="h-3.5 w-3.5 text-primary" /> : <Play className="h-3.5 w-3.5 fill-primary text-primary" />}
          {hint}
        </span>
        {showing && !touch && (
          <span className="pointer-events-none absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-background/90 text-foreground shadow-sm"><Maximize2 className="h-4 w-4" /></span>
        )}
      </button>
      {/* Rendered at the page root: a lifted (transformed) card would otherwise trap the fixed overlay inside it. */}
      {typeof document !== "undefined" && createPortal(
        <AnimatePresence>
          {open && <Player product={product} startAt={resumeAt} onClose={() => { setOpen(false); box.current?.focus({ preventScroll: true }); }}>{playerExtra}</Player>}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}

/** The larger viewing area: the full video with sound and controls, over the page. */
function Player({ product, startAt, onClose, children }: { product: ProductId; startAt: number; onClose: () => void; children?: ReactNode }) {
  const j = PRODUCT_JOURNEY[product];
  const v = useRef<HTMLVideoElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    close.current?.focus({ preventScroll: true });
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", esc);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", esc); };
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
      role="dialog" aria-modal aria-label={j.video.label} data-testid="video-player"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div initial={{ scale: 0.96, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.97, y: 8 }} transition={{ duration: 0.25 }} className="w-full max-w-5xl">
        <div className="mb-3 flex items-center justify-between text-white">
          <p className="font-display text-xl font-bold md:text-2xl">{j.title}</p>
          <button ref={close} onClick={onClose} className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60" data-testid="button-close-video">
            <X className="h-4 w-4" />Close
          </button>
        </div>
        <video
          ref={v}
          src={asset(j.video.full)}
          poster={asset(j.illustration)}
          autoPlay
          controls
          playsInline
          preload="auto"
          onLoadedMetadata={() => { if (v.current && startAt > 0 && startAt < v.current.duration) v.current.currentTime = startAt; }}
          // Start once; if the browser refuses sound, play muted rather than not at all.
          onCanPlay={() => { const el = v.current; if (!el || started.current) return; started.current = true; if (el.paused) el.play().catch(() => { el.muted = true; el.play().catch(() => {}); }); }}
          className="aspect-video w-full rounded-[2rem] bg-black object-contain shadow-2xl"
          data-testid="video-full"
        />
        {children && <div className="mt-4 flex justify-center">{children}</div>}
      </motion.div>
    </motion.div>
  );
}
