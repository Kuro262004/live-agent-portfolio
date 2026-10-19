/**
 * One colour per agent, as CSS colours that follow the theme (the tokens live in index.css).
 * Use these for inline styles and SVG; use the Tailwind classes (text-planner, bg-builder, ...) elsewhere.
 */
export const AGENT_HEX = {
  planner: "rgb(var(--planner))",
  researcher: "rgb(var(--researcher))",
  builder: "rgb(var(--builder))",
  reviewer: "rgb(var(--reviewer))",
  brain: "rgb(var(--brain))",
};

/** Neutral colours that follow the theme. */
export const NEUTRAL = {
  line: "rgb(var(--line))",
  line2: "rgb(var(--line-2))",
  mute: "rgb(var(--mute))",
  panel: "rgb(var(--panel))",
  alert: "rgb(var(--alert))",
};

/** A see-through version of a theme colour, e.g. tint(AGENT_HEX.planner, 40). */
export const tint = (color, percent) => `color-mix(in srgb, ${color} ${percent}%, transparent)`;
