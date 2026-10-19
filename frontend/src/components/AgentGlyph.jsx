import { AGENT_HEX, NEUTRAL } from "../lib/agents";

/** A small geometric avatar per agent, in the agent's colour. Decorative: the name is always written next to it. */
export default function AgentGlyph({ id, size = 14, className = "" }) {
  const c = AGENT_HEX[id] ?? NEUTRAL.mute;
  const shape = {
    planner: <path d="M8 1.5 14.5 8 8 14.5 1.5 8Z" />,
    researcher: (
      <>
        <circle cx="8" cy="8" r="6" />
        <circle cx="8" cy="8" r="1.6" fill="currentColor" stroke="none" />
      </>
    ),
    builder: <rect x="2.5" y="2.5" width="11" height="11" rx="1.5" />,
    reviewer: <path d="M8 1.8 14 13.5H2Z" />,
    brain: <path d="M4.6 2.5h6.8L14.5 8l-3.1 5.5H4.6L1.5 8Z" />,
  }[id];
  if (!shape) return null;
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true" style={{ color: c }} className={`shrink-0 ${className}`}>
      {shape}
    </svg>
  );
}
