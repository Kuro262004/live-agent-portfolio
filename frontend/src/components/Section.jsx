import { motion, useInView, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { useReducedMotionPref } from "../lib/motion";
import { useDecode } from "../lib/useDecode";
import { useApp } from "../stores/app";

/** Kinetic type: the heading's variable weight grows from light to bold as it rises into view. */
function KineticTitle({ title, heading }) {
  const ref = useRef(null);
  const reduced = useReducedMotionPref();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 95%", "start 55%"] });
  const settings = useTransform(scrollYProgress, [0, 1], [300, 700], { clamp: true });
  const fontVariationSettings = useTransform(settings, (w) => `"wght" ${Math.round(w)}, "opsz" 96`);
  return (
    <motion.h2
      ref={ref}
      aria-label={title}
      style={reduced ? undefined : { fontVariationSettings }}
      className="mb-6 mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl"
    >
      <span aria-hidden="true">{heading}</span>
    </motion.h2>
  );
}

/**
 * Sections are always rendered visible: a jump from the nav or the AI must never land on an unrevealed, blank section.
 * Only the heading text decodes, once, the first time the section scrolls into view.
 * `agent` names the agent that owns the section; the reticle cursor takes its colour.
 */
export default function Section({ id, kicker, title, meta, agent, children }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -15% 0px" });
  const bootDone = useApp((s) => s.bootDone);
  const heading = useDecode(title, { duration: 600, start: inView && bootDone });
  return (
    <section ref={ref} id={id} data-agent={agent} className="scroll-mt-20 py-14">
      <div className="flex items-center gap-3 font-mono text-xs uppercase tracking-[0.2em]">
        <span className="route-sign">{kicker}</span>
        <span aria-hidden="true" className="route-dash flex-1" />
        {meta && <span className="text-mute">{meta}</span>}
      </div>
      <KineticTitle title={title} heading={heading} />
      {children}
    </section>
  );
}
