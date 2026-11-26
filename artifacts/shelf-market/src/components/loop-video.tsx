import { useEffect, useRef } from "react";

const base = import.meta.env.BASE_URL;

/**
 * A silent video that loops on its own, with no still picture in front of it. It pauses while scrolled out of view
 * and stays still for people who ask for reduced motion.
 */
export function LoopVideo({ src, className = "", label }: { src: string; className?: string; label?: string }) {
  const v = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const el = v.current;
    if (!el) return;
    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const io = new IntersectionObserver(([e]) => {
      if (still) return;
      if (e.isIntersecting) el.play().catch(() => { /* autoplay refused: stays on its first frame */ });
      else el.pause();
    }, { threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <video ref={v} src={`${base}${src}`} muted loop playsInline autoPlay preload="auto" aria-label={label} aria-hidden={label ? undefined : true}
      className={`h-full w-full object-cover ${className}`} data-testid="loop-video" />
  );
}
