/**
 * What the AI is doing, for the 3D world to read every frame. Plain mutable objects on purpose (like audioLevels):
 * pushing these through React state 60 times a second would re-render the page.
 */

/** Which network edge lights up when the AI uses a tool, and the caption the call panel shows meanwhile. */
const TOOLS = {
  search_portfolio: { edge: ["brain", "researcher"], caption: "searching the portfolio…" },
  open_section: { edge: ["researcher", "planner"], caption: "opening a section…" },
  start_mission: { edge: ["researcher", "builder"], caption: "handing the task to the agents…" },
  book_meeting: { edge: ["researcher", "reviewer"], caption: "finding the booking link…" },
  narrate_mission: { edge: ["builder", "reviewer"], caption: "following the mission…" },
};

/** edge "a>b" → time (performance.now) until which it glows */
const edgePulses = new Map();

const key = (a, b) => (a < b ? `${a}>${b}` : `${b}>${a}`);

/** Light the edge for a tool for `ms`, and return the caption to show (or null for a tool with no edge). */
export function signalTool(name, ms = 1200) {
  const tool = TOOLS[name];
  if (!tool) return null;
  edgePulses.set(key(...tool.edge), performance.now() + ms);
  return tool.caption;
}

/** 0..1 glow of an edge right now, fading out over the last 400 ms of its pulse. */
export function edgeGlow(a, b, now = performance.now()) {
  const until = edgePulses.get(key(a, b));
  if (!until || until <= now) return 0;
  return Math.min(1, (until - now) / 400);
}
