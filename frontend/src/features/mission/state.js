const AGENTS = ["planner", "researcher", "builder", "reviewer"];

/** Which agent receives the baton on a handoff from each agent. */
const NEXT = { planner: "researcher", researcher: "builder", builder: "reviewer", reviewer: "builder" };

/** Fold the event stream into what the graph shows. Pure, so it can be tested without a socket. */
export function deriveGraph(events) {
  const agents = Object.fromEntries(AGENTS.map((a) => [a, { status: "idle", message: "" }]));
  let activeEdge = null; // "from>to" while a handoff is in flight
  let complete = false;
  let failed = false;
  for (const e of events) {
    if (!agents[e.agent] && e.type !== "complete") continue;
    switch (e.type) {
      case "step_started":
        agents[e.agent] = { status: "active", message: e.message };
        activeEdge = null;
        break;
      case "step_progress":
        agents[e.agent] = { status: "active", message: e.message };
        break;
      case "step_done":
        agents[e.agent] = { status: "done", message: e.message };
        break;
      case "handoff":
        activeEdge = `${e.agent}>${NEXT[e.agent]}`;
        // a reviewer handoff sends the work back, so the builder works again
        if (e.agent === "reviewer") agents.builder = { status: "active", message: "Revising…", revision: true };
        break;
      case "error":
        failed = true;
        agents[e.agent] = { status: "error", message: e.message };
        break;
      case "complete":
        complete = true;
        activeEdge = null;
        break;
      default:
    }
  }
  return { agents, activeEdge, complete, failed };
}

/** The most recent message from each agent, newest last, for the live log. */
export function logLines(events) {
  return events.map((e) => ({ key: e.seq, agent: e.agent, type: e.type, message: e.message, time: localTime(e.timestamp) }));
}

/**
 * A trace span follows the log line that reports its result, so each span is attached to its agent's last line
 * before it in the stream (lines and spans carry their stream position: `key` and `seq`).
 */
export function pairSpans(lines, spans) {
  const at = new Map();
  for (const sp of spans) {
    const line = lines.findLast((l) => l.agent === sp.agent && l.key < sp.seq);
    if (line) at.set(line.key, sp);
  }
  return at.size ? lines.map((l) => (at.has(l.key) ? { ...l, span: at.get(l.key) } : l)) : lines;
}

/** The server sends ISO timestamps with an offset; show them in the visitor's own time zone. */
function localTime(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleTimeString([], { hour12: false });
}

const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);

/** One line describing what the agents are doing right now, for the minimized panel. */
export function statusLine(events) {
  const last = events[events.length - 1];
  if (!last) return null;
  if (last.type === "complete") return "✓ Deliverable ready";
  if (last.type === "error") return "The mission hit a problem. See the log on screen.";
  return `${cap(last.agent)}: ${last.message}`;
}
