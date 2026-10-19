import { useMutation } from "@tanstack/react-query";
import { CalendarCheck, Loader2, Play, RotateCcw, Square, Zap } from "lucide-react";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import Markdown from "../../components/Markdown";
import { getCaptchaToken } from "../../components/captcha";
import { BookCallLink, InfoNote } from "../../components/InfoNote";
import AgentGlyph from "../../components/AgentGlyph";
import Depth from "../../components/Depth";
import { track } from "../../lib/analytics";
import { downloadUrl, startMission } from "../../lib/api";
import { useStatus, useTemplates } from "../../lib/queries";
import { scrollToEl } from "../../lib/motion";
import { missionFormSchema } from "../../lib/schemas";
import { chime, tick } from "../../lib/sound";
import { useApp } from "../../stores/app";
import DownloadButton from "./DownloadButton";
import MissionProgress from "./MissionProgress";
import Receipt from "./Receipt";
import ShareButton from "./ShareButton";
import { deriveGraph, logLines, pairSpans, statusLine } from "./state";
import TypedLine from "./TypedLine";
import { useMission } from "./useMission";
import { useReplay } from "./useReplay";

const AGENT_COLOR = { planner: "text-planner", researcher: "text-researcher", builder: "text-builder", reviewer: "text-reviewer" };

function Field({ f, value, onChange, error }) {
  const base = "w-full rounded-lg border border-line bg-void px-3 py-2 text-sm text-ink placeholder:text-mute/60 focus:border-researcher focus:outline-none";
  const id = `f-${f.name}`;
  return (
    <div>
      <label htmlFor={id} className="mb-1 block font-mono text-[11px] uppercase tracking-wider text-mute">{f.label}</label>
      {f.type === "select" ? (
        <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={base}>
          <option value="">Choose…</option>
          {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : f.type === "textarea" ? (
        <textarea id={id} rows={4} value={value} onChange={(e) => onChange(e.target.value)} placeholder={f.placeholder} className={base} />
      ) : (
        <input id={id} value={value} onChange={(e) => onChange(e.target.value)} placeholder={f.placeholder} className={base} />
      )}
      {error && <p role="alert" className="mt-1 text-xs text-alert">{error}</p>}
    </div>
  );
}

const AgentGraph = lazy(() => import("./AgentGraph"));
const TraceDrawer = lazy(() => import("./TraceDrawer"));

export default function MissionPanel() {
  const { data: templates, isLoading, isError } = useTemplates();
  const { data: status } = useStatus();
  const missionId = useApp((s) => s.missionId);
  const setMissionId = useApp((s) => s.setMissionId);
  const runNotice = useApp((s) => s.runNotice);
  const setRunNotice = useApp((s) => s.setRunNotice);
  const setMissionLine = useApp((s) => s.setMissionLine);
  const setMissionRunning = useApp((s) => s.setMissionRunning);
  const prefill = useApp((s) => s.prefill);
  const setPrefill = useApp((s) => s.setPrefill);
  const bookingUrl = status?.booking_url;
  const [tid, setTid] = useState(null);
  const [values, setValues] = useState({});
  const [errors, setErrors] = useState({});
  const { events: liveEvents, spans, mission, error: streamError } = useMission(missionId);
  const [traceId, setTraceId] = useState(null);
  const openSpan = spans.find((sp) => sp.span_id === traceId) ?? null;
  const inspectable = useMemo(() => new Set(spans.map((sp) => sp.agent)), [spans]);
  // a node click opens that agent's latest span (the builder has two after a revision)
  const inspectAgent = (agent) => setTraceId(spans.findLast((sp) => sp.agent === agent)?.span_id ?? null);
  const replay = useReplay(liveEvents);
  const events = replay.events; // what the graph, log and progress bar show: live, or the replayed slice
  const soundOn = useApp((s) => s.soundOn);
  const logRef = useRef(null);

  const template = useMemo(() => templates?.find((t) => t.id === (tid ?? templates[0]?.id)), [templates, tid]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [events.length]);

  // The assistant picked a template and answers: fill the form in so the visitor sees what was run.
  useEffect(() => {
    if (!prefill || !templates) return;
    if (templates.some((t) => t.id === prefill.template_id)) {
      setTid(prefill.template_id);
      setValues(prefill.inputs ?? {});
      setErrors({});
    }
    setPrefill(null);
  }, [prefill, templates, setPrefill]);

  useEffect(() => {
    setMissionLine(missionId ? statusLine(liveEvents) : null);
  }, [liveEvents, missionId, setMissionLine]);

  // the system rail mirrors what the graph shows, so it lights up during a run wherever the visitor is on the page
  const setAgentStatus = useApp((s) => s.setAgentStatus);
  useEffect(() => {
    const { agents } = deriveGraph(events);
    setAgentStatus(Object.fromEntries(Object.entries(agents).map(([id, a]) => [id, a.status === "active" ? "thinking" : a.status])));
  }, [events, setAgentStatus]);

  // Bring the graph and log into view whenever a mission starts (from the form or the assistant).
  useEffect(() => {
    if (missionId) scrollToEl(document.getElementById("mission-graph"), "center");
  }, [missionId]);

  const start = useMutation({
    mutationFn: async () => {
      const complete = Object.fromEntries(template.fields.map((f) => [f.name, values[f.name] ?? ""]));
      const parsed = missionFormSchema(template).safeParse(complete);
      if (!parsed.success) {
        const next = {};
        for (const issue of parsed.error.issues) next[issue.path[0]] ??= issue.message;
        setErrors(next);
        throw new Error("Please fix the highlighted fields.");
      }
      setErrors({});
      const token = await getCaptchaToken(status?.captcha_required);
      return startMission(template.id, parsed.data, token);
    },
    onSuccess: (r) => {
      track("Mission", { template: template.id, replay: String(r.replay) });
      setRunNotice(r.reason ?? null);
      setMissionId(r.mission_id);
    },
  });

  // "Watch a recorded run": free, instant, needs no details
  const watch = useMutation({
    mutationFn: () => startMission(template.id, {}, null, true),
    onSuccess: (r) => {
      track("Recorded run", { template: template.id });
      setRunNotice(r.reason ?? null);
      setMissionId(r.mission_id);
    },
  });

  // the hero teaser asks for a recorded run; handle each click once
  const recordedRequest = useApp((st) => st.recordedRequest);
  const handled = useRef(recordedRequest);
  useEffect(() => {
    if (recordedRequest === handled.current) return;
    handled.current = recordedRequest;
    watch.mutate();
  }, [recordedRequest, watch]);

  const running = !!missionId && !liveEvents.some((e) => e.type === "complete" || e.type === "error");
  useEffect(() => {
    setMissionRunning(running);
    return () => setMissionRunning(false);
  }, [running, setMissionRunning]);
  const heard = useRef(0);
  useEffect(() => {
    heard.current = 0;
  }, [missionId]);
  useEffect(() => {
    const fresh = liveEvents.slice(heard.current);
    heard.current = liveEvents.length;
    if (!soundOn || fresh.length === 0 || fresh.length > 3) return;
    if (fresh.some((e) => e.type === "complete")) chime();
    else if (fresh.some((e) => e.type === "handoff")) tick();
  }, [liveEvents, soundOn]);
  const printRef = useRef(null);
  const result = mission?.result;
  useEffect(() => {
    // the scanning line sweeps the full height of the card, whatever the document length
    if (result && printRef.current) printRef.current.style.setProperty("--scan-h", `${printRef.current.offsetHeight}px`);
  }, [result]);
  const recorded = mission?.replay;

  return (
    <div className="mission-bg grid gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <form
        className="hud glass space-y-4 rounded-[14px] p-5"
        onSubmit={(e) => { e.preventDefault(); start.mutate(); }}
        noValidate
      >
        <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-builder">
          <Zap size={14} /> Give my agents a task
        </div>
        {isLoading && <p className="text-sm text-mute">Loading templates…</p>}
        {isError && <p className="text-sm text-alert">Mission Control is offline right now. The server may be waking up; refresh in a minute.</p>}
        {templates && template && (
          <>
            <div className="grid gap-2" role="radiogroup" aria-label="Mission template">
              {templates.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="radio"
                  aria-checked={t.id === template.id}
                  onClick={() => { setTid(t.id); setValues({}); setErrors({}); }}
                  className={`rounded-lg border px-3 py-2 text-left text-sm transition ${t.id === template.id ? "border-builder bg-builder/10 text-ink" : "border-line text-mute hover:border-mute"}`}
                >
                  {t.title}
                  {t.inspired_by && <span className="block font-mono text-[10px] uppercase tracking-wider text-mute">inspired by {t.inspired_by}</span>}
                </button>
              ))}
            </div>
            {template.fields.map((f) => (
              <Field key={`${template.id}-${f.name}`} f={f} value={values[f.name] ?? ""} error={errors[f.name]}
                onChange={(v) => setValues((s) => ({ ...s, [f.name]: v }))} />
            ))}
            <p className="text-xs text-mute">You'll get: {template.deliverable}.</p>
            {status?.fallback && (
              <InfoNote className="text-xs">Today's live runs are paused, so you'll see a recorded run of this template instead.</InfoNote>
            )}
            <button
              type="submit"
              disabled={start.isPending || running}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-builder px-4 py-2.5 text-sm font-semibold text-void transition hover:brightness-110 disabled:opacity-50"
            >
              {start.isPending || running ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
              {running || replay.replaying ? (mission?.replay || replay.replaying || runNotice ? "Replaying…" : "Agents working…") : "Run mission"}
            </button>
            {start.isError && <p role="alert" className="text-sm text-alert">{start.error.message}</p>}
            <button type="button" onClick={() => watch.mutate()} disabled={watch.isPending || running} className="text-xs text-researcher underline underline-offset-2 disabled:opacity-50">
              Or watch a recorded run of this template
            </button>
            {watch.isError && <p role="alert" className="text-sm text-alert">{watch.error.message}</p>}
            <MissionProgress events={events} />
          </>
        )}
      </form>

      <div className="min-w-0 space-y-4">
        {(runNotice || mission?.replay) && (
          <InfoNote>
            {runNotice === "limit" ? "You've used today's live runs. " : runNotice === "recorded" ? "" : "Today's live runs are paused. "}
            You're watching a recorded run of this template, or you can <BookCallLink />.
          </InfoNote>
        )}
        <div className="hud rounded-[14px]">
          <Suspense fallback={<div className="h-[270px] rounded-[14px] border border-line bg-void/60" />}>
            <AgentGraph events={events} running={running || start.isPending} onInspect={inspectAgent} inspectable={inspectable} />
          </Suspense>
        </div>
        {spans.length > 0 && <p className="font-mono text-[11px] text-mute">Click an agent, or “inspect” in the log, to see exactly what it did.</p>}
        {status && !status.llm && (
          <p className="font-mono text-[11px] text-mute">Scripted demo: the agents run built-in logic here. With model keys on the server they use live LLMs.</p>
        )}
        {replay.replaying && (
          <button onClick={replay.stop} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-semibold hover:border-alert">
            <Square size={12} /> Stop replay
          </button>
        )}
        <div ref={logRef} className="h-40 overflow-y-auto rounded-2xl border border-line bg-void p-3 font-mono text-xs" aria-live="polite" aria-label="Mission log">
          {events.length === 0 && <p className="text-mute">$ waiting for a task… the agents are idle.</p>}
          {pairSpans(logLines(events), spans).map((l, i, all) => (
            <p key={l.key} className="leading-5">
              <span className="text-mute">{l.time}</span>{" "}
              <span className={`inline-flex items-center gap-1 font-bold ${AGENT_COLOR[l.agent] ?? "text-ink"}`}><AgentGlyph id={l.agent} size={11} />{l.agent}</span>{" "}
              <span className={l.type === "error" ? "text-alert" : "text-ink/80"}>
                <TypedLine text={l.message} animate={i === all.length - 1} cursor={running && i === all.length - 1} />
              </span>
              {l.span && (
                <button type="button" onClick={() => setTraceId(l.span.span_id)} aria-label={`Inspect the ${l.agent}'s trace`}
                  className="ml-2 text-[10px] uppercase tracking-wider text-mute underline underline-offset-2 hover:text-ink">
                  inspect
                </button>
              )}
            </p>
          ))}
          {streamError && <p className="text-alert">{streamError}</p>}
        </div>
        {openSpan && (
          <Suspense fallback={null}>
            <TraceDrawer span={openSpan} spans={spans} onClose={() => setTraceId(null)} onPick={(sp) => setTraceId(sp.span_id)} />
          </Suspense>
        )}
        {result && !replay.replaying && (
          <Depth level={2}>
          <div id="deliverable" ref={printRef} className="hud paper print-scan relative overflow-hidden rounded-[14px] border border-rule/10 bg-raised p-6">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs uppercase tracking-widest text-reviewer">Deliverable ready{recorded ? " · recorded run" : ""}</span>
              <span className="flex-1" />
              <button onClick={replay.start} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-semibold hover:border-researcher">
                <RotateCcw size={14} /> Replay
              </button>
              <ShareButton id={mission.mission_id} />
              <DownloadButton href={downloadUrl(mission.mission_id)} />
              <a href={bookingUrl || "#contact"} target={bookingUrl ? "_blank" : undefined} rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-reviewer px-3 py-1.5 text-xs font-semibold text-void hover:brightness-110">
                <CalendarCheck size={14} /> Book a call with the real Justin
              </a>
            </div>
            <p className="mb-4 border-b border-rule/10 pb-3 font-mono text-[11px] text-mute">Prepared by Justin's agents · reviewed by the Reviewer</p>
            <div className="max-h-[28rem] overflow-y-auto pr-2"><Markdown key={mission.mission_id} source={result.markdown} reveal /></div>
            <p className="mt-4 border-t border-rule/10 pt-3">
              <span className="rounded-full border border-rule/15 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-mute">
                {recorded ? "Recorded run" : status?.llm ? "Live run" : "Scripted demo"}
              </span>
            </p>
          </div>
          </Depth>
        )}
        {result && !replay.replaying && (
          <Receipt events={events} id={mission.mission_id} href={downloadUrl(mission.mission_id)} mode={recorded ? "Recorded run" : status?.llm ? "Live run" : "Scripted demo"} />
        )}
      </div>
    </div>
  );
}
