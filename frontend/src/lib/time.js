export function timeAgo(iso, now = Date.now()) {
  if (!iso) return null;
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  const units = [
    [60, "minute"],
    [3600, "hour"],
    [86400, "day"],
  ];
  let value = Math.floor(s / 60);
  let unit = "minute";
  for (const [secs, name] of units) {
    if (s >= secs) {
      value = Math.floor(s / secs);
      unit = name;
    }
  }
  return `${value} ${unit}${value === 1 ? "" : "s"} ago`;
}

export function evolutionLine(evo, now = Date.now()) {
  if (!evo || !evo.last_evolved_at) return "Not evolved yet";
  const ago = timeAgo(evo.last_evolved_at, now);
  const n = evo.commits_learned;
  const learned = n > 0 ? ` · ${n} new commit${n === 1 ? "" : "s"} learned` : "";
  return `Last evolved ${ago}${learned}`;
}
