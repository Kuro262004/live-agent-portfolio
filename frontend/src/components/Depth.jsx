import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { useRichMode } from "../lib/useRichMode";

/**
 * Drifts its content slightly against the scroll (rich mode only) so panels sit at different depths.
 * Level 1 for most cards, 2 for the deliverable and the PR card. Never wrap text read line by line in a long block.
 */
export default function Depth({ level = 1, className, children }) {
  const ref = useRef(null);
  const rich = useRichMode();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [level * 24, level * -24]);
  return (
    <motion.div ref={ref} style={rich ? { y } : undefined} className={className} data-depth={level}>
      {children}
    </motion.div>
  );
}
