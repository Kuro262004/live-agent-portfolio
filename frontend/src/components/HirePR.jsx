import { GitMerge } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { prefersReducedMotion } from "../lib/motion";
import { usePortfolio, useStatus } from "../lib/queries";
import Section from "./Section";
import Depth from "./Depth";

// These lines repeat the résumé and nothing more.
const ADDS = [
  "Agentic AI & LLM integrations (Groq, Claude, GPT, DeepSeek, Qwen)",
  "Real-time voice: Whisper + Fish Audio",
  "FastAPI · React 19 · Supabase · WebSockets",
  "Technical lead experience (AIKO at GOLI Company)",
];

/** A pull-request-shaped hire card. Merging plays a short "Merged" morph, then opens the booking link (or an email). */
export function HirePR() {
  const { data } = usePortfolio();
  const { data: status } = useStatus();
  const [merged, setMerged] = useState(false);
  const timer = useRef();
  useEffect(() => () => clearTimeout(timer.current), []);
  const href = status?.booking_url || `mailto:${data.profile.contacts.email}?subject=${encodeURIComponent("Let's merge")}`;
  const external = /^https?:/.test(href);

  const merge = (e) => {
    e.preventDefault();
    const go = () => (external ? window.open(href, "_blank", "noopener") : (window.location.href = href));
    if (prefersReducedMotion()) return go();
    setMerged(true);
    timer.current = setTimeout(() => {
      go();
      setMerged(false);
    }, 900);
    return undefined;
  };

  return (
    <Section id="hire" agent="reviewer" kicker="07 · hire" title="Merge Justin into your team">
      <Depth level={2}>
      <article data-depth="2" className="hud glass rounded-[14px] p-5 font-mono text-sm" aria-label="Pull request: Justin H. Sales wants to join your team">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-reviewer/15 px-2 py-0.5 text-reviewer">● Open</span>
          <p className="text-ink">
            <b>Justin H. Sales</b> wants to merge 1 commit into <code className="text-researcher">your-team:main</code> from{" "}
            <code className="text-brain">justin:ai-automation</code>
          </p>
        </div>
        <ul className="rounded-lg bg-void/60 p-3 leading-6">
          {ADDS.map((a) => <li key={a} className="text-reviewer">+ {a}</li>)}
          <li className="text-alert">- Hours spent on manual workflows</li>
        </ul>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <span className="text-reviewer">✓ All checks passed · ✓ {data.projects.length} projects shipped</span>
          <a
            href={href}
            onClick={merge}
            target={external ? "_blank" : undefined}
            rel={external ? "noreferrer" : undefined}
            className={`inline-flex items-center gap-2 rounded-[10px] px-4 py-2 font-sans font-semibold transition ${merged ? "bg-brain text-void" : "bg-reviewer text-void hover:brightness-110"}`}
          >
            {merged ? (
              <>
                <GitMerge size={16} aria-hidden="true" /> Merged ✓
              </>
            ) : (
              "Merge (Hire)"
            )}
          </a>
        </div>
      </article>
      </Depth>
    </Section>
  );
}
