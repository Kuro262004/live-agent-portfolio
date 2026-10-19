import { askNavigate } from "./api";
import { jumpTo } from "./motion";
import { useApp } from "../stores/app";

/**
 * Keyword fallback for ask-to-navigate, used when the live model is off or unreachable: plain words → a section,
 * cards to light up and a short line. The lines only point at things; they never claim facts.
 */
const KEYWORDS = [
  [/\b(voice|call|phone|telephone|operator|whisper|fish ?audio|aiko|f&b|ordering)\b/i, "experience", ["experience:aiko"], "Here's AIKO, his AI telephone operator work."],
  [/\b(body ?cam|face|blur|video|vision|detection)\b/i, "experience", ["experience:bodycam"], "Here's his face detection and blurring work."],
  [/\b(health|rural|clinic|damaiyan|hackathon)\b/i, "projects", ["projects:damaiyan"], "Here's DamAiyan, the rural health project."],
  [/\b(hotel|qr|room|scan)\b/i, "projects", ["projects:hotel-scan-to-order"], "Here's the hotel scan-to-order project."],
  [/\b(recycl\w*|bottle|iot|botpoints|capstone)\b/i, "projects", ["projects:botpoints"], "Here's BOTPOINTS, the recycling rewards project."],
  [/\b(back-?end|api|apis|fastapi|server|database|sql|postgres)\b/i, "skills", ["skills:Backend"], "Here are his backend skills."],
  [/\b(front-?end|react|ui|tailwind|interface|css)\b/i, "skills", ["skills:Frontend"], "Here are his frontend skills."],
  [/\b(devops|deploy\w*|docker|cloud|data)\b/i, "skills", ["skills:Data & DevOps"], "Here are his data and DevOps skills."],
  [/\b(test\w*|qa|quality)\b/i, "skills", ["skills:Testing & Quality"], "Here's how he tests and checks quality."],
  [/\b(ai|llm|llms|agents?|agentic|prompt\w*|gpt|claude|groq)\b/i, "skills", ["skills:AI & Voice"], "Here are his AI and voice skills."],
  [/\b(bugs?|debug\w*|fix\w*)\b/i, "bestiary", [], "Here are bugs he has beaten."],
  [/\b(hire|hiring|available|availability|rate)\b/i, "hire", [], "Here's how to hire him."],
  [/\b(contact|email|reach|linkedin|github)\b/i, "contact", [], "Here's how to reach him."],
  [/\b(about|who|background|education|school|degree)\b/i, "about", [], "Here's who he is."],
  [/\b(experience|job|jobs|company|goli|career)\b/i, "experience", [], "Here's his work history."],
  [/\b(projects?|built|portfolio|work)\b/i, "projects", [], "Here are his projects."],
  [/\b(mission|demo|task|agents? work)\b/i, "mission", [], "Here's Mission Control, where his agents work."],
];

export function keywordNav(q) {
  const hit = KEYWORDS.find(([re]) => re.test(q));
  return hit ? { section: hit[1], highlight: hit[2], say: hit[3], source: "keyword match" } : null;
}

/** Ask the server's model first; fall back to the keyword map when it can't answer. */
export async function resolveNav(q) {
  try {
    const r = await askNavigate(q);
    if (!r.fallback && r.section) return { section: r.section, highlight: r.highlight ?? [], say: r.say, source: "live AI" };
  } catch {
    /* server asleep: the keyword map still works */
  }
  return keywordNav(q);
}

/** Scroll there (the 3D camera follows the page), light the cards up in their section's agent colour, say the line. */
export function runNav(result) {
  const { section, highlight, say, source } = result;
  const project = highlight.find((h) => h.startsWith("projects:"));
  if (project) useApp.getState().setFocusProject(project.slice(9)); // the list view, with that card open
  jumpTo(section);
  useApp.getState().setNavNote({ text: say, source });
  setTimeout(() => {
    for (const id of highlight) {
      const el = document.querySelector(`[data-nav-id="${CSS.escape(id)}"]`);
      if (!el) continue;
      el.classList.remove("nav-highlight");
      void el.offsetWidth; // restart the pulse if it was already running
      el.classList.add("nav-highlight");
      setTimeout(() => el.classList.remove("nav-highlight"), 2200);
    }
  }, 500);
}
