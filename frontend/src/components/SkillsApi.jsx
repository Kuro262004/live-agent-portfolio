import { useEffect, useState } from "react";
import { useReducedMotionPref } from "../lib/motion";
import { usedIn } from "../lib/names";

const slug = (m) => m.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** The skills as an API: pick a module, a short "request" runs, the JSON types out. Built from the same data as the bento grid. */
export default function SkillsApi({ skills, places }) {
  const reduced = useReducedMotionPref();
  const [current, setCurrent] = useState(skills[0]?.module);
  const [phase, setPhase] = useState("loading"); // loading -> typing -> done
  const [chars, setChars] = useState(0);
  const mod = skills.find((s) => s.module === current) ?? skills[0];
  const json = mod
    ? JSON.stringify({ module: mod.module, loaded: mod.names.length, skills: mod.names, used_in: usedIn(mod, places) }, null, 2)
    : "";

  useEffect(() => {
    if (reduced) {
      setPhase("done");
      setChars(json.length);
      return undefined;
    }
    setPhase("loading");
    setChars(0);
    const wait = setTimeout(() => setPhase("typing"), 350);
    return () => clearTimeout(wait);
  }, [current, json, reduced]);

  useEffect(() => {
    if (phase !== "typing") return undefined;
    const t = setInterval(() => {
      setChars((c) => {
        if (c + 6 >= json.length) {
          clearInterval(t);
          setPhase("done");
          return json.length;
        }
        return c + 6;
      });
    }, 16);
    return () => clearInterval(t);
  }, [phase, json]);

  if (!mod) return null;
  return (
    <div className="grid gap-3 md:grid-cols-[14rem_1fr]">
      <ul className="flex flex-wrap gap-2 md:flex-col" aria-label="Skill modules">
        {skills.map((s) => (
          <li key={s.module}>
            <button
              type="button"
              onClick={() => setCurrent(s.module)}
              aria-pressed={s.module === mod.module}
              className={`w-full rounded-lg border px-3 py-2 text-left font-mono text-xs ${s.module === mod.module ? "border-researcher bg-researcher/10 text-ink" : "border-line text-mute hover:border-mute"}`}
            >
              {slug(s.module)}
            </button>
          </li>
        ))}
      </ul>
      <div className="rounded-[14px] border border-line bg-raised p-4 font-mono text-xs leading-6">
        <p className="mb-2 flex justify-between text-mute">
          <span>GET /justin/skills?module={slug(mod.module)}</span>
          <span className={phase === "loading" ? "text-builder" : "text-reviewer"}>{phase === "loading" ? "…" : "200 OK"}</span>
        </p>
        <pre className="overflow-x-auto whitespace-pre-wrap text-ink/90" aria-label={`API response for ${mod.module}`}>
          {phase === "loading" ? "waiting for response…" : json.slice(0, chars)}
        </pre>
        {/* the full response is always available to screen readers, even while it types */}
        <span className="sr-only">{json}</span>
      </div>
    </div>
  );
}
