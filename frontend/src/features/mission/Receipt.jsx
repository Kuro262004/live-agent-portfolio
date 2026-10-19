import { motion } from "framer-motion";
import { prefersReducedMotion } from "../../lib/motion";

const AGENTS = ["planner", "researcher", "builder", "reviewer"];

const shorten = (message) => {
  const t = (message ?? "").split(/[:(]/)[0].trim();
  return t.length > 18 ? `${t.slice(0, 17)}…` : t;
};

/** Per agent: the last thing it reported, and how long it spent working (started → done pairs). */
function summarize(events) {
  return AGENTS.map((agent) => {
    const mine = events.filter((e) => e.agent === agent);
    if (mine.length === 0) return null;
    let started = null;
    let ms = 0;
    for (const e of mine) {
      if (e.type === "step_started") started = Date.parse(e.timestamp);
      if (e.type === "step_done" && started !== null) {
        ms += Date.parse(e.timestamp) - started;
        started = null;
      }
    }
    const done = [...mine].reverse().find((e) => e.type === "step_done") ?? mine[mine.length - 1];
    return { agent, summary: shorten(done.message), seconds: Number.isFinite(ms) ? ms / 1000 : 0 };
  }).filter(Boolean);
}

/** Decorative bars derived from the mission id; the button around it does the download. */
function Barcode({ value }) {
  const bars = [];
  let x = 0;
  for (let i = 0; i < 36; i += 1) {
    const w = 1 + ((value.charCodeAt(i % value.length) + i * 7) % 3);
    if (i % 2 === 0) bars.push(<rect key={i} x={x} y="0" width={w} height="28" fill="#1a1f27" />);
    x += w + 1;
  }
  return (
    <svg viewBox={`0 0 ${x} 28`} preserveAspectRatio="none" aria-hidden="true" className="mx-auto mt-3 h-7 w-full max-w-[220px]">
      {bars}
    </svg>
  );
}

const Rule = () => <hr className="my-2 border-0 border-t border-dashed" style={{ borderColor: "rgb(26 31 39 / 0.4)" }} />;

/** A paper receipt that "prints" under the deliverable. Always paper-white: it is a physical object, in every theme. */
export default function Receipt({ events, id, mode, href }) {
  const lines = summarize(events);
  if (lines.length === 0) return null;
  const first = Date.parse(events[0].timestamp);
  const last = Date.parse(events[events.length - 1].timestamp);
  const total = Number.isFinite(last - first) ? (last - first) / 1000 : 0;
  const date = new Date(first).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase();
  const code = id.replace(/^m_/, "").slice(-6).toUpperCase();
  const still = prefersReducedMotion();
  return (
    <motion.div
      initial={still ? false : { clipPath: "inset(0 0 100% 0)" }}
      animate={{ clipPath: "inset(0 0 0% 0)" }}
      transition={{ duration: 1.4, ease: "linear" }}
      className="receipt mx-auto w-[300px] max-w-full px-5 pb-6 pt-4 font-mono text-[12px] leading-5"
      style={{ background: "#f4f1ea", color: "#1a1f27" }}
      aria-label={`Receipt for mission ${code}`}
      role="group"
    >
      <p className="text-center font-bold">JUSTIN'S AGENTS · MISSION CONTROL</p>
      <Rule />
      <p className="flex justify-between"><span>MISSION {code}</span><span>{date}</span></p>
      <Rule />
      {lines.map((l) => (
        <p key={l.agent} className="flex justify-between gap-2">
          <span className="min-w-0 truncate"><b>{l.agent.toUpperCase()}</b> {l.summary}</span>
          <span className="shrink-0">{l.seconds.toFixed(1)}s</span>
        </p>
      ))}
      <Rule />
      <p className="flex justify-between font-bold"><span>TOTAL</span><span>{total.toFixed(1)}s</span></p>
      <p className="flex justify-between"><span>MODE</span><span>{mode.toLowerCase()}</span></p>
      <Rule />
      <a href={href} download aria-label="Download the deliverable" className="block text-center">
        <Barcode value={id} />
        <span className="mt-1 block text-[10px]">tap barcode to download</span>
      </a>
      <p className="mt-2 text-center text-[11px]">thank you · come again ☺</p>
    </motion.div>
  );
}
