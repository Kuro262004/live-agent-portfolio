import { useRef } from "react";
import { jumpTo } from "../lib/motion";
import { useApp } from "../stores/app";
import { AGENT_HEX } from "../lib/agents";
import { prefersReducedMotion, useOnScreen } from "../lib/motion";
import AgentGlyph from "./AgentGlyph";

// A small, non-interactive picture of Mission Control: the same four agents and shared brain, idling.
const NODES = {
  planner: { x: 60, y: 120, label: "Planner" },
  researcher: { x: 190, y: 50, label: "Researcher" },
  brain: { x: 190, y: 195, label: "Shared brain" },
  builder: { x: 320, y: 120, label: "Builder" },
  reviewer: { x: 440, y: 120, label: "Reviewer" },
};
const EDGES = [
  ["planner", "researcher"],
  ["brain", "researcher"],
  ["researcher", "builder"],
  ["builder", "reviewer"],
  ["planner", "brain"],
];
const PACKET_PATH = ["planner", "researcher", "builder", "reviewer"];

const route = (ids) => ids.map((id, i) => `${i ? "L" : "M"}${NODES[id].x} ${NODES[id].y}`).join(" ");

/** Desktop-only hero picture. Breathes while on screen; stands still for reduced motion. */
export default function HeroGraph() {
  const ref = useRef(null);
  const visible = useOnScreen(ref);
  const still = prefersReducedMotion() || !visible;
  const requestRecorded = useApp((s) => s.requestRecorded);
  const open = () => {
    requestRecorded();
    jumpTo("mission-live");
  };
  return (
    <button
      ref={ref}
      type="button"
      onClick={open}
      aria-label="Watch a recorded run in Mission Control"
      className="hud glass group relative block w-full rounded-[14px] p-4 text-left transition hover:border-researcher/60"
    >
      <div aria-hidden="true" className="mb-2 flex items-center justify-between font-mono text-[10px] uppercase tracking-widest text-mute">
        <span>mission control · idle</span>
        <span className="flex items-center gap-1.5 text-reviewer">
          <span className="h-1.5 w-1.5 rounded-full bg-reviewer" /> standing by
        </span>
      </div>
      <svg viewBox="0 0 500 250" className="w-full" aria-hidden="true">
        {EDGES.map(([a, b]) => (
          <line key={a + b} x1={NODES[a].x} y1={NODES[a].y} x2={NODES[b].x} y2={NODES[b].y} className="stroke-line" strokeWidth="1.5" strokeDasharray={a === "brain" || b === "brain" ? "4 4" : undefined} />
        ))}
        {!still && (
          <circle r="4" className="fill-researcher" opacity="0.9">
            <animateMotion dur="6s" repeatCount="indefinite" path={route(PACKET_PATH)} keyPoints="0;1" keyTimes="0;1" calcMode="linear" />
            <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.08;0.92;1" dur="6s" repeatCount="indefinite" />
          </circle>
        )}
        {Object.entries(NODES).map(([id, n], i) => (
          <g key={id} transform={`translate(${n.x} ${n.y})`} style={{ color: AGENT_HEX[id] }}>
            <circle r="26" stroke="currentColor" strokeOpacity="0.7" strokeWidth="1.5" className={`fill-panel ${still ? "" : "node-idle"}`} style={still ? undefined : { animationDelay: `${i * 0.5}s`, transformOrigin: "center", transformBox: "fill-box" }} />
            <circle r="34" fill="none" stroke="currentColor" strokeOpacity="0.12" />
            <text y="46" textAnchor="middle" fontSize="11" fontFamily="JetBrains Mono, monospace" fill="currentColor">{n.label}</text>
          </g>
        ))}
      </svg>
      <div aria-hidden="true" className="mt-1 flex items-center gap-3 font-mono text-[10px] text-mute">
        {["planner", "researcher", "builder", "reviewer"].map((id) => (
          <span key={id} className="flex items-center gap-1"><AgentGlyph id={id} size={10} />{id}</span>
        ))}
      </div>
      <p aria-hidden="true" className="mt-3 font-mono text-[11px] text-researcher opacity-80 transition group-hover:opacity-100">▶ Watch a recorded run ↓</p>
    </button>
  );
}
