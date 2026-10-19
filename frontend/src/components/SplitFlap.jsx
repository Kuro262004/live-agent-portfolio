import { useEffect, useState } from "react";
import { prefersReducedMotion } from "../lib/motion";

const CHARS = " ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-·&.,'";

/** Text that flips into place, letter by letter, like a departure board. The real text is always in aria-label. */
export default function SplitFlap({ text, start, delay = 0, label = text }) {
  const target = text.toUpperCase();
  const reduce = prefersReducedMotion();
  const [shown, setShown] = useState(reduce ? target : " ".repeat(target.length));

  useEffect(() => {
    if (reduce || !start) {
      if (reduce) setShown(target);
      return undefined;
    }
    let frame = 0;
    let timer;
    const tick = () => {
      frame += 1;
      setShown(
        target
          .split("")
          .map((ch, i) => (frame >= 4 + i * 1.5 || ch === " " ? ch : CHARS[(frame + i * 7) % CHARS.length]))
          .join(""),
      );
      if (frame < 4 + target.length * 1.5) timer = setTimeout(tick, 45);
    };
    const first = setTimeout(tick, delay);
    return () => {
      clearTimeout(first);
      clearTimeout(timer);
    };
  }, [start, target, delay, reduce]);

  return (
    <span role="img" aria-label={label} className="whitespace-nowrap font-mono tracking-[0.12em] max-sm:tracking-[0.04em]">
      {shown.split("").map((c, i) => (
        <span key={i} aria-hidden="true" className="flap mx-[1px] inline-block min-w-[0.8em] rounded-[3px] bg-raised text-center max-sm:min-w-[0.68em]">
          {c === " " ? "\u00A0" : c}
        </span>
      ))}
    </span>
  );
}
