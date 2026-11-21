import { useEffect, useRef, useState } from "react";
import { Play, Square } from "lucide-react";

const canHover = () => typeof window !== "undefined" && window.matchMedia?.("(hover: hover) and (pointer: fine)").matches;

/**
 * The picture on a homepage journey card, with that journey's short ad laid over it.
 * - Mouse: plays while the card is hovered (`active`) and resets to the picture when the pointer leaves.
 *   Clicking the card still opens the journey as before.
 * - Touch: tapping the picture plays the ad in place (the card link is not followed); tapping it again,
 *   or anywhere else, stops it. Tapping the title or the button opens the journey as before.
 * - Keyboard: focusing the card plays it.
 * The picture keeps its exact size and place, so the card layout does not change; the ad fades in over it.
 */
export function JourneyVideo({ img, video, label, active }: { img: string; video: string; label: string; active: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  const v = useRef<HTMLVideoElement>(null);
  const [tapped, setTapped] = useState(false);
  const [showing, setShowing] = useState(false);
  const [touch, setTouch] = useState(false);
  const playing = active || tapped;

  // On mouse devices, buffer the ad shortly after load so the first hover starts at once.
  useEffect(() => {
    setTouch(!canHover());
    if (!canHover()) return;
    const t = window.setTimeout(() => { const el = v.current; if (el && el.preload !== "auto") { el.preload = "auto"; el.load(); } }, 1200);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    const el = v.current;
    if (!el) return;
    if (playing) {
      el.play().catch(() => setShowing(false));
    } else {
      el.pause();
      el.currentTime = 0;
      setShowing(false);
    }
  }, [playing]);

  // Touch: a tap anywhere outside the picture stops the ad (so only one plays at a time).
  useEffect(() => {
    if (!tapped) return;
    const off = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setTapped(false); };
    document.addEventListener("pointerdown", off);
    return () => document.removeEventListener("pointerdown", off);
  }, [tapped]);

  const pointer = useRef("mouse");
  const onClick = (e: React.MouseEvent) => {
    if (pointer.current !== "touch" && pointer.current !== "pen") return;   // mouse: let the card link work
    e.preventDefault();
    e.stopPropagation();
    setTapped((t) => !t);
  };

  return (
    <div ref={box} className="relative" onPointerDown={(e) => { pointer.current = e.pointerType; }} onClick={onClick}
      data-testid={`journey-video-${label}`} data-playing={showing ? "true" : "false"}>
      <img src={img} alt="" className={`h-56 w-auto object-contain transition duration-500 group-hover:scale-105 ${showing ? "opacity-0" : "opacity-100"}`} />
      <div className="pointer-events-none absolute left-1/2 top-1/2 aspect-video w-[min(398px,calc(100vw-7rem))] -translate-x-1/2 -translate-y-1/2">
        <video
          ref={v}
          src={video}
          muted
          loop
          playsInline
          preload="metadata"
          aria-hidden
          tabIndex={-1}
          onPlaying={() => setShowing(true)}
          className={`h-full w-full rounded-2xl object-cover shadow-[0_20px_40px_-24px_rgba(120,60,30,.45)] transition-opacity duration-300 ${showing ? "opacity-100" : "opacity-0"}`}
        />
      </div>
      {touch && (
        <span className="pointer-events-none absolute bottom-1 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full bg-background/90 px-3 py-1 text-xs font-semibold text-foreground shadow-sm">
          {tapped ? <Square className="h-3 w-3 fill-primary text-primary" /> : <Play className="h-3.5 w-3.5 fill-primary text-primary" />}
          {tapped ? "Tap to stop" : "Tap to play"}
        </span>
      )}
    </div>
  );
}
