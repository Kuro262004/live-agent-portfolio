import { motion, useScroll, useTransform } from "framer-motion";
import { Bus } from "lucide-react";
import { useRef } from "react";
import { useReducedMotionPref } from "../lib/motion";
import { afterDash } from "../lib/names";

const when = (d) => (d ? new Date(`1 ${d}`).getTime() || 0 : 0);

/** The journey as a jeepney route: dated trainings, then the bootcamp, graduation, and the current job. */
function buildStops({ education, trainings, experience }) {
  const dated = trainings.filter((t) => t.date).sort((a, b) => when(a.date) - when(b.date));
  const undated = trainings.filter((t) => !t.date);
  const stops = [
    ...dated.map((t) => ({ key: t.title, place: t.provider.split(",")[0], what: afterDash(t.title), date: t.date })),
    ...undated.map((t) => ({ key: t.title, place: t.provider, what: afterDash(t.title).replace(/\s*\(.*?\)/g, ""), date: "" })),
    ...education.map((e) => ({ key: e.degree, place: e.school.split(",")[0], what: e.degree, date: e.date })),
  ];
  const job = experience[0];
  if (job) stops.push({ key: "now", place: job.org, what: job.role || job.title, date: "Present" });
  return stops;
}

export default function JeepneyRoute(props) {
  const stops = buildStops(props);
  const ref = useRef(null);
  const reduced = useReducedMotionPref();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 85%", "end 55%"] });
  const x = useTransform(scrollYProgress, (v) => `calc(${reduced ? 1 : v} * (100cqw - 28px))`);
  const city = /Candon/.test(props.education[0]?.school ?? "") ? "CANDON" : "";
  const bayan = props.trainings.some((t) => /Bayanaihan/i.test(t.provider)) ? "BAYANAIHAN" : "";
  const sign = [city, bayan, props.experience[0]?.org.toUpperCase()].filter(Boolean).join("  ⇄  ");
  if (stops.length === 0) return null;
  return (
    <div ref={ref} className="mt-8" role="group" aria-label={`Route of Justin's journey: ${stops.map((s) => `${s.place}, ${s.what}`).join("; ")}`}>
      <div className="overflow-hidden rounded-[10px] border border-line bg-panel">
        <p className="px-4 py-2 text-center font-display text-sm font-bold uppercase tracking-[0.18em] sm:text-base">{sign}</p>
        <div aria-hidden="true" className="flex h-1.5">
          <span className="flex-1 bg-builder" />
          <span className="flex-1 bg-researcher" />
          <span className="flex-1 bg-brain" />
        </div>
      </div>
      <div className="mt-4 hidden md:block" aria-hidden="true">
        <div className="relative [container-type:inline-size]">
          <motion.span style={{ x }} className="absolute -top-5 left-0 text-builder"><Bus size={28} /></motion.span>
        </div>
        <div className="relative mt-3 flex items-center">
          <span className="absolute inset-x-0 top-1/2 h-px bg-line" />
          {stops.map((s) => (
            <span key={s.key} className="relative flex flex-1 justify-center">
              <span className="h-2.5 w-2.5 rounded-full bg-researcher ring-4 ring-void" />
            </span>
          ))}
        </div>
      </div>
      <ol className="mt-3 grid gap-3 md:mt-2" style={{ gridTemplateColumns: `repeat(auto-fit, minmax(10rem, 1fr))` }}>
        {stops.map((s) => (
          <li key={s.key} className="text-center text-xs leading-5 max-md:rounded-lg max-md:border max-md:border-line max-md:bg-panel max-md:p-3 max-md:text-left">
            <p className="font-semibold text-ink">{s.place}</p>
            <p className="text-mute">{s.what}</p>
            {s.date && <p className="font-mono text-[11px] text-researcher">{s.date}</p>}
          </li>
        ))}
      </ol>
    </div>
  );
}
