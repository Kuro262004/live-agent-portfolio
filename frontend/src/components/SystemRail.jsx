import { AGENT_HEX, NEUTRAL } from "../lib/agents";
import { useActiveSection } from "../lib/useActiveSection";
import { useApp } from "../stores/app";
import AgentGlyph from "./AgentGlyph";

const SECTIONS = ["mission", "about", "skills", "experience", "projects", "bestiary", "evolution", "hire", "contact"];
const AGENTS = ["planner", "researcher", "builder", "reviewer"];

/**
 * Desktop-wide screens only (xl): a slim column on the left edge showing each agent's real state and where the
 * visitor is on the page, so the whole site reads as one running system. The section number opens the palette.
 */
export default function SystemRail() {
  const active = useActiveSection(SECTIONS);
  const status = useApp((s) => s.agentStatus);
  const setPalette = useApp((s) => s.setPalette);
  const hidden = useApp((s) => s.carouselPinned);
  const index = SECTIONS.indexOf(active);
  const shown = index + 1;

  return (
    <aside
      aria-label="System status"
      inert={hidden}
      className={`glass fixed left-4 top-1/2 z-30 hidden w-11 -translate-y-1/2 flex-col items-center gap-3 rounded-2xl py-3 font-mono text-[11px] transition-opacity duration-300 xl:flex ${hidden ? "pointer-events-none opacity-0" : ""}`}
    >
      {AGENTS.map((id) => {
        const s = status[id] ?? "idle";
        return (
          <span key={id} title={`${id}: ${s}`} className={`flex ${s === "thinking" ? "animate-pulse" : s === "idle" ? "opacity-60" : ""}`} style={{ color: AGENT_HEX[id] }}>
            <AgentGlyph id={id} size={13} />
            <span className="sr-only">{`${id}: ${s}`}</span>
          </span>
        );
      })}
      <span aria-hidden="true" className="h-px w-5 bg-rule/10" />
      <button type="button" onClick={() => setPalette(true)} title="Open the command palette" className="leading-4 text-ink hover:text-researcher">
        {shown ? String(shown).padStart(2, "0") : "--"}
        <span className="block text-mute">/{String(SECTIONS.length).padStart(2, "0")}</span>
        <span className="sr-only">{shown ? `: section ${shown} of ${SECTIONS.length}, ${active}` : ""}. Open the command palette</span>
      </button>
      <div aria-hidden="true" className="h-24 w-1 overflow-hidden rounded-full" style={{ background: NEUTRAL.line }}>
        <div className="w-1 rounded-full bg-researcher transition-[height] duration-500" style={{ height: `${(shown / SECTIONS.length) * 100}%` }} />
      </div>
    </aside>
  );
}
