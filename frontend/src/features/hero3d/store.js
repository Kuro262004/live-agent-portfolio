import { create } from "zustand";

/** Where the hero camera is heading: null drifts with the cursor, [x, y, z] flies in to that node. */
export const useHero3D = create((set) => ({
  cameraTarget: null,
  flyTo: (pos) => set({ cameraTarget: pos }),
  reset: () => set({ cameraTarget: null }),
}));

/** Node positions, shared with the call button so it can fly to the researcher before the panel opens. */
export const NODES = {
  planner: { pos: [-2.6, 0.2, 0.0], color: "planner" },
  researcher: { pos: [-0.6, 1.2, -0.8], color: "researcher" },
  brain: { pos: [-0.6, -1.3, -1.6], color: "brain" },
  builder: { pos: [1.4, 0.1, 0.4], color: "builder" },
  reviewer: { pos: [3.0, 0.6, -0.6], color: "reviewer" },
};
