import { AnimatePresence, motion } from "framer-motion";
import { FileText, MessageSquare, Phone, Zap } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useOnScreen, useReducedMotionPref } from "../lib/motion";
import { useRichMode } from "../lib/useRichMode";
import { NODES, useHero3D } from "../features/hero3d/store";
import { nodeWorld } from "../features/world/stations";
import { useWorld } from "../features/world/store";
import { EvolutionBadge } from "../features/evolution/EvolutionBadge";
import { usePortfolio, useStatus } from "../lib/queries";
import { track } from "../lib/analytics";
import { scrollToSection, useApp } from "../stores/app";
import BootIntro, { shouldBoot } from "./BootIntro";
import Constellation from "./Constellation";
import HeroVisual from "./HeroVisual";
import Magnetic from "./Magnetic";

function WaveBars() {
  return (
    <span className="wave ml-1 hidden h-4 items-end gap-[2px] group-hover:flex" aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => (
        <span key={i} style={{ animationDelay: `${i * 90}ms` }} />
      ))}
    </span>
  );
}

/**
 * The name settles in letter by letter once the boot intro is over (a static name for reduced motion). In rich mode
 * the 3D world's particles spell it instead, over this heading, and the real text fades in as they scatter (or
 * after a short wait, if the world never gets there). The real text is always the accessible name.
 */
function Name({ name, ready }) {
  const reduced = useReducedMotionPref();
  const rich = useRichMode();
  const phase = useWorld((s) => s.namePhase);
  const failed = useWorld((s) => s.failed);
  const [waited, setWaited] = useState(false);
  useEffect(() => {
    if (!rich || !ready) return undefined;
    const t = setTimeout(() => setWaited(true), 2500);
    return () => clearTimeout(t);
  }, [rich, ready]);
  const particles = rich && !failed && !reduced;
  const shown = phase === "scatter" || phase === "done" || waited;
  return (
    <h1 id="hero-name" aria-label={name} className={`text-5xl font-bold tracking-tight sm:text-6xl ${ready ? "" : "invisible"}`}>
      <span aria-hidden="true" className={particles ? "inline-block transition-opacity duration-[1200ms]" : undefined} style={particles ? { opacity: shown ? 1 : 0 } : undefined}>
        {reduced || !ready || particles
          ? name
          : name.split("").map((ch, i) => (
              <motion.span
                key={i}
                className="inline-block"
                initial={{ y: "0.6em", opacity: 0, filter: "blur(8px)" }}
                animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
                transition={{ delay: 0.03 * i, type: "spring", stiffness: 380, damping: 26 }}
              >
                {ch === " " ? "\u00a0" : ch}
              </motion.span>
            ))}
      </span>
    </h1>
  );
}

/** Live presence: "3 people watching the agents", hidden when you're the only one (or the server is away). */
function Watching() {
  const n = useApp((s) => s.presenceCount);
  if (!n || n < 2) return null;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-researcher/30 bg-researcher/10 px-3 py-1 font-mono text-[11px] text-researcher">
      <span className="h-1.5 w-1.5 rounded-full bg-researcher" aria-hidden="true" /> {n} people watching the agents
    </span>
  );
}

export default function Hero() {
  const { data } = usePortfolio();
  const { data: status } = useStatus();
  const openCall = useApp((s) => s.openCall);
  const [booting, setBooting] = useState(shouldBoot);
  const endBoot = useCallback(() => setBooting(false), []);
  // the name (and everything waiting on bootDone) starts once the boot text has finished fading, not while it fades
  const [revealed, setRevealed] = useState(() => !booting);
  const reveal = useCallback(() => setRevealed(true), []);
  const setBootDone = useApp((s) => s.setBootDone);
  useEffect(() => {
    if (revealed) setBootDone();
  }, [revealed, setBootDone]);
  useEffect(() => {
    if (booting || revealed) return undefined;
    const t = setTimeout(reveal, 400); // backstop in case the fade-out never reports back
    return () => clearTimeout(t);
  }, [booting, revealed, reveal]);
  const callRef = useRef(null);
  const callVisible = useOnScreen(callRef); // the sonar rests when the button is off-screen
  const p = data.profile;
  const fallback = status?.fallback;
  const rich = useRichMode();
  // rich mode: the camera flies to the researcher first, and the panel opens as it arrives (never more than ~700 ms)
  const call = () => {
    track("Call");
    if (!rich) return openCall();
    const placement = useWorld.getState().placement;
    useHero3D.getState().flyTo(placement ? nodeWorld("researcher", placement) : NODES.researcher.pos);
    setTimeout(openCall, 650);
  };

  return (
    <header className="relative pb-10 pt-12 sm:pt-20">
      {!rich && <Constellation />}
      <AnimatePresence onExitComplete={reveal}>{booting && <BootIntro status={status} onDone={endBoot} />}</AnimatePresence>
      <div className="relative grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
       <div>
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <EvolutionBadge />
          {status?.llm && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-reviewer/30 bg-reviewer/10 px-3 py-1 font-mono text-[11px] text-reviewer">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-reviewer" /> agents online
            </span>
          )}
          <Watching />
        </div>
        <Name name={p.name} ready={revealed} />
        <p className="mt-3 max-w-2xl text-lg text-mute sm:text-xl">{p.title}</p>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-ink/80">
          This portfolio is also a working AI product. Talk to Justin's AI, watch his agents plan and build a real deliverable live, and see a site that updates itself from his GitHub.
        </p>
        {p.now_building && (
          <p className="mt-3 max-w-2xl text-sm leading-6 text-ink/80">
            <span className="font-mono text-xs uppercase tracking-wider text-builder">Now building · </span>
            {p.now_building}
          </p>
        )}
        <div id="hero-actions" className="mt-7 flex flex-wrap items-center gap-3">
          <Magnetic>
            <button
              ref={callRef}
              data-paused={callVisible ? "false" : "true"}
              onClick={call}
              className="sonar group relative inline-flex items-center gap-2 rounded-xl bg-sun px-5 py-3 text-sm font-semibold text-onsun glow-cta transition hover:brightness-110"
            >
              {fallback ? <MessageSquare size={18} /> : <Phone size={18} />}
              {fallback ? "Chat with my AI" : "Call my AI"}
              {!fallback && <WaveBars />}
            </button>
          </Magnetic>
          <Magnetic>
            <button
              onClick={() => scrollToSection("mission-live")}
              className="inline-flex items-center gap-2 rounded-xl border border-line bg-panel px-5 py-3 text-sm font-semibold text-ink transition hover:border-mute"
            >
              <Zap size={18} className="text-builder" /> Give my agents a task
            </button>
          </Magnetic>
          <a href="/plain/" className="inline-flex items-center gap-1.5 px-2 py-3 text-sm text-mute underline-offset-4 hover:text-ink hover:underline">
            <FileText size={15} /> Plain view
          </a>
        </div>
        {p.stats?.length > 0 && (
          <dl className="mt-8 grid max-w-2xl grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Results">
            {p.stats.map((st) => (
              <div key={st.label} className="rounded-xl border border-line bg-panel px-3 py-2.5">
                <dd className="font-mono text-xl font-bold text-researcher">{st.value}</dd>
                <dt className="text-[11px] leading-4 text-mute">{st.label}</dt>
              </div>
            ))}
          </dl>
        )}
       </div>
       <div className="hidden lg:block">
         <HeroVisual />
       </div>
      </div>
    </header>
  );
}
