// Names in the content look like "DamAiyan — AI System for Rural Health Units"; the short form is the part before the dash.
const SPLIT = /\s[·—–-]\s|\s\uFFFD\s/;
const SHORT = { aiko: "AIKO" }; // jobs have long titles; this is the name Justin uses for them

export const firstPart = (s) => s.split(SPLIT)[0];

export function afterDash(s) {
  const parts = s.split(SPLIT);
  return parts.length > 1 ? parts.slice(1).join(" ") : parts[0];
}

export const shortName = (item) => SHORT[item.id] ?? (item.name ? firstPart(item.name) : item.title);

const tokens = (list) =>
  new Set(
    list
      .flatMap((n) => [n, ...(n.match(/\(([^)]*)\)/)?.[1].split(",") ?? [])])
      .map((t) => t.replace(/\(.*\)/, "").trim().toLowerCase())
      .filter(Boolean),
  );

/** Projects and jobs whose tool lists share something with this skill module: "used in" comes from the real content. */
export function usedIn(module, items) {
  const mine = tokens(module.names);
  return items.filter((it) => it.stack.some((t) => mine.has(t.toLowerCase()))).map(shortName);
}
