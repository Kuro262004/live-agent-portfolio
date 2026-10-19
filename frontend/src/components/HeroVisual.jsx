import { jumpTo } from "../lib/motion";
import { useRichMode } from "../lib/useRichMode";
import { useWorld } from "../features/world/store";
import AgentGlyph from "./AgentGlyph";
import HeroGraph from "./HeroGraph";

/**
 * The hero picture. Rich mode: a window onto the 3D world behind the page, where the agent network is placed to fill
 * this box (#hero-visual is what the world measures), with the legend and a link to the recorded run as real HTML.
 * Until the world's first frame, and wherever 3D can't run, the 2D panel shows instead.
 */
export default function HeroVisual() {
  const rich = useRichMode();
  const ready = useWorld((s) => s.ready);
  const failed = useWorld((s) => s.failed);
  const world = rich && !failed;
  return (
    <div id="hero-visual" className={world ? "relative h-[420px]" : undefined}>
      {!world || !ready ? (
        <HeroGraph />
      ) : (
        <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-center justify-between gap-3 px-2">
          <div aria-hidden="true" className="flex items-center gap-3 font-mono text-[10px] text-mute">
            {["planner", "researcher", "builder", "reviewer", "brain"].map((id) => (
              <span key={id} className="flex items-center gap-1"><AgentGlyph id={id} size={10} />{id === "brain" ? "shared brain" : id}</span>
            ))}
          </div>
          <button
            type="button"
            onClick={() => jumpTo("mission-scroll")}
            className="font-mono text-[11px] text-researcher opacity-80 transition hover:opacity-100"
          >
            ▶ Watch a recorded run ↓
          </button>
        </div>
      )}
    </div>
  );
}
