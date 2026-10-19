/** Unknown URLs: a stack trace. (The real HTTP 404 comes from public/404.html on the host.) */
export default function NotFound({ path }) {
  return (
    <main className="mx-auto grid min-h-screen max-w-2xl place-items-center px-4">
      <div className="w-full">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-researcher">404 · no route</p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">PageNotFoundError</h1>
        <div className="mt-4 rounded-xl border border-line bg-panel p-4 font-mono text-xs leading-6 text-mute">
          <p>
            Exception in thread "visitor": <span className="text-alert">PageNotFoundError</span>: {path}
          </p>
          <p className="pl-4">at Router.resolve (mission-control/router.js:404)</p>
          <p className="pl-4">at Visitor.navigate (internet/links.js:1)</p>
          <details className="pl-4">
            <summary className="cursor-pointer text-researcher">▸ 3 more frames</summary>
            <p>at Coffee.brew (justin/morning.js:6)</p>
            <p>at Agents.wake (mission-control/agents.js:4)</p>
            <p>at Universe.main (everything.js:42)</p>
          </details>
          <p className="mt-3 text-ink">Suggested fix:</p>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <a href="/" className="rounded-xl bg-researcher px-5 py-3 text-sm font-semibold text-void hover:brightness-110">Return to Mission Control</a>
          <a href="/plain/" className="text-sm text-researcher underline underline-offset-4">Open Plain view</a>
        </div>
      </div>
    </main>
  );
}
