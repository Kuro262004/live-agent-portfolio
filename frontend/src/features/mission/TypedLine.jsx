import { useEffect, useState } from "react";
import { prefersReducedMotion } from "../../lib/motion";

/** Types `text` at ~2 ms per character. Older lines pass animate=false and render instantly, so a long log never lags. */
export default function TypedLine({ text, animate, cursor }) {
  const [n, setN] = useState(animate ? 0 : text.length);

  useEffect(() => {
    if (!animate || prefersReducedMotion()) {
      setN(text.length);
      return undefined;
    }
    const t0 = performance.now();
    let raf;
    const tick = (now) => {
      const k = Math.min(text.length, Math.floor((now - t0) / 2));
      setN(k);
      if (k < text.length) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [text, animate]);

  return (
    <>
      <span aria-hidden="true">{text.slice(0, n)}</span>
      <span className="sr-only">{text}</span>
      {cursor && (
        <span aria-hidden="true" className="cursor-block ml-0.5 text-researcher">
          ▍
        </span>
      )}
    </>
  );
}
