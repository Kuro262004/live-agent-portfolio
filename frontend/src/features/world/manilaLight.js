/** The world's light follows the actual time in the Philippines (Candon, Ilocos Sur), whatever the visitor's zone. */

export function manilaHour(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", hour: "numeric", minute: "numeric", hourCycle: "h23" }).formatToParts(date);
  const h = Number(parts.find((p) => p.type === "hour").value);
  const m = Number(parts.find((p) => p.type === "minute").value);
  return h + m / 60;
}

// [hour, sky tint (RGB 0..1), tint strength, star brightness]: night navy, warm violet sunrise, plain day,
// coral golden hour, evening
const KEYS = [
  [0, [0.04, 0.06, 0.13], 0.5, 1.0],
  [6, [0.23, 0.16, 0.25], 0.55, 0.4],
  [9, [0.08, 0.13, 0.23], 0.15, 0.0],
  [17, [0.23, 0.16, 0.16], 0.5, 0.2],
  [20, [0.05, 0.07, 0.15], 0.45, 0.8],
  [24, [0.04, 0.06, 0.13], 0.5, 1.0],
];

/** Interpolated light for an hour (0..24): { tint: [r, g, b], strength, stars }. */
export function lightAt(hour) {
  const i = Math.max(0, KEYS.findIndex((k, n) => hour >= k[0] && hour < KEYS[n + 1]?.[0]));
  const [h0, c0, s0, st0] = KEYS[i];
  const [h1, c1, s1, st1] = KEYS[i + 1] ?? KEYS[i];
  const f = h1 === h0 ? 0 : (hour - h0) / (h1 - h0);
  const mix = (a, b) => a + (b - a) * f;
  return { tint: c0.map((v, k) => mix(v, c1[k])), strength: mix(s0, s1), stars: mix(st0, st1) };
}

/** "🌙 Candon, 11:42 PM" (☀️ between 6 AM and 6 PM), for the footer. */
export function manilaClock(date = new Date()) {
  const hour = manilaHour(date);
  const time = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit" }).format(date);
  return `${hour >= 6 && hour < 18 ? "☀️" : "🌙"} Candon, ${time}`;
}
