import seed from "../content/seed.json";
import {
  draftSchema,
  evolutionSchema,
  missionSchema,
  portfolioSchema,
  statusSchema,
  templateSchema,
} from "./schemas";
import { z } from "zod";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

/** Bundled copy of the content, used if the API is asleep or unreachable. */
// The server flattens profile.extras (now building, stats, testimonials) into the profile; do the same for the bundled copy.
export const seedPortfolio = portfolioSchema.parse({ ...seed, profile: { ...seed.profile, ...seed.profile.extras } });

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function request(path, { method = "GET", body, token } = {}) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  let res;
  try {
    const init = { method, headers };
    if (body !== undefined) init.body = JSON.stringify(body);
    res = await fetch(`${API_BASE}${path}`, init);
  } catch {
    throw new ApiError("The server can't be reached right now. It may be waking up; try again in a moment.", 0);
  }
  if (!res.ok) {
    let detail = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      if (typeof data.detail === "string") detail = data.detail;
    } catch {
      /* keep default */
    }
    throw new ApiError(detail, res.status);
  }
  return res.json();
}

export const getPortfolio = async () => portfolioSchema.parse(await request("/api/profile"));
export const getStatus = async () => statusSchema.parse(await request("/api/status"));
export const getEvolution = async () => evolutionSchema.parse(await request("/api/evolution/status"));
export const getTemplates = async () => z.array(templateSchema).parse(await request("/api/missions/templates"));
export const getMission = async (id) => missionSchema.parse(await request(`/api/missions/${id}`));
export const startMission = (template_id, inputs, captcha, recorded = false) =>
  request("/api/missions", { method: "POST", body: { template_id, inputs, captcha, recorded } });
/**
 * The same chat, streamed (Server-Sent Events over a POST, which EventSource can't send): onToken gets text as the
 * model writes it, onTool the name of each tool it uses, and the promise resolves with the `done` payload (whole
 * reply, UI actions and real metrics).
 */
export async function streamChat(message, history, language = "English", { onToken, onTool } = {}) {
  let res;
  try {
    res = await fetch(`${API_BASE}/api/chat/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, history, language }),
    });
  } catch {
    throw new ApiError("The server can't be reached right now. It may be waking up; try again in a moment.", 0);
  }
  if (!res.ok) {
    let detail = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      if (typeof data.detail === "string") detail = data.detail;
    } catch {
      /* keep default */
    }
    throw new ApiError(detail, res.status);
  }
  let done = null;
  let buf = "";
  const handle = (raw) => {
    const event = raw.match(/^event: (.*)$/m)?.[1];
    const line = raw.match(/^data: (.*)$/m)?.[1];
    if (!event || line == null) return;
    const data = JSON.parse(line);
    if (event === "token") onToken?.(data.t);
    else if (event === "tool") onTool?.(data.name);
    else if (event === "done") done = data;
    else if (event === "error") throw new ApiError(data.detail, 500);
  };
  const drain = () => {
    let i;
    while ((i = buf.indexOf("\n\n")) !== -1) {
      handle(buf.slice(0, i));
      buf = buf.slice(i + 2);
    }
  };
  if (res.body?.getReader) {
    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
    for (;;) {
      const { value, done: end } = await reader.read();
      if (end) break;
      buf += value;
      drain();
    }
  } else {
    buf = await res.text(); // no streams (old browsers, tests): the whole answer at once
  }
  buf += "\n\n";
  drain();
  if (!done) throw new ApiError("The reply was cut off. Please try again.", 0);
  return done;
}
export const askNavigate = (q) => request("/api/navigate", { method: "POST", body: { q } });
export const downloadUrl = (id) => `${API_BASE}/api/missions/${id}/download`;

export const listDrafts = async (token) => z.array(draftSchema).parse(await request("/api/admin/drafts", { token }));
export const approveDraft = (id, content, token) =>
  request(`/api/admin/drafts/${id}/approve`, { method: "POST", body: content ? { content } : {}, token });
export const rejectDraft = (id, token) => request(`/api/admin/drafts/${id}/reject`, { method: "POST", token });

/** ws(s)://host/path for the API, whether VITE_API_URL is set or the dev proxy is used. */
export function wsUrl(path) {
  const base = API_BASE || window.location.origin;
  return base.replace(/^http/, "ws") + path;
}
