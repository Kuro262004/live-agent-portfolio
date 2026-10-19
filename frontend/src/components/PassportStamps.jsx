import { motion } from "framer-motion";
import { useReducedMotionPref } from "../lib/motion";
import { afterDash } from "../lib/names";

const LOOKS = [
  { color: "text-researcher", shape: "rounded-full", r: -8 },
  { color: "text-builder", shape: "rounded-md", r: 4 },
  { color: "text-planner", shape: "rounded-[50%/42%]", r: -3 },
  { color: "text-reviewer", shape: "rounded-full", r: 7, ring: true },
];

// What fits on a stamp: issuer and subject, then the date when the content has one. Anything not listed keeps its full text.
const SHORT = [
  [/bayanaihan/i, "Bayanaihan · Agentic AI"],
  [/cybersecurity/i, "Cybersec · Quezon City"],
  [/java/i, "DICT · Java"],
  [/information technology/i, "ISPSC · BS IT"],
];
const stampLabel = (title, date, full) => {
  const short = SHORT.find(([re]) => re.test(title))?.[1];
  return short ? [short, date].filter(Boolean).join(" · ") : full;
};

/** Training and education as ink stamps on a passport page. Every stamp keeps its full text in aria-label and the tooltip. */
export default function PassportStamps({ education, trainings }) {
  const reduced = useReducedMotionPref();
  const stamps = [
    ...trainings.map((t) => ({ key: t.title, text: [afterDash(t.title), t.provider, t.date].filter(Boolean).join(" · "), title: t.title, date: t.date })),
    ...education.map((e) => ({ key: e.degree, text: [e.degree, e.school.split(",")[0], e.date].filter(Boolean).join(" · "), title: e.degree, date: e.date })),
  ].map((s) => ({ ...s, label: stampLabel(s.title, s.date, s.text) }));
  return (
    <div className="glass mt-5 rounded-[14px] p-5">
      <p className="mb-4 font-mono text-[11px] uppercase tracking-wider text-mute">Passport · training &amp; certifications</p>
      <ul className="flex flex-wrap items-center justify-center gap-x-6 gap-y-5">
        {stamps.map((s, i) => {
          const look = LOOKS[i % LOOKS.length];
          return (
            <motion.li
              key={s.key}
              role="img"
              aria-label={s.text}
              title={s.text}
              initial={reduced ? false : { scale: 1.4, opacity: 0 }}
              whileInView={{ scale: 1, opacity: 0.88 }}
              viewport={{ once: true, amount: 0.6 }}
              transition={{ type: "spring", stiffness: 500, damping: 22, delay: reduced ? 0 : i * 0.15 }}
              className={`stamp ${look.color} ${look.shape} ${look.ring ? "stamp-ring" : ""}`}
              style={{ "--r": `${look.r}deg` }}
            >
              <span aria-hidden="true">{s.label}</span>
            </motion.li>
          );
        })}
      </ul>
    </div>
  );
}
