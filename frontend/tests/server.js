import { http, HttpResponse, ws } from "msw";
import { setupServer } from "msw/node";

export const evolution = {
  last_evolved_at: new Date(Date.now() - 3 * 3600_000).toISOString(),
  commits_learned: 2,
  latest_commit: "Add voice barge-in",
  repo: "portfolio",
};

export const status = {
  fallback: false,
  reason: null,
  llm: false,
  voice: { stt: false, tts: false },
  booking_url: null,
  captcha_required: false,
  limits: { calls_per_day: 2, missions_per_day: 3, max_call_seconds: 180 },
};

export const templates = [
  {
    id: "workflow-audit",
    title: "Find automation opportunities in my process",
    inspired_by: "General automation",
    deliverable: "Ranked list",
    fields: [{ name: "process", label: "Describe your process", type: "textarea", required: true, max: 20 }],
  },
  {
    id: "food-ordering-automation",
    title: "Plan an AI ordering system",
    inspired_by: "AIKO",
    deliverable: "Ordering flow",
    fields: [
      { name: "business", label: "Business", required: true, max: 120 },
      { name: "channels", label: "Channels", type: "select", options: ["chat", "voice"], required: true },
      { name: "notes", label: "Notes (optional)", required: false, max: 300 },
    ],
  },
];

// Sockets are covered by the backend tests; here they connect to a silent mock.
const anySocket = ws.link("*");

export const server = setupServer(
  anySocket.addEventListener("connection", () => {}),
  http.get("*/api/evolution/status", () => HttpResponse.json(evolution)),
  http.get("*/api/status", () => HttpResponse.json(status)),
  http.get("*/api/missions/templates", () => HttpResponse.json(templates)),
  // a sleeping free-tier server: the site must fall back to its bundled content
  http.get("*/api/profile", () => HttpResponse.json({ detail: "waking up" }, { status: 503 })),
  http.get("*/api/missions/:id", () => HttpResponse.json({ detail: "not found" }, { status: 404 })),
);

/** A streamed chat reply as /api/chat/stream sends it (Server-Sent Events): tokens, optional tools, then done. */
export function chatStream(reply, { actions = [], tools = [], live = false } = {}) {
  const ev = (event, data) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  const words = reply.split(/(?<= )/);
  const done = live
    ? { reply, actions, mode: "live", model: "groq:test-model", tokens_in: 120, tokens_out: 18, model_ms: 300, ms: 420, cost_usd: null }
    : { reply, actions, mode: "offline", model: null, tokens_in: 0, tokens_out: 0, model_ms: 0, ms: 12, cost_usd: null };
  const body = tools.map((name) => ev("tool", { name })).join("") + words.map((t) => ev("token", { t })).join("") + ev("done", done);
  return new HttpResponse(body, { headers: { "Content-Type": "text/event-stream" } });
}
