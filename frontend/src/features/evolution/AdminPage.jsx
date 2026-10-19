import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, X } from "lucide-react";
import { useState } from "react";
import { approveDraft, listDrafts, rejectDraft } from "../../lib/api";

const store = {
  get: () => {
    try {
      return sessionStorage.getItem("admin-token") ?? "";
    } catch {
      return "";
    }
  },
  set: (v) => {
    try {
      sessionStorage.setItem("admin-token", v);
    } catch {
      /* storage blocked: the token only lives for this render */
    }
  },
};

const input = "w-full rounded-lg border border-line bg-void px-3 py-2 text-sm focus:border-researcher focus:outline-none";

function DraftCard({ d, token, onDone }) {
  const [content, setContent] = useState(d.content);
  const proj = content.project;
  const setProj = (k, v) => setContent((c) => ({ ...c, project: { ...c.project, [k]: v } }));
  const approve = useMutation({ mutationFn: () => approveDraft(d.id, content, token), onSuccess: onDone });
  const reject = useMutation({ mutationFn: () => rejectDraft(d.id, token), onSuccess: onDone });
  const pending = d.status === "pending";
  const err = approve.error?.message || reject.error?.message;

  return (
    <article className="space-y-3 rounded-2xl border border-line bg-panel p-5">
      <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
        <span className="rounded bg-researcher/15 px-2 py-0.5 text-researcher">{d.draft_type}</span>
        <span className="text-ink">{d.repo}</span>
        <span className="text-mute">{d.commit_range}</span>
        <span className="flex-1" />
        <span className={d.status === "approved" ? "text-reviewer" : d.status === "rejected" ? "text-alert" : "text-builder"}>{d.status}</span>
      </div>
      {content.commits?.length > 0 && (
        <ul className="list-disc space-y-0.5 pl-5 text-xs text-mute">{content.commits.map((m, i) => <li key={i}>{m}</li>)}</ul>
      )}
      <label className="block text-xs text-mute">
        Changelog entry
        <textarea disabled={!pending} rows={2} className={`${input} mt-1`} value={content.changelog ?? ""}
          onChange={(e) => setContent((c) => ({ ...c, changelog: e.target.value }))} />
      </label>
      {proj && (
        <div className="grid gap-3 sm:grid-cols-2">
          {["name", "context", "role", "goal", "result"].map((k) => (
            <label key={k} className={`block text-xs capitalize text-mute ${k === "goal" || k === "result" ? "sm:col-span-2" : ""}`}>
              {k}
              <input disabled={!pending} className={`${input} mt-1`} value={proj[k] ?? ""} onChange={(e) => setProj(k, e.target.value)} />
            </label>
          ))}
        </div>
      )}
      {d.draft_type === "project_update" && (
        <label className="block text-xs text-mute">
          New result line (optional)
          <input disabled={!pending} className={`${input} mt-1`} value={content.result ?? ""} onChange={(e) => setContent((c) => ({ ...c, result: e.target.value }))} />
        </label>
      )}
      {err && <p role="alert" className="text-sm text-alert">{err}</p>}
      {pending && (
        <div className="flex gap-2">
          <button onClick={() => approve.mutate()} disabled={approve.isPending} className="inline-flex items-center gap-1.5 rounded-lg bg-reviewer px-4 py-2 text-sm font-semibold text-void disabled:opacity-50">
            <Check size={15} /> Approve &amp; publish
          </button>
          <button onClick={() => reject.mutate()} disabled={reject.isPending} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-4 py-2 text-sm hover:border-alert">
            <X size={15} /> Reject
          </button>
        </div>
      )}
    </article>
  );
}

export default function AdminPage() {
  const [token, setToken] = useState(store.get);
  const [entered, setEntered] = useState(token);
  const qc = useQueryClient();
  const drafts = useQuery({ queryKey: ["drafts", token], queryFn: () => listDrafts(token), enabled: !!token, retry: false });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["drafts"] });
    qc.invalidateQueries({ queryKey: ["evolution"] });
    qc.invalidateQueries({ queryKey: ["portfolio"] });
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <a href="/" className="text-sm text-mute hover:text-ink">← Back to the site</a>
      <h1 className="mb-1 mt-4 text-2xl font-bold">Evolution drafts</h1>
      <p className="mb-6 text-sm text-mute">Nothing from GitHub goes live until you approve it here.</p>
      <form className="mb-6 flex gap-2" onSubmit={(e) => { e.preventDefault(); store.set(entered); setToken(entered); }}>
        <input type="password" value={entered} onChange={(e) => setEntered(e.target.value)} placeholder="EVOLVE_SECRET" aria-label="Admin token" className={input} />
        <button className="rounded-lg bg-researcher px-4 text-sm font-semibold text-void">Unlock</button>
      </form>
      {drafts.isError && <p role="alert" className="text-sm text-alert">{drafts.error.message}</p>}
      {drafts.data?.length === 0 && <p className="text-sm text-mute">No drafts yet. The nightly run will add some.</p>}
      <div className="space-y-4">
        {drafts.data?.map((d) => <DraftCard key={`${d.id}-${d.status}`} d={d} token={token} onDone={refresh} />)}
      </div>
    </main>
  );
}
