import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import Markdown from "../../components/Markdown";
import { downloadUrl, getMission } from "../../lib/api";

/** /m/<id>: a finished deliverable, read-only, for sending to someone. */
export default function SharedMission({ id }) {
  const q = useQuery({ queryKey: ["shared", id], queryFn: () => getMission(id), retry: false });
  const result = q.data?.result;

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <a href="/" className="text-sm text-mute hover:text-ink">← Justin H. Sales · Live Agent Portfolio</a>
      {q.isLoading && <p className="mt-8 text-mute">Loading the plan…</p>}
      {q.isError && (
        <div className="mt-8 rounded-2xl border border-line bg-panel p-6">
          <h1 className="text-xl font-bold">This plan isn't available</h1>
          <p className="mt-2 text-sm text-mute">The link may be wrong, or the plan was removed.</p>
          <a href="/" className="mt-4 inline-block rounded-lg bg-researcher px-4 py-2 text-sm font-semibold text-void">Run your own mission</a>
        </div>
      )}
      {q.data && !result && <p className="mt-8 text-mute">This mission hasn't finished yet. Try again in a moment.</p>}
      {result && (
        <>
          <p className="mb-1 mt-6 font-mono text-xs uppercase tracking-widest text-reviewer">
            Planned by Justin's AI agents{q.data.replay ? " · recorded run" : ""}
          </p>
          <div className="rounded-2xl border border-reviewer/40 bg-panel p-5">
            <Markdown source={result.markdown} />
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <a href={downloadUrl(id)} download className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm font-semibold hover:border-reviewer">
              <Download size={15} /> Download
            </a>
            <a href="/#mission" className="rounded-lg bg-researcher px-4 py-2 text-sm font-semibold text-void hover:brightness-110">Run your own mission</a>
          </div>
        </>
      )}
    </main>
  );
}
