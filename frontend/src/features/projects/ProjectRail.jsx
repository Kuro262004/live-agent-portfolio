import { motion, useMotionValue, useMotionValueEvent, useScroll, useSpring, useTransform } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { jumpTo } from "../../lib/motion";
import { useApp } from "../../stores/app";

// the page width without the scrollbar (100vw includes it, which made the page scroll sideways by a few pixels)
const pageWidth = () => document.documentElement.clientWidth;

/** A card that leans a few degrees toward the cursor. */
function TiltCard({ children, onFocus }) {
  const rx = useSpring(useMotionValue(0), { stiffness: 150, damping: 15 });
  const ry = useSpring(useMotionValue(0), { stiffness: 150, damping: 15 });
  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    ry.set(((e.clientX - r.left) / r.width - 0.5) * 10);
    rx.set(-((e.clientY - r.top) / r.height - 0.5) * 8);
  };
  return (
    <motion.div
      onPointerMove={onMove}
      onPointerLeave={() => {
        rx.set(0);
        ry.set(0);
      }}
      onFocus={onFocus}
      style={{ rotateX: rx, rotateY: ry, transformPerspective: 1000 }}
      className="w-[min(60vw,760px)] shrink-0"
      data-depth="2"
    >
      {children}
    </motion.div>
  );
}

/**
 * Rich mode only: while the visitor scrolls down, the projects slide sideways. Plain page scroll drives it
 * (nothing is hijacked) and the section is only as tall as the slide needs.
 */
export default function ProjectRail({ projects, renderCard, next }) {
  const ref = useRef(null);
  const viewport = useRef(null);
  const track = useRef(null);
  const distance = useRef(0); // how far the track has to travel so the last card ends fully in view
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const x = useTransform(scrollYProgress, (v) => -v * distance.current);
  const [vw, setVw] = useState(pageWidth);
  const pad = Math.max(16, (vw - 1152) / 2 + 16); // cards start and end in line with the 72rem content column

  useEffect(() => {
    const onResize = () => setVw(pageWidth());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  useEffect(() => {
    if (track.current && viewport.current) distance.current = Math.max(0, track.current.offsetWidth - viewport.current.clientWidth);
  }, [projects.length, vw]);

  // while pinned, the cards slide under the left edge, so the system rail steps aside
  const setPinned = useApp((s) => s.setCarouselPinned);
  useMotionValueEvent(scrollYProgress, "change", (v) => setPinned(v > 0 && v < 1));
  useEffect(() => () => setPinned(false), [setPinned]);

  // keyboard: tabbing to a card off to the side scrolls the page to the point where that card is in view
  const reveal = (i) => {
    if (viewport.current) viewport.current.scrollLeft = 0; // undo the browser's own sideways focus scroll
    const el = ref.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY;
    const span = el.offsetHeight - window.innerHeight;
    window.scrollTo({ top: top + (span * i) / Math.max(1, projects.length - 1), behavior: "auto" });
  };

  return (
    <div ref={ref} style={{ height: `${Math.max(projects.length, 2) * 80}vh` }} aria-label="Projects, sliding sideways as you scroll" role="region">
      {/* full-bleed: the cards slide across the whole window, starting and ending in line with the page content */}
      <div
        ref={viewport}
        style={{ width: vw, marginLeft: `calc(50% - ${vw / 2}px)` }}
        className="sticky top-14 flex h-[calc(100vh-3.5rem)] flex-col items-start gap-6 overflow-hidden pt-16"
      >
        <motion.div ref={track} style={{ x, paddingInline: pad }} className="flex w-max items-center gap-8">
          {projects.map((p, i) => (
            <TiltCard key={p.id} onFocus={() => reveal(i)}>
              {renderCard(p, i)}
            </TiltCard>
          ))}
        </motion.div>
        {next && (
          <a
            href={`#${next}`}
            onClick={(e) => {
              e.preventDefault();
              jumpTo(next);
            }}
            style={{ marginLeft: pad }}
            className="text-sm text-mute underline underline-offset-4 hover:text-ink"
          >
            Skip past the projects ↓
          </a>
        )}
      </div>
    </div>
  );
}
