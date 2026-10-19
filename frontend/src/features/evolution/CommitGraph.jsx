import { AGENT_HEX, NEUTRAL } from "../../lib/agents";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { useReducedMotionPref } from "../../lib/motion";

/** A horizontal git-style strip: the main line draws itself, then a dot springs in for each changelog entry. */
export function CommitGraph({ commits }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });
  const reduced = useReducedMotionPref();
  const show = reduced || inView;
  const gap = 56;
  const width = Math.max(1, commits.length - 1) * gap + 24;

  return (
    <svg ref={ref} viewBox={`0 0 ${width} 40`} className="mb-4 h-10 w-full max-w-md text-researcher" aria-hidden="true">
      <motion.line
        x1="12" y1="20" x2={width - 12} y2="20"
        stroke="currentColor" strokeOpacity=".3" strokeWidth="2"
        initial={{ pathLength: reduced ? 1 : 0 }}
        animate={{ pathLength: show ? 1 : 0 }}
        transition={{ duration: 1.2, ease: "easeInOut" }}
      />
      {commits.map((c, i) => (
        <motion.circle
          key={c.id}
          cx={12 + i * gap}
          cy="20"
          r="5"
          fill={c.type === "release" ? AGENT_HEX.researcher : NEUTRAL.mute}
          initial={{ scale: reduced ? 1 : 0 }}
          animate={{ scale: show ? 1 : 0 }}
          transition={{ delay: reduced ? 0 : 0.2 + i * 0.12, type: "spring", stiffness: 400, damping: 18 }}
          style={{ transformOrigin: `${12 + i * gap}px 20px` }}
        />
      ))}
    </svg>
  );
}
