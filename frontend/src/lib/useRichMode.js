import { useState } from "react";
import { create } from "zustand";
import { useReducedMotionPref } from "./motion";

const KEY = "graphics";
const MODES = ["auto", "full", "lite"];

function storedMode() {
  try {
    const v = localStorage.getItem(KEY);
    return MODES.includes(v) ? v : "auto";
  } catch {
    return "auto";
  }
}

/**
 * The visitor's graphics choice: "auto" (decide from the device), "full" or "lite". Set from the command palette
 * or the footer. `slow` is set for this visit only when the 3D scene can't hold a usable frame rate.
 */
export const useGraphics = create((set) => ({
  mode: storedMode(),
  slow: false,
  setMode: (mode) => {
    try {
      localStorage.setItem(KEY, mode);
    } catch {
      // not remembered; the choice still applies for this visit
    }
    set({ mode, slow: false });
  },
  markSlow: () => set({ slow: true }),
}));

let cachedCapable;

/**
 * Desktop-class device with WebGL2: the only place 3D, shaders and scroll scenes run by default. Checked once per
 * page load; the test context is released straight away, because browsers keep only ~16 WebGL contexts alive and
 * drop the oldest (which would blank the hero or the backdrop).
 */
export function deviceIsCapable() {
  if (cachedCapable !== undefined) return cachedCapable;
  if (typeof window === "undefined" || !window.matchMedia) return (cachedCapable = false);
  const desktop = window.matchMedia("(pointer: fine) and (min-width: 1024px)").matches;
  const cores = navigator.hardwareConcurrency || 4;
  const memory = navigator.deviceMemory || 4;
  let webgl2 = false;
  try {
    const gl = document.createElement("canvas").getContext("webgl2");
    webgl2 = !!gl;
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    webgl2 = false;
  }
  return (cachedCapable = desktop && cores >= 4 && memory >= 4 && webgl2);
}

/** Pure decision, so it can be tested: reduced motion always wins, then the visitor's choice, then the device. */
export function decideRich({ reduced, mode, slow, capable }) {
  if (reduced || mode === "lite") return false;
  if (mode === "full") return true;
  return capable && !slow;
}

/** True when the rich (3D, shader, scroll-scene) version should render; false means the 2D site. */
export function useRichMode() {
  const reduced = useReducedMotionPref();
  const mode = useGraphics((s) => s.mode);
  const slow = useGraphics((s) => s.slow);
  const [capable] = useState(deviceIsCapable); // decided on the first render, so the page never flashes 2D → 3D
  return decideRich({ reduced, mode, slow, capable });
}
