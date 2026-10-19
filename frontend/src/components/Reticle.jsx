import { motion, useMotionValue, useSpring } from "framer-motion";
import { useEffect, useState } from "react";
import { AGENT_HEX } from "../lib/agents";

const TARGETS = "[data-reticle], button:not(:disabled), a[href], [role=button]";
const spring = { stiffness: 500, damping: 40 };

/**
 * Rich mode with a fine pointer only: a targeting outline that follows the cursor and locks onto buttons and links,
 * coloured by the agent that owns the section. It overlays the normal cursor and never replaces it.
 */
export default function Reticle() {
  const x = useSpring(useMotionValue(-100), spring);
  const y = useSpring(useMotionValue(-100), spring);
  const w = useSpring(useMotionValue(22), spring);
  const h = useSpring(useMotionValue(22), spring);
  const [agent, setAgent] = useState("researcher");
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    const move = (e) => {
      const el = e.target instanceof Element ? e.target.closest(TARGETS) : null;
      const section = e.target instanceof Element ? e.target.closest("[data-agent]") : null;
      setAgent(section?.dataset.agent ?? "researcher");
      if (el) {
        const r = el.getBoundingClientRect();
        x.set(r.left + r.width / 2);
        y.set(r.top + r.height / 2);
        w.set(r.width + 12);
        h.set(r.height + 12);
        setLocked(true);
      } else {
        x.set(e.clientX);
        y.set(e.clientY);
        w.set(22);
        h.set(22);
        setLocked(false);
      }
    };
    const hide = () => {
      x.set(-100);
      y.set(-100);
    };
    window.addEventListener("pointermove", move, { passive: true });
    document.documentElement.addEventListener("pointerleave", hide);
    return () => {
      window.removeEventListener("pointermove", move);
      document.documentElement.removeEventListener("pointerleave", hide);
    };
  }, [x, y, w, h]);

  return (
    <motion.div
      aria-hidden="true"
      className="pointer-events-none fixed left-0 top-0 z-[70] rounded-lg border transition-[border-color,opacity] duration-200"
      style={{ x, y, width: w, height: h, translateX: "-50%", translateY: "-50%", borderColor: AGENT_HEX[agent] ?? AGENT_HEX.researcher, opacity: locked ? 0.8 : 0.45 }}
    />
  );
}
