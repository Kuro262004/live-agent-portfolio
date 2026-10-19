import { useEffect, useRef } from "react";
import { STATION_SECTIONS } from "./stations";

/**
 * A ref holding 0..1 along the camera path, driven by where the real sections are on the page, so the camera reaches
 * each station as its section arrives (whatever the sections' heights). Read in useFrame; never re-renders.
 */
export function useWorldProgress() {
  const progress = useRef(0);
  useEffect(() => {
    const n = STATION_SECTIONS.length - 1;
    const update = () => {
      const tops = STATION_SECTIONS.map((id, i) => {
        if (i === 0) return 0;
        const el = document.getElementById(id);
        return el ? el.getBoundingClientRect().top + window.scrollY - window.innerHeight * 0.3 : Infinity;
      });
      const y = window.scrollY;
      let i = 0;
      while (i < n - 1 && y >= tops[i + 1]) i++;
      const span = tops[i + 1] - tops[i];
      const f = Number.isFinite(span) && span > 0 ? Math.min(1, Math.max(0, (y - tops[i]) / span)) : 0;
      progress.current = (i + f) / n;
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    // sections above can change height after load (fonts, data), which moves the stations
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    ro?.observe(document.body);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      ro?.disconnect();
    };
  }, []);
  return progress;
}
