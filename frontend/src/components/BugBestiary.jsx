import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { BUGS } from "../content/bugs";
import Section from "./Section";

const RARITY = {
  common: { label: "COMMON", cls: "text-mute" },
  rare: { label: "◆ RARE", cls: "text-researcher" },
  legendary: { label: "★ LEGENDARY", cls: "text-builder" },
};

/** The toughest bugs beaten, as monster cards. Collapsed by default so the page stays short. */
export default function BugBestiary() {
  const [open, setOpen] = useState(false);
  return (
    <Section id="bestiary" agent="builder" kicker="05 · bestiary" title="Bugs I've beaten" meta={`${BUGS.length} defeated`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="bestiary-cards"
        className="mb-4 inline-flex items-center gap-2 rounded-[10px] border border-line px-3 py-2 text-sm hover:border-researcher"
      >
        {open ? "Hide the bestiary" : "Open the bestiary"} <ChevronDown size={16} className={`transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div id="bestiary-cards" className="grid gap-4 md:grid-cols-2">
          {BUGS.map((b) => (
            <article key={b.id} className="glass rounded-[14px] p-5 font-mono text-xs leading-6">
              <p className="mb-2 flex items-center justify-between text-mute">
                <span>BUG #{b.id}</span>
                <span className={RARITY[b.rarity].cls}>{RARITY[b.rarity].label}</span>
              </p>
              <h3 className="mb-2 font-display text-lg font-bold text-ink">{b.name}</h3>
              <p><span className="text-mute">Habitat:</span> {b.habitat}</p>
              <p><span className="text-mute">Symptom:</span> {b.symptom}</p>
              <p><span className="text-mute">Weakness:</span> {b.weakness}</p>
              <p><span className="text-mute">Defeated in:</span> <span className="text-reviewer">{b.defeatedIn}</span></p>
            </article>
          ))}
        </div>
      )}
    </Section>
  );
}
