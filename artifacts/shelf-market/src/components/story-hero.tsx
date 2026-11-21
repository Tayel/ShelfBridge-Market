import { useEffect, useRef, useState } from "react";
import { ChevronDown, Play, X } from "lucide-react";

const base = import.meta.env.BASE_URL;
const LOOP = `${base}videos/inraf-story-loop.mp4`;
const STORY = `${base}videos/inraf-story.mp4`;
const POSTER = `${base}videos/inraf-story-poster.jpg`;

/**
 * Full-width film at the top of the homepage. A silent copy plays on loop as soon as the page opens; pressing
 * it plays the InRaf story from the start with sound and controls. Scrolling down leads to the rest of the page.
 */
export function StoryHero({ nextId }: { nextId: string }) {
  const section = useRef<HTMLElement>(null);
  const loop = useRef<HTMLVideoElement>(null);
  const story = useRef<HTMLVideoElement>(null);
  const [watching, setWatching] = useState(false);
  const [still, setStill] = useState(false);

  // Respect reduced motion: show the still frame instead of the moving loop.
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const set = () => setStill(mq.matches);
    set(); mq.addEventListener("change", set);
    return () => mq.removeEventListener("change", set);
  }, []);

  // Only play while the film is on screen.
  useEffect(() => {
    const el = section.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      const v = watching ? story.current : loop.current;
      if (!v) return;
      if (e.isIntersecting) { if (!watching && !still) void v.play().catch(() => {}); }
      else v.pause();
    }, { threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
  }, [watching, still]);

  useEffect(() => {
    if (!watching) { if (!still) void loop.current?.play().catch(() => {}); return; }
    loop.current?.pause();
    const v = story.current;
    if (v) { v.currentTime = 0; v.muted = false; void v.play().catch(() => { v.muted = true; void v.play().catch(() => {}); }); }
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setWatching(false); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [watching, still]);

  useEffect(() => { if (still) loop.current?.pause(); }, [still]);

  const scrollOn = () => document.getElementById(nextId)?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <section ref={section} aria-label="The InRaf story"
      className="relative -mt-6 ml-[calc(50%-50vw)] h-[calc(100svh-57px)] min-h-[420px] w-screen overflow-hidden bg-black">
      <video ref={loop} src={LOOP} poster={POSTER} muted loop playsInline autoPlay={!still} preload="auto" aria-hidden="true"
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${watching ? "opacity-0" : "opacity-100"}`} />

      {watching ? (
        <>
          <video ref={story} src={STORY} poster={POSTER} controls playsInline preload="auto" onEnded={() => setWatching(false)}
            className="absolute inset-0 h-full w-full bg-black object-contain" data-testid="video-story" />
          <button type="button" onClick={() => setWatching(false)} aria-label="Close the story"
            className="absolute right-4 top-4 grid h-11 w-11 place-items-center rounded-full bg-black/55 text-white backdrop-blur transition hover:bg-black/75 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/40"
            data-testid="button-story-close">
            <X className="h-5 w-5" />
          </button>
        </>
      ) : (
        <button type="button" onClick={() => setWatching(true)} aria-label="Watch the InRaf story, one minute, with sound"
          className="group absolute inset-0 flex cursor-pointer flex-col items-center justify-end bg-gradient-to-t from-black/70 via-black/10 to-black/20 pb-24 text-white focus-visible:outline-none"
          data-testid="button-story-play">
          <span className="grid h-20 w-20 place-items-center rounded-full bg-primary text-primary-foreground shadow-[0_20px_50px_-15px_rgba(0,0,0,.6)] transition duration-300 group-hover:scale-110 group-focus-visible:ring-4 group-focus-visible:ring-white/50 md:h-24 md:w-24">
            <Play className="ml-1 h-8 w-8 fill-current md:h-10 md:w-10" />
          </span>
          <span className="font-display mt-5 text-3xl font-bold drop-shadow md:text-5xl">The InRaf story</span>
          <span className="mt-2 text-sm text-white/80 md:text-base">Press to watch · 1 minute, with sound</span>
        </button>
      )}

      {!watching && (
        <button type="button" onClick={scrollOn} aria-label="Scroll to the rest of the page"
          className="absolute bottom-5 left-1/2 flex -translate-x-1/2 flex-col items-center text-xs text-white/80 transition hover:text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/40 rounded-full px-3 py-1"
          data-testid="button-story-scroll">
          Scroll to explore
          <ChevronDown className="mt-1 h-5 w-5 animate-bounce motion-reduce:animate-none" />
        </button>
      )}
    </section>
  );
}
