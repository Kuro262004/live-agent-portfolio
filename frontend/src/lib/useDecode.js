import { useEffect, useState } from "react";
import { prefersReducedMotion } from "./motion";

const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#$%&*<>/";

/**
 * Text that resolves from random glyphs into `text`. Before `start` (or with reduced motion) it is simply the real text,
 * so nothing is ever blank or unreadable. Pair it with an aria-label so screen readers never hear the glyphs.
 */
export function useDecode(text, { duration = 700, start = true } = {}) {
  const [out, setOut] = useState(text);

  useEffect(() => {
    if (!start || prefersReducedMotion()) {
      setOut(text);
      return undefined;
    }
    let raf;
    const t0 = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / duration);
      const solved = Math.floor(p * text.length);
      setOut(
        text
          .split("")
          .map((ch, i) => (i < solved || ch === " " ? ch : GLYPHS[(Math.random() * GLYPHS.length) | 0]))
          .join(""),
      );
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [text, duration, start]);

  return out;
}
