import { Check, Link2 } from "lucide-react";
import { useState } from "react";
import { track } from "../../lib/analytics";

/** Copies a link to the finished deliverable. If the browser blocks the clipboard, the link is shown to copy by hand. */
export default function ShareButton({ id }) {
  const [state, setState] = useState("idle"); // idle | copied | manual
  const url = `${window.location.origin}/m/${id}`;

  const share = async () => {
    track("Share");
    try {
      await navigator.clipboard.writeText(url);
      setState("copied");
      setTimeout(() => setState("idle"), 2500);
    } catch {
      setState("manual");
    }
  };

  if (state === "manual") {
    return (
      <input
        readOnly
        value={url}
        aria-label="Link to this plan"
        onFocus={(e) => e.target.select()}
        className="w-56 rounded-lg border border-researcher bg-void px-2 py-1.5 text-xs text-ink"
      />
    );
  }
  return (
    <button
      onClick={share}
      title="Anyone with the link can read this plan, including the details you typed"
      className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-semibold hover:border-researcher"
    >
      {state === "copied" ? <Check size={14} className="text-reviewer" /> : <Link2 size={14} />}
      {state === "copied" ? "Link copied" : "Share"}
    </button>
  );
}
