import { AnimatePresence, motion } from "framer-motion";
import { Boxes, Cpu, Database, FlaskConical, Layers, Palette, ChevronDown, GraduationCap, Github, Linkedin, Mail, Phone, CalendarCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AGENT_HEX, tint } from "../lib/agents";
import { usedIn } from "../lib/names";
import DepartureBoard from "./DepartureBoard";
import JeepneyRoute from "./JeepneyRoute";
import PassportStamps from "./PassportStamps";
import SkillsApi from "./SkillsApi";
import { scrollToEl, spotlight, useOnScreen, useReducedMotionPref } from "../lib/motion";
import { useEvolution, usePortfolio, useStatus } from "../lib/queries";
import { useApp } from "../stores/app";
import { Changelog } from "../features/evolution/EvolutionBadge";
import Depth from "./Depth";
import ProjectRail from "../features/projects/ProjectRail";
import { useRichMode } from "../lib/useRichMode";
import Section from "./Section";

const MODULE_ICON = {
  "AI & Voice": Cpu,
  Frontend: Layers,
  Backend: Boxes,
  "Data & DevOps": Database,
  "Testing & Quality": FlaskConical,
  "Design & Other": Palette,
};
// skills read as the brain's knowledge, so every module wears the brain colour except where an agent fits the work
const MODULE_COLOR = { "AI & Voice": AGENT_HEX.brain, Frontend: AGENT_HEX.researcher, Backend: AGENT_HEX.planner, "Data & DevOps": AGENT_HEX.builder, "Testing & Quality": AGENT_HEX.reviewer, "Design & Other": AGENT_HEX.brain };
const colorOf = (module) => MODULE_COLOR[module] ?? AGENT_HEX.brain;

/** Chips load one by one (50 ms apart) while the label counts up: "loading… 3/9", then "9 loaded". */
function ModuleChips({ names, color }) {
  const reduced = useReducedMotionPref();
  const ref = useRef(null);
  const seen = useOnScreen(ref);
  const [shown, setShown] = useState(reduced ? names.length : 0);
  useEffect(() => {
    if (reduced) {
      setShown(names.length);
      return undefined;
    }
    if (!seen) return undefined;
    setShown(0);
    const t = setInterval(() => setShown((n) => (n >= names.length ? n : n + 1)), 50);
    return () => clearInterval(t);
  }, [names, reduced, seen]);
  return (
    <div ref={ref}>
      <p className="mb-3 font-mono text-xs uppercase tracking-widest" style={{ color }} aria-live="off">
        {shown < names.length ? `loading… ${shown}/${names.length}` : `${names.length} loaded`}
      </p>
      <div className="flex flex-wrap gap-2">
        {names.map((n, i) =>
          i < shown ? (
            <motion.span key={n} initial={reduced ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
              <Chip>{n}</Chip>
            </motion.span>
          ) : (
            <span key={n} className="sr-only">{n}</span>
          ),
        )}
      </div>
    </div>
  );
}

const Chip = ({ children }) => (
  <span className="rounded-md border border-line bg-raised px-2 py-0.5 font-mono text-[11px] text-ink/80">{children}</span>
);

export function About() {
  const { data } = usePortfolio();
  const { profile, education, trainings } = data;
  return (
    <Section id="about" agent="planner" kicker="01 · about" title="Who's behind the agents">
      <div className="grid gap-5 lg:grid-cols-[3fr_2fr]">
        <p className="text-base leading-7 text-ink/90">{profile.summary}</p>
        <div className="glass space-y-4 rounded-2xl p-5">
          {education.map((e) => (
            <div key={e.degree} className="flex gap-3">
              <GraduationCap className="mt-0.5 shrink-0 text-researcher" size={18} />
              <p className="text-sm leading-6">
                <strong>{e.degree}</strong>, {e.specialization}
                <span className="block text-mute">{e.school} · {e.date}</span>
              </p>
            </div>
          ))}
        </div>
      </div>
      <PassportStamps education={education} trainings={trainings} />
    </Section>
  );
}

/** A decorative sound wave for the voice tile. */
function SoundWave() {
  const bars = [10, 18, 30, 22, 38, 26, 14, 34, 42, 24, 16, 28, 36, 20, 12, 26, 32, 18, 10];
  return (
    <div aria-hidden="true" className="mt-6 flex h-12 items-end gap-1 opacity-70">
      {bars.map((h, i) => (
        <span key={i} className="w-1 rounded-full bg-brain" style={{ height: `${h}px`, opacity: 0.35 + (h / 42) * 0.65 }} />
      ))}
    </div>
  );
}

function SkillTile({ s, used = [], wave = false, className = "" }) {
  const Icon = MODULE_ICON[s.module] ?? Boxes;
  const color = colorOf(s.module);
  return (
    <section
      aria-label={s.module}
      onPointerMove={spotlight}
      data-nav-id={`skills:${s.module}`}
      data-reticle
      className={`spot sticker glass rounded-[14px] p-5 ${className}`}
      style={{ borderTopColor: tint(color, 40) }}
    >
      <h3 className="mb-3 flex items-center gap-2 text-base font-semibold">
        <Icon size={16} style={{ color }} /> {s.module}
      </h3>
      <ModuleChips names={s.names} color={color} />
      {used.length > 0 && (
        <p className="mt-4 font-mono text-[11px] text-mute">
          Used in: <span className="text-ink/80">{used.join(" · ")}</span>
        </p>
      )}
      {wave && <SoundWave />}
    </section>
  );
}

/** Bento grid: one large tile with two beside it, then the remaining modules in a row of their own. Or the same data as an API. */
export function Skills() {
  const { data } = usePortfolio();
  const [view, setView] = useState("modules");
  const [lead, ...others] = data.skills;
  const side = others.slice(0, 2);
  const rest = others.slice(2);
  const places = [...data.projects, ...data.experience];
  const tile = (m, extra = {}) => <SkillTile key={m.module} s={m} used={usedIn(m, places)} {...extra} />;
  return (
    <Section id="skills" agent="brain" kicker="02 · skills" title="Agent modules" meta={`${data.skills.length} modules`}>
      <div className="mb-4 inline-flex rounded-[10px] border border-line p-0.5 font-mono text-xs" role="group" aria-label="Skills view">
        {[["modules", "Modules"], ["api", "API"]].map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-pressed={view === id}
            onClick={() => setView(id)}
            className={`rounded-lg px-3 py-1.5 ${view === id ? "bg-researcher/15 text-ink" : "text-mute hover:text-ink"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {view === "api" ? (
        <SkillsApi skills={data.skills} places={places} />
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-2">
            {lead && tile(lead, { className: "md:row-span-2 md:p-6", wave: true })}
            {side.map((m) => tile(m))}
          </div>
          {rest.length > 0 && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {rest.map((m) => tile(m))}
            </div>
          )}
        </>
      )}
    </Section>
  );
}

function ExperienceCard({ e }) {
  const ref = useRef(null);
  const onScreen = useOnScreen(ref);
  return (
    <article ref={ref} onPointerMove={spotlight} data-paused={onScreen ? "false" : "true"} data-nav-id={`experience:${e.id}`} data-reticle className="spot beam sticker glass rounded-2xl p-5">
      <ExperienceBody e={e} />
    </article>
  );
}

function ExperienceBody({ e }) {
  return (
    <>
      <div className="mb-2 flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-reviewer">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-reviewer" /> in progress · {e.org} · {e.period}
      </div>
      <h3 className="text-lg font-semibold leading-6">{e.title}</h3>
      {e.role && <p className="mb-3 text-sm text-mute">{e.role}</p>}
      <ul className="list-disc space-y-1.5 pl-5 text-sm leading-6 text-ink/85 marker:text-mute">
        {e.bullets.map((b) => <li key={b}>{b}</li>)}
      </ul>
      {e.stack.length > 0 && <div className="mt-4 flex flex-wrap gap-1.5">{e.stack.map((s) => <Chip key={s}>{s}</Chip>)}</div>}
    </>
  );
}

export function Experience() {
  const { data } = usePortfolio();
  return (
    <Section id="experience" agent="reviewer" kicker="03 · experience" title="Mission history" meta={`${data.experience.length} active`}>
      <ol className="relative space-y-5 border-l border-line pl-6">
        {data.experience.map((e) => (
          <li key={e.id} className="relative">
            <span aria-hidden="true" className="absolute -left-[31px] top-6 h-2.5 w-2.5 rounded-full bg-reviewer ring-4 ring-void" />
            <Depth>
              <ExperienceCard e={e} />
            </Depth>
          </li>
        ))}
      </ol>
      <JeepneyRoute education={data.education} trainings={data.trainings} experience={data.experience} />
    </Section>
  );
}

const COVER_COLORS = [AGENT_HEX.planner, AGENT_HEX.builder, AGENT_HEX.reviewer];

/** The cover reads as a short flow built from the project's own fields: the goal, who built it, and what came out. */
function ProjectCover({ p, tone }) {
  const steps = [
    ["Goal", p.goal],
    ["Built by", p.role],
    ["Result", p.result],
  ].filter(([, v]) => v);
  const tools = p.stack.slice(0, 4);
  return (
    <div role="group" aria-label={`${p.name}: goal, role and result`} className="flex h-full w-full flex-col justify-center gap-3 p-4">
      <ol className="flex items-stretch gap-1.5">
        {steps.map(([label, text], i) => (
          <li key={label} className="flex min-w-0 flex-1 items-center gap-1.5">
            <div className="h-full min-w-0 flex-1 rounded-lg border bg-panel/80 p-2.5" style={{ borderColor: tint(tone, 33) }}>
              <p className="font-mono text-[10px] uppercase tracking-wider" style={{ color: tone }}>{label}</p>
              <p className="mt-1 line-clamp-4 text-[11px] leading-4 text-ink/85">{text}</p>
            </div>
            {i < steps.length - 1 && <span aria-hidden="true" className="shrink-0 font-mono text-xs text-mute">→</span>}
          </li>
        ))}
      </ol>
      {tools.length > 0 && (
        <p className="flex flex-wrap gap-1.5">
          {tools.map((t) => <span key={t} className="rounded-full border border-line px-2 py-0.5 font-mono text-[10px] text-mute">{t}</span>)}
        </p>
      )}
    </div>
  );
}

function ProjectCard({ p, open, onToggle, highlighted, featured = false, tone = AGENT_HEX.planner }) {
  const ref = useRef(null);
  const reduced = useReducedMotionPref();
  useEffect(() => {
    if (!highlighted) return undefined;
    // wait for the card to finish expanding so it is centred at its final size
    const t = setTimeout(() => scrollToEl(ref.current, "center"), 350);
    return () => clearTimeout(t);
  }, [highlighted]);
  const trace = [
    ["Goal", p.goal],
    ["Role", p.role],
    ["Result", p.result],
  ].filter(([, v]) => v);
  return (
    <article ref={ref} data-reticle data-nav-id={`projects:${p.id}`} onPointerMove={spotlight} className={`spot sticker glass rounded-2xl ${open || featured ? "md:col-span-2" : ""} ${highlighted ? "glow-card" : ""}`}>
      <div className={`grid place-items-center overflow-hidden rounded-t-[14px] bg-raised ${featured ? "min-h-[12rem] md:h-56" : "min-h-[12rem]"}`}>
        {p.cover ? (
          <img src={p.cover} alt={`${p.name} screenshot`} loading="lazy" className="w-[85%] rounded-lg shadow-2xl ring-1 ring-rule/10" />
        ) : (
          <div className="h-full w-full">
            <ProjectCover p={p} tone={tone} />
          </div>
        )}
      </div>
      <button onClick={onToggle} aria-expanded={open} className="flex w-full items-start gap-3 p-5 text-left">
        <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-reviewer" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block font-mono text-[11px] uppercase tracking-wider text-reviewer">mission complete</span>
          <span className="block text-base font-semibold leading-6">{p.name}</span>
          <span className="block text-xs text-mute">{p.context}</span>
        </span>
        <ChevronDown size={18} className={`mt-1 shrink-0 text-mute transition ${open ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <ol className="relative space-y-2 border-t border-line px-5 py-4 font-mono text-xs">
              {/* the trace line draws itself down through the steps; each number lights as the line reaches it */}
              <motion.span
                aria-hidden="true"
                className="absolute bottom-6 left-[31px] top-6 w-px origin-top bg-researcher/50"
                initial={{ scaleY: reduced ? 1 : 0 }}
                animate={{ scaleY: 1 }}
                transition={{ duration: 0.2 + trace.length * 0.25, ease: "linear" }}
              />
              {trace.map(([k, v], i) => (
                <li key={k} className="flex gap-3">
                  <motion.span
                    className="relative z-[1] w-5 shrink-0 bg-panel text-researcher"
                    initial={{ opacity: 0.4 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: reduced ? 0 : 0.1 + i * 0.25 }}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </motion.span>
                  <span className="w-14 shrink-0 uppercase text-researcher">{k}</span>
                  <span className="min-w-0 font-sans text-sm leading-5 text-ink/90">{v}</span>
                </li>
              ))}
            </ol>
            {p.stack.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 px-5 pb-4">
                <span className="mr-1 font-mono text-[11px] uppercase text-mute">Tools</span>
                {p.stack.map((t) => <Chip key={t}>{t}</Chip>)}
              </div>
            )}
            {p.repo_url && (
              <a href={p.repo_url} target="_blank" rel="noreferrer" className="mx-5 mb-4 inline-flex items-center gap-1.5 text-xs text-researcher hover:underline">
                <Github size={13} /> View repository
              </a>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </article>
  );
}

export function Projects() {
  const { data } = usePortfolio();
  const focus = useApp((s) => s.focusProject);
  const rich = useRichMode();
  const [openId, setOpenId] = useState(null);
  const [asList, setAsList] = useState(false);
  useEffect(() => {
    if (!focus) return;
    setAsList(true); // the assistant opens a card in place, which needs the list
    setOpenId(focus);
  }, [focus]);
  const rail = rich && !asList;
  return (
    <Section id="projects" agent="builder" kicker="04 · projects" title="Completed missions" meta={`${data.projects.length} shipped`}>
      <DepartureBoard />
      {rich && (
        <button type="button" onClick={() => setAsList((v) => !v)} className="mb-4 font-mono text-xs text-mute underline underline-offset-4 hover:text-ink">
          {rail ? "View all as a list" : "View as a sliding rail"}
        </button>
      )}
      {rail ? (
        <ProjectRail
          projects={data.projects}
          next="bestiary"
          renderCard={(p, i) => (
            <ProjectCard p={p} featured tone={COVER_COLORS[i % COVER_COLORS.length]} open={false}
              onToggle={() => {
                // details open in the list, where a card has room to grow
                setAsList(true);
                setOpenId(p.id);
              }} />
          )}
        />
      ) : (
        <div className="grid items-start gap-4 md:grid-cols-2">
          {data.projects.map((p, i) => (
            <ProjectCard key={p.id} p={p} featured={i === 0} tone={COVER_COLORS[i % COVER_COLORS.length]} open={openId === p.id} highlighted={focus === p.id}
              onToggle={() => setOpenId((cur) => (cur === p.id ? null : p.id))} />
          ))}
        </div>
      )}
    </Section>
  );
}

export function Evolution() {
  const { data: evo } = useEvolution();
  const live = !!evo?.last_run_at;
  return (
    <Section id="evolution" agent="planner" kicker="06 · self-evolving" title="This site keeps itself current">
      <div className="grid gap-5 lg:grid-cols-2">
        <p className="text-sm leading-7 text-ink/85">
          {live ? "Every night a scheduled job reads" : "Coming soon: a nightly job will read"} Justin's <strong>public</strong> GitHub repos and draft updates from the commits.
          Nothing goes live until Justin approves it, drafts can't claim more than the commits show, and private or work repos are never read.
          When an update is approved, the site re-learns it so the AI assistant, the agents and this page all agree.
        </p>
        <Changelog />
      </div>
    </Section>
  );
}

/** linkedin.com/in/sales-justin-h-8808a7257 reads better as in/sales-justin-h */
const shortLinkedIn = (text) => text.replace(/^.*?\/in\//, "in/").replace(/-[0-9a-f]{8,}$/i, "");

export function Contact() {
  const { data } = usePortfolio();
  const { data: status } = useStatus();
  const bookingShown = useApp((s) => s.bookingShown);
  const c = data.profile.contacts;
  const abs = (u) => (/^https?:/.test(u) ? u : `https://${u}`);
  const rows = [
    [Mail, "Email", c.email, `mailto:${c.email}`],
    [Phone, "Phone", c.phone, `tel:${c.phone.replace(/\s/g, "")}`],
    [Linkedin, "LinkedIn", c.linkedin.replace(/^https?:\/\//, ""), abs(c.linkedin)],
    [Github, "GitHub", c.github.replace(/^https?:\/\//, ""), abs(c.github)],
  ];
  return (
    <Section id="contact" agent="researcher" kicker="08 · contact" meta="open" title="Talk to the real Justin">
      <div className="grid gap-5 md:grid-cols-2">
        <div className="rounded-[14px] border border-line bg-raised p-5 font-mono text-sm" role="group" aria-label="Contact channel">
          <p className="mb-3 text-reviewer">&gt; channel open</p>
          <ul className="space-y-2">
            {rows.map(([, label, text, href]) => (
              <li key={label} className="grid grid-cols-[6.75rem_minmax(0,1fr)] gap-x-2">
                <span className="text-mute">&gt; {label.toLowerCase()}:</span>
                <span className="min-w-0">
                  <a href={href} className="break-words text-researcher hover:underline">{label === "LinkedIn" ? shortLinkedIn(text) : text}</a>
                  {label === "LinkedIn" && <span className="hidden break-all text-[10px] text-mute sm:block">{text}</span>}
                </span>
              </li>
            ))}
            <li className="grid grid-cols-[6.75rem_minmax(0,1fr)] gap-x-2">
              <span className="text-mute">&gt; speaks:</span>
              <span>{(c.languages ?? []).join(", ")}</span>
            </li>
          </ul>
          <p className="mt-3 text-mute" aria-hidden="true">&gt; <span className="cursor-block">_</span></p>
        </div>
        <div className={`flex flex-col items-start justify-center gap-3 rounded-2xl border bg-panel p-5 ${bookingShown ? "border-reviewer" : "border-line"}`}>
          <p className="text-sm text-ink/85">Want to talk about automation, AI agents or a project? Book a call with Justin himself.</p>
          {status?.booking_url ? (
            <a href={status.booking_url} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-reviewer px-5 py-3 text-sm font-semibold text-void hover:brightness-110">
              <CalendarCheck size={18} /> Book a call
            </a>
          ) : (
            <a href={`mailto:${c.email}?subject=Booking%20a%20call`} className="inline-flex items-center gap-2 rounded-xl bg-reviewer px-5 py-3 text-sm font-semibold text-void hover:brightness-110">
              <CalendarCheck size={18} /> Book a call by email
            </a>
          )}
        </div>
      </div>
    </Section>
  );
}

/** Shown only when real quotes exist in the profile content. Nothing is invented. */
export function Testimonials() {
  const { data } = usePortfolio();
  const items = data.profile.testimonials ?? [];
  if (items.length === 0) return null;
  return (
    <Section id="testimonials" agent="planner" kicker="kind words" title="What people say">
      <div className="grid gap-4 md:grid-cols-2">
        {items.map((t) => (
          <figure key={t.name + t.quote} className="glass rounded-2xl p-5">
            <blockquote className="text-sm leading-6 text-ink/90">“{t.quote}”</blockquote>
            <figcaption className="mt-3 font-mono text-xs text-mute">
              {t.name}
              {t.role && <span> · {t.role}</span>}
            </figcaption>
          </figure>
        ))}
      </div>
    </Section>
  );
}
