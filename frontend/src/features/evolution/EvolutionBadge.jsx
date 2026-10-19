import { motion, useInView } from "framer-motion";
import { Sparkles } from "lucide-react";
import { useRef } from "react";
import { useReducedMotionPref } from "../../lib/motion";
import { CommitGraph } from "./CommitGraph";
import { useEvolution, usePortfolio } from "../../lib/queries";
import { evolutionLine, timeAgo } from "../../lib/time";

export function EvolutionBadge() {
  const { data } = useEvolution();
  if (!data?.last_evolved_at) return null; // never fake a "last evolved" time before the pipeline has run
  const text = evolutionLine(data);
  return (
    <span
      className="inline-flex max-w-full items-center gap-2 rounded-full border border-researcher/30 bg-researcher/10 px-3 py-1 font-mono text-[11px] text-researcher"
      title={data?.latest_commit ? `Latest learned commit: ${data.latest_commit}${data.repo ? ` (${data.repo})` : ""}` : undefined}
    >
      <Sparkles size={12} className="shrink-0" />
      <span className="truncate">{text}</span>
    </span>
  );
}

export function Changelog() {
  const { data } = usePortfolio();
  const { data: evo } = useEvolution();
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -10% 0px" });
  const reduced = useReducedMotionPref();
  const show = reduced || inView;
  return (
    <div ref={ref} className="glass rounded-2xl p-5">
      <h3 className="mb-3 font-mono text-xs uppercase tracking-widest text-researcher">Changelog · the site evolving</h3>
      {evo?.latest_commit && (
        <p className="mb-3 rounded-lg bg-raised p-2 font-mono text-xs text-mute">
          latest learned commit: <span className="text-ink">{evo.latest_commit}</span>
          {evo.repo && <> in <span className="text-ink">{evo.repo}</span></>}
        </p>
      )}
      <CommitGraph commits={data.changelog.map((c, i) => ({ id: i, type: i === 0 ? "release" : "commit" }))} />
      {/* the timeline: the main line draws itself, each entry slides in on a dot */}
      <ol className="relative space-y-3 pl-7">
        <motion.span
          aria-hidden="true"
          className="absolute bottom-2 left-[9px] top-2 w-px origin-top bg-researcher/40"
          initial={{ scaleY: reduced ? 1 : 0 }}
          animate={{ scaleY: show ? 1 : 0 }}
          transition={{ duration: 0.2 + data.changelog.length * 0.12, ease: "linear" }}
        />
        {data.changelog.map((c, i) => (
          <motion.li
            key={i}
            className="relative text-sm"
            initial={reduced ? false : { opacity: 0, x: -12 }}
            animate={show ? { opacity: 1, x: 0 } : { opacity: reduced ? 1 : 0, x: reduced ? 0 : -12 }}
            transition={{ delay: reduced ? 0 : 0.15 + i * 0.12, duration: 0.3 }}
          >
            <span aria-hidden="true" className="absolute -left-7 top-1.5 flex h-[19px] w-[19px] items-center justify-center">
              {i === 0 && !reduced && <span className="absolute h-3 w-3 animate-ping rounded-full bg-researcher/40" />}
              <span className="relative h-[9px] w-[9px] rounded-full bg-researcher" />
            </span>
            {i % 3 === 1 && <span aria-hidden="true" className="absolute -left-[14px] top-[13px] h-px w-3 bg-researcher/40" />}
            {c.entry}
            {c.published_at && <span className="ml-2 font-mono text-[11px] text-mute">{timeAgo(c.published_at)}</span>}
          </motion.li>
        ))}
      </ol>
    </div>
  );
}
