import { NODES } from "../hero3d/store";

/** The camera at the top of the page; placement maths assumes exactly this view. */
export const HOME = { camera: [0, 0, 8], look: [0, 0, 0], fov: 45 };

/** Where the project panels float, relative to the network's centre: far off to the side, so only the projects
 * station (which turns to face them) ever has them in frame. */
export const PANELS_OFFSET = [10, -3, -6];

/** A node's position in the world, given where the network is placed. */
export function nodeWorld(id, p) {
  const [x, y, z] = NODES[id].pos;
  return [p.x + x * p.scale, p.y + y * p.scale, z * p.scale];
}

/**
 * Camera stops along the page, each tied to a real section: a wide view at the top, close on the graph for
 * Mission Control, past the shared brain for the skills, out to the project panels, and a calm wide shot at the end.
 */
export function stations(p) {
  const brain = nodeWorld("brain", p);
  const panels = [p.x + PANELS_OFFSET[0], p.y + PANELS_OFFSET[1], PANELS_OFFSET[2]];
  return [
    { section: "top", camera: HOME.camera, look: HOME.look },
    { section: "mission", camera: [p.x + 0.4, p.y + 0.3, 4.4], look: [p.x, p.y, -0.6] },
    { section: "skills", camera: [brain[0] - 1.4, brain[1] + 0.2, brain[2] + 2.8], look: brain },
    { section: "projects", camera: [panels[0] - 2.6, panels[1] + 0.5, panels[2] + 5.2], look: panels },
    { section: "contact", camera: [0, 1.4, 11], look: [p.x * 0.5, 0, 0] },
  ];
}

export const STATION_SECTIONS = ["top", "mission", "skills", "projects", "contact"];
