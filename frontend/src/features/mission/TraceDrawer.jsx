import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useRef, useState } from "react";
import AgentGlyph from "../../components/AgentGlyph";
import { AGENT_HEX } from "../../lib/agents";

const TABS = ["input", "prompt", "memory", "output", "metrics"];

/** What the numbers in a span are, in plain words. Scripted and recorded spans never pass for live ones. */
export function modeLabel(span) {
  const what = { live: "live model", local: "real work, no model call", scripted: "scripted (no AI key on the server)" };
  if (span.mode === "recorded") return `recorded run · ${what[span.recorded_mode] ?? "earlier run"}`;
  return what[span.mode] ?? span.mode;
}

const ms = (a, b) => Math.max(0, new Date(b) - new Date(a));

function costText(span) {
  if (span.cost_usd != null) return `$${span.cost_usd.toFixed(4)}`;
  return span.tokens_in || span.tokens_out ? "price not set" : "none (no model call)";
}

/** Accessible tabs: arrow keys move between them, and only the open panel is in the tab order. */
function Tabs({ value, onChange, children }) {
  const refs = useRef({});
  const onKey = (e) => {
    const i = TABS.indexOf(value);
    const next = e.key === "ArrowRight" ? TABS[(i + 1) % TABS.length] : e.key === "ArrowLeft" ? TABS[(i + TABS.length - 1) % TABS.length] : null;
    if (!next) return;
    e.preventDefault();
    onChange(next);
    refs.current[next]?.focus();
  };
  return (
    <>
      <div role="tablist" aria-label="Span details" className="mt-4 flex flex-wrap gap-1 border-b border-rule/10" onKeyDown={onKey}>
        {TABS.map((t) => (
          <button
            key={t}
            ref={(el) => (refs.current[t] = el)}
            type="button"
            role="tab"
            id={`trace-tab-${t}`}
            aria-selected={value === t}
            aria-controls={`trace-panel-${t}`}
            tabIndex={value === t ? 0 : -1}
            onClick={() => onChange(t)}
            className={`-mb-px border-b-2 px-2.5 py-1.5 text-xs capitalize ${value === t ? "border-researcher text-ink" : "border-transparent text-mute hover:text-ink"}`}
          >
            {t}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`trace-panel-${value}`} aria-labelledby={`trace-tab-${value}`} tabIndex={0} className="mt-3 focus:outline-none">
        {children}
      </div>
    </>
  );
}

/** Every span of the mission on one time axis; the open one is solid, and each bar opens its own span. */
function Waterfall({ spans, active, onPick }) {
  const t0 = Math.min(...spans.map((s) => new Date(s.started_at).getTime()));
  const total = Math.max(1, Math.max(...spans.map((s) => new Date(s.ended_at).getTime())) - t0);
  return (
    <div className="mt-6">
      <p className="mb-2 text-[11px] uppercase tracking-wider text-mute">Timeline</p>
      <ol className="space-y-1" aria-label="Span timeline">
        {spans.map((s, i) => {
          const left = ((new Date(s.started_at) - t0) / total) * 100;
          const width = Math.max(2, (ms(s.started_at, s.ended_at) / total) * 100);
          return (
            <li key={s.span_id} className="grid grid-cols-[5.5rem_1fr] items-center gap-2">
              <button type="button" onClick={() => onPick(s)} aria-current={s.span_id === active ? "true" : undefined}
                className={`truncate text-left text-[11px] ${s.span_id === active ? "text-ink" : "text-mute hover:text-ink"}`}>
                {i + 1}. {s.agent}
              </button>
              <span className="relative h-3 rounded-sm bg-rule/5">
                <span className="absolute inset-y-0 rounded-sm" title={`${s.agent}: ${ms(s.started_at, s.ended_at)} ms`}
                  style={{ left: `${left}%`, width: `${Math.min(width, 100 - left)}%`, background: AGENT_HEX[s.agent], opacity: s.span_id === active ? 1 : 0.45 }} />
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/**
 * Developer-tools-style drawer for one agent's span: what went in, the prompt template, what the shared brain
 * returned, what came out and the real metrics, with the whole mission on a timeline below.
 */
export default function TraceDrawer({ span, spans, onClose, onPick }) {
  const [tab, setTab] = useState("output");
  if (!span) return null;
  const index = spans.findIndex((s) => s.span_id === span.span_id);
  const color = AGENT_HEX[span.agent];
  return (
    <Dialog.Root open onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-black/40" />
        <Dialog.Content
          aria-describedby="trace-mode"
          className="fixed right-0 top-0 z-[61] h-full w-full max-w-[520px] overflow-y-auto border-l border-rule/10 bg-raised p-5 font-mono text-sm shadow-2xl focus:outline-none"
        >
          <div className="flex items-start gap-2">
            <Dialog.Title className="flex flex-1 items-center gap-2 font-bold uppercase tracking-wider" style={{ color }}>
              <AgentGlyph id={span.agent} size={14} /> {span.agent}
              <span className="font-normal normal-case tracking-normal text-mute">· span {index + 1} of {spans.length}</span>
            </Dialog.Title>
            <Dialog.Close className="rounded p-1 text-mute hover:text-ink" aria-label="Close the trace"><X size={18} /></Dialog.Close>
          </div>
          <p id="trace-mode" className="mt-1 text-[11px] text-mute">{modeLabel(span)}</p>

          <Tabs value={tab} onChange={setTab}>
            {tab === "input" && <pre className="whitespace-pre-wrap text-xs leading-5 text-ink/85">{span.input || "—"}</pre>}
            {tab === "prompt" && <pre className="whitespace-pre-wrap text-xs leading-5 text-ink/85">{span.prompt_template}</pre>}
            {tab === "memory" &&
              (span.retrieved.length ? (
                <>
                  <p className="mb-2 text-[11px] text-mute">{span.retrieved.length} chunks retrieved from the shared brain (similarity)</p>
                  <ul className="space-y-2 text-xs leading-5">
                    {span.retrieved.map((r) => (
                      <li key={r.source}>
                        <span className="text-reviewer">{r.score.toFixed(2)}</span> <span className="text-ink">{r.source}</span>
                        <span className="block text-ink/70">“{r.excerpt}”</span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="text-xs text-mute">This step didn't read the shared brain.</p>
              ))}
            {tab === "output" && <pre className="whitespace-pre-wrap text-xs leading-5 text-ink/85">{span.output || "—"}</pre>}
            {tab === "metrics" && (
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
                <dt className="text-mute">model</dt>
                <dd>{span.model}</dd>
                <dt className="text-mute">tokens</dt>
                <dd>{span.tokens_in || span.tokens_out ? `${span.tokens_in.toLocaleString()} in · ${span.tokens_out.toLocaleString()} out` : "none"}</dd>
                <dt className="text-mute">latency</dt>
                <dd>{span.latency_ms.toLocaleString()} ms</dd>
                <dt className="text-mute">cost</dt>
                <dd>{costText(span)}</dd>
                <dt className="text-mute">mode</dt>
                <dd>{modeLabel(span)}</dd>
              </dl>
            )}
          </Tabs>

          {spans.length > 1 && <Waterfall spans={spans} active={span.span_id} onPick={onPick} />}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
