import { useMotionValueEvent, useScroll } from "framer-motion";
import { lazy, Suspense, useMemo, useRef, useState } from "react";
import AgentGlyph from "../../components/AgentGlyph";
import { AGENT_HEX, NEUTRAL } from "../../lib/agents";
import { jumpTo } from "../../lib/motion";
import { RECORDED_RUN, STEPS } from "./recorded";

const AgentGraph = lazy(() => import("./AgentGraph"));

const COLOR = { ...AGENT_HEX, task: NEUTRAL.mute };

// each step frames the working agent with the agents it hands work to and from, so nobody is cut off at the edge
const NEIGHBORS = {
  task: ["planner"],
  planner: ["task", "researcher"],
  researcher: ["planner", "brain", "builder"],
  brain: ["researcher"],
  builder: ["researcher", "reviewer"],
  reviewer: ["builder"],
};

/**
 * Rich mode only: the section pins while the visitor scrolls, and each screen of scrolling plays the next step of
 * a recorded run, with the graph gliding to the agent at work. Plain page scroll throughout (no scroll-jacking),
 * and a skip link to the live form below.
 */
export default function ScrollMission() {
  const ref = useRef(null);
  const [step, setStep] = useState(0);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });

  useMotionValueEvent(scrollYProgress, "change", (v) => {
    const next = Math.min(STEPS.length - 1, Math.max(0, Math.floor(v * STEPS.length)));
    setStep((cur) => (cur === next ? cur : next));
  });

  const events = useMemo(() => RECORDED_RUN.filter((e) => e.step <= step), [step]);
  const current = STEPS[step];
  const whole = step === 0 || step === STEPS.length - 1; // the first and last steps show the whole team

  return (
    <section ref={ref} id="mission-scroll" style={{ height: `${STEPS.length * 70}vh` }} aria-label="How the agents work: a recorded run" className="relative mb-10">
      <div className="sticky top-14 flex h-[calc(100vh-3.5rem)] flex-col justify-center gap-4 py-6">
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full border border-line px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-widest text-mute">recorded run</span>
          <p className="font-mono text-sm" style={{ color: COLOR[current.agent] }} aria-live="polite">
            {String(step + 1).padStart(2, "0")} / {STEPS.length} · {current.label}
          </p>
        </div>

        <Suspense fallback={<div className="h-[min(46vh,420px)] rounded-2xl border border-line" />}>
          <AgentGraph id="scroll-graph" className="h-[min(46vh,420px)]" events={events} running={step > 0 && step < STEPS.length - 1} focus={whole ? null : [current.agent, ...NEIGHBORS[current.agent]]} />
        </Suspense>

        <div className="glass h-36 overflow-hidden rounded-[14px] p-4 font-mono text-xs leading-6" aria-hidden="true">
          {events.slice(-5).map((e) => (
            <p key={e.seq} className="truncate">
              <span className="inline-flex items-center gap-1 font-bold" style={{ color: COLOR[e.agent] }}>
                <AgentGlyph id={e.agent} size={11} />
                {e.agent}
              </span>{" "}
              <span className="text-ink/80">{e.message}</span>
            </p>
          ))}
          {!events.length && <p className="text-mute">Scroll to watch the agents pick up a task…</p>}
        </div>

        <div className="flex items-center gap-3">
          <ol className="flex flex-1 gap-1.5" aria-label="Progress">
            {STEPS.map((s, i) => (
              <li key={s.agent} className="h-1 flex-1 rounded-full transition-colors duration-300" style={{ background: i <= step ? COLOR[s.agent] : NEUTRAL.line }}>
                <span className="sr-only">{s.label}{i <= step ? " (done)" : ""}</span>
              </li>
            ))}
          </ol>
          <a
            href="#mission-live"
            onClick={(e) => {
              e.preventDefault();
              jumpTo("mission-live");
            }}
            className="shrink-0 text-sm text-mute underline underline-offset-4 hover:text-ink"
          >
            Skip to running your own mission ↓
          </a>
        </div>
      </div>
    </section>
  );
}
