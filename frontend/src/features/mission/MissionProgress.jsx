import AgentGlyph from "../../components/AgentGlyph";
import { AGENT_HEX, NEUTRAL } from "../../lib/agents";
import { deriveGraph } from "./state";

const SEGMENTS = [
  ["planner", "Planner", AGENT_HEX.planner],
  ["researcher", "Researcher", AGENT_HEX.researcher],
  ["builder", "Builder", AGENT_HEX.builder],
  ["reviewer", "Reviewer", AGENT_HEX.reviewer],
];

/** Four segments: finished ones fill solid, the active one shimmers. */
export default function MissionProgress({ events }) {
  const { agents } = deriveGraph(events);
  const done = SEGMENTS.filter(([id]) => agents[id].status === "done").length;
  return (
    <div role="progressbar" aria-label="Mission progress" aria-valuemin={0} aria-valuemax={4} aria-valuenow={done} className="pt-1">
      <div className="grid grid-cols-4 gap-1.5">
        {SEGMENTS.map(([id, label, color]) => {
          const status = agents[id].status;
          return (
            <div key={id} data-segment={id} data-status={status}>
              <div
                className={`h-1.5 rounded-full ${status === "active" ? "seg-active" : ""}`}
                style={{ "--seg": status === "idle" ? NEUTRAL.line : color, background: status === "active" ? undefined : status === "idle" ? NEUTRAL.line : color }}
              />
              <p className="mt-1 hidden items-center gap-1 font-mono text-[9px] uppercase tracking-wider text-mute sm:flex"><AgentGlyph id={id} size={9} />{label}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
