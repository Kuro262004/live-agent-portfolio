import { useInView } from "framer-motion";
import { useRef } from "react";
import { usePortfolio } from "../lib/queries";
import { jumpTo } from "../lib/motion";
import { firstPart, shortName } from "../lib/names";
import { useApp } from "../stores/app";
import SplitFlap from "./SplitFlap";

const STATUS_COLOR = { COMPLETE: "text-reviewer", "IN PROGRESS": "text-builder" };
// Short labels so every cell stays on one line, also on a phone. The full status is still read out.
const STATUS_SHORT = { COMPLETE: "COMPLETE", "IN PROGRESS": "IN DEV" };
const BOARD_NAMES = { "hotel-scan-to-order": "HOTEL QR ORDER", bodycam: "BODY-CAM BLUR" };
const boardName = (item, fallback) => BOARD_NAMES[item.id] ?? (fallback.length > 16 ? `${fallback.slice(0, 15)}…` : fallback);

/** A departure board over the projects: one row per project and job, built from the same content as the cards below. */
export default function DepartureBoard() {
  const { data } = usePortfolio();
  const setFocusProject = useApp((s) => s.setFocusProject);
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.3 });
  const rows = [
    ...data.projects.map((p) => ({ id: p.id, kind: "project", name: shortName(p), board: boardName(p, shortName(p)), status: "COMPLETE", gate: firstPart(p.context || "Project") })),
    ...data.experience.map((e) => ({ id: e.id, kind: "job", name: shortName(e), board: boardName(e, shortName(e)), status: "IN PROGRESS", gate: e.org })),
  ];
  const go = (r) => {
    if (r.kind === "project") setFocusProject(r.id);
    else jumpTo("experience");
  };
  return (
    <div ref={ref} className="glass mb-5 overflow-hidden rounded-[14px]" role="table" aria-label="Departure board of projects and missions">
      <div role="row" className="grid grid-cols-[1.6fr_1fr] gap-3 border-b border-line px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-mute sm:grid-cols-[2fr_1.2fr_1.2fr]">
        <span role="columnheader">Mission</span>
        <span role="columnheader">Status</span>
        <span role="columnheader" className="hidden sm:block">Gate</span>
      </div>
      {rows.map((r, i) => (
        <button
          key={r.id}
          role="row"
          type="button"
          onClick={() => go(r)}
          className="grid w-full grid-cols-[1.6fr_1fr] gap-3 border-b border-line/60 px-4 py-2 text-left text-[12px] max-sm:px-3 max-sm:text-[11px] last:border-b-0 hover:bg-raised/60 focus-visible:bg-raised/60 sm:grid-cols-[2fr_1.2fr_1.2fr]"
        >
          <span role="cell" className="min-w-0 overflow-hidden"><SplitFlap text={r.board} label={r.name} start={inView} delay={i * 120} /></span>
          <span role="cell" className={STATUS_COLOR[r.status]}><SplitFlap text={STATUS_SHORT[r.status]} label={r.status} start={inView} delay={i * 120 + 200} /></span>
          <span role="cell" className="hidden min-w-0 overflow-hidden text-ink/80 sm:block"><SplitFlap text={r.gate} start={inView} delay={i * 120 + 400} /></span>
        </button>
      ))}
    </div>
  );
}
