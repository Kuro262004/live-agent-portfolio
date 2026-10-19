import { motion, useMotionValue, useSpring } from "framer-motion";
import { hasFinePointer } from "../lib/motion";

/** Leans its child up to 6px toward the cursor and springs back. Desktop pointers only; otherwise a plain wrapper. */
export default function Magnetic({ children, className = "" }) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 300, damping: 20 });
  const sy = useSpring(y, { stiffness: 300, damping: 20 });
  const enabled = hasFinePointer() && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (!enabled) return <span className={`inline-flex ${className}`}>{children}</span>;

  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const clamp = (v) => Math.max(-6, Math.min(6, v));
    x.set(clamp((e.clientX - (r.left + r.width / 2)) / 6));
    y.set(clamp((e.clientY - (r.top + r.height / 2)) / 6));
  };
  const onLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.span className={`inline-flex ${className}`} style={{ x: sx, y: sy }} onPointerMove={onMove} onPointerLeave={onLeave}>
      {children}
    </motion.span>
  );
}
