import { create } from "zustand";

/**
 * Shared state of the one 3D world (rich mode). Changes rarely, so plain Zustand state is fine here; anything that
 * changes every frame (voice level, tool pulses) lives in the mutable buses in lib/ instead.
 */
export const useWorld = create((set) => ({
  /** the canvas has drawn its first frame: the hero can drop its 2D stand-in */
  ready: false,
  /** WebGL failed: the 2D hero and the still backdrop take over */
  failed: false,
  /**
   * Where the agent network sits so it lines up with the hero's picture box when the page is at the top:
   * centre (x, y) on the z = 0 plane and a scale. Measured from the page on load and on resize.
   */
  placement: null,
  /** The particle name intro: idle → forming → scatter → done. The HTML name fades in on "scatter". */
  namePhase: "idle",
  setReady: () => set({ ready: true }),
  setFailed: () => set({ failed: true, namePhase: "done" }),
  setPlacement: (placement) => set({ placement }),
  setNamePhase: (namePhase) => set({ namePhase }),
}));
