import { z } from "zod";

export const portfolioSchema = z.object({
  profile: z.object({
    name: z.string(),
    title: z.string(),
    summary: z.string(),
    now_building: z.string().default(""),
    stats: z.array(z.object({ value: z.string(), label: z.string() })).default([]),
    testimonials: z.array(z.object({ quote: z.string(), name: z.string(), role: z.string().default("") })).default([]),
    contacts: z.object({
      email: z.string(),
      phone: z.string(),
      linkedin: z.string(),
      github: z.string(),
      languages: z.array(z.string()).default([]),
    }),
  }),
  skills: z.array(z.object({ module: z.string(), names: z.array(z.string()) })),
  experience: z.array(
    z.object({
      id: z.string(),
      org: z.string(),
      title: z.string(),
      role: z.string(),
      period: z.string(),
      bullets: z.array(z.string()),
      stack: z.array(z.string()),
    }),
  ),
  projects: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      context: z.string().default(""),
      role: z.string().default(""),
      goal: z.string().default(""),
      result: z.string().default(""),
      stack: z.array(z.string()).default([]),
      repo_url: z.string().nullable().optional(),
    }),
  ),
  education: z.array(
    z.object({ degree: z.string(), specialization: z.string().default(""), school: z.string(), date: z.string().default("") }),
  ),
  trainings: z.array(z.object({ title: z.string(), provider: z.string().default(""), date: z.string().default("") })),
  changelog: z.array(z.object({ entry: z.string(), published_at: z.string().optional() })).default([]),
});

export const statusSchema = z.object({
  fallback: z.boolean(),
  reason: z.string().nullable().optional(),
  llm: z.boolean(),
  voice: z.object({ stt: z.boolean(), tts: z.boolean() }),
  booking_url: z.string().nullable().optional(),
  captcha_required: z.boolean(),
  limits: z.object({ calls_per_day: z.number(), missions_per_day: z.number(), max_call_seconds: z.number() }),
});

export const evolutionSchema = z.object({
  last_evolved_at: z.string().nullable(),
  last_run_at: z.string().nullable().optional(),
  commits_learned: z.number(),
  latest_commit: z.string().nullable(),
  repo: z.string().nullable(),
});

export const templateSchema = z.object({
  id: z.string(),
  title: z.string(),
  inspired_by: z.string(),
  deliverable: z.string(),
  fields: z.array(
    z.object({
      name: z.string(),
      label: z.string(),
      placeholder: z.string().optional(),
      type: z.string().optional(),
      options: z.array(z.string()).optional(),
      required: z.boolean(),
      max: z.number().optional(),
    }),
  ),
});

/** One agent's trace span (type "span" events carry it); see backend/app/agents/trace.py. */
const spanSchema = z.object({
  span_id: z.string(),
  agent: z.string(),
  started_at: z.string(),
  ended_at: z.string(),
  input: z.string(),
  prompt_template: z.string(),
  retrieved: z.array(z.object({ source: z.string(), score: z.number(), excerpt: z.string() })),
  output: z.string(),
  model: z.string(),
  tokens_in: z.number(),
  tokens_out: z.number(),
  latency_ms: z.number(),
  cost_usd: z.number().nullable(),
  mode: z.string(),
  recorded_mode: z.string().nullable().optional(),
});

const missionEventSchema = z.object({
  mission_id: z.string(),
  seq: z.number(),
  agent: z.string(),
  type: z.string(),
  message: z.string(),
  timestamp: z.string(),
  span: spanSchema.optional(),
});

export const missionSchema = z.object({
  mission_id: z.string(),
  template_id: z.string(),
  status: z.string(),
  replay: z.boolean(),
  result: z.object({ title: z.string(), markdown: z.string() }).nullable(),
  events: z.array(missionEventSchema),
});

export const draftSchema = z.object({
  id: z.number(),
  repo: z.string(),
  commit_range: z.string(),
  draft_type: z.string(),
  content: z.record(z.any()),
  status: z.string(),
  created_at: z.string(),
});

/** Build a zod validator for a mission template's form. */
export function missionFormSchema(template) {
  const shape = {};
  for (const f of template.fields) {
    let s = z.string().trim();
    if (f.required) s = s.min(1, `${f.label} is required`);
    if (f.max) s = s.max(f.max, `${f.label} must be ${f.max} characters or fewer`);
    if (f.type === "select" && f.options) s = s.refine((v) => f.options.includes(v), `Choose ${f.label.toLowerCase()}`);
    shape[f.name] = s;
  }
  return z.object(shape);
}
