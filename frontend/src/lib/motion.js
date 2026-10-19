import { useEffect, useState } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

/** True when the visitor asked for less motion. A browser without matchMedia is treated the same way. */
export const prefersReducedMotion = () => typeof window === "undefined" || !window.matchMedia || window.matchMedia(QUERY).matches;

export function useReducedMotionPref() {
  const [reduced, setReduced] = useState(prefersReducedMotion);
  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const mq = window.matchMedia(QUERY);
    const on = () => setReduced(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
}

/** Fine pointer with hover: the only place cursor effects (magnetic buttons, spotlights) make sense. */
export const hasFinePointer = () =>
  typeof window !== "undefined" && !!window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine)").matches;

/** True only while the element is on screen and the tab is visible, so looping effects can pause themselves. */
export function useOnScreen(ref) {
  const [on, setOn] = useState(true);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return undefined;
    let inView = true;
    const update = () => setOn(inView && !document.hidden);
    const io = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      update();
    });
    io.observe(el);
    document.addEventListener("visibilitychange", update);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", update);
    };
  }, [ref]);
  return on;
}

/**
 * Scroll an element into view. Short hops glide; a long jump (more than about a screen and a half away) is instant,
 * because a long smooth scroll sweeps through content that hasn't painted yet and shows a blank screen.
 */
export function scrollToEl(el, block = "start") {
  if (!el) return;
  const far = Math.abs(el.getBoundingClientRect().top) > window.innerHeight * 1.5;
  el.scrollIntoView({ behavior: far || prefersReducedMotion() ? "auto" : "smooth", block });
}

/** Jump to a section by id and keep the URL hash in step. */
export function jumpTo(id) {
  const el = document.getElementById(id);
  if (!el) return;
  scrollToEl(el, "start");
  try {
    history.replaceState(null, "", `#${id}`);
  } catch {
    /* some embedded contexts block this: the scroll still happened */
  }
}

/** Cursor spotlight: card CSS reads --x / --y. */
export function spotlight(e) {
  const el = e.currentTarget;
  const r = el.getBoundingClientRect();
  el.style.setProperty("--x", `${e.clientX - r.left}px`);
  el.style.setProperty("--y", `${e.clientY - r.top}px`);
}
