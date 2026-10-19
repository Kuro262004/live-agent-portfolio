import { motion, useScroll } from "framer-motion";
import { Menu, Moon, Phone, Sun, Volume2, VolumeX, X, Zap } from "lucide-react";
import { hasFinePointer, jumpTo } from "./lib/motion";
import { lazy, Suspense, useEffect, useState } from "react";
import Hero from "./components/Hero";
import Section from "./components/Section";
import { About, Contact, Evolution, Experience, Projects, Skills, Testimonials } from "./components/Sections";
import BugBestiary from "./components/BugBestiary";
import { HirePR } from "./components/HirePR";
import NavNote from "./components/NavNote";
import Notifications from "./components/Notifications";
import SystemRail from "./components/SystemRail";
import Backdrop from "./features/backdrop/Backdrop";
import NotFound from "./components/NotFound";
import MissionPanel from "./features/mission/MissionPanel";
import SharedMission from "./features/mission/SharedMission";
import Presence from "./features/presence/Presence";
import { manilaClock } from "./features/world/manilaLight";
import { useEvolution, useStatus } from "./lib/queries";
import { watchSystemTheme } from "./lib/theme";
import { useActiveSection } from "./lib/useActiveSection";
import { useGraphics, useRichMode } from "./lib/useRichMode";
import { useApp } from "./stores/app";

const AdminPage = lazy(() => import("./features/evolution/AdminPage"));
const CallDialog = lazy(() => import("./features/call/CallDialog"));
const CommandPalette = lazy(() => import("./components/CommandPalette"));
const ScrollMission = lazy(() => import("./features/mission/ScrollMission"));
const Reticle = lazy(() => import("./components/Reticle"));

const NAV = [
  ["mission", "Mission Control"],
  ["about", "About"],
  ["skills", "Skills"],
  ["experience", "Missions"],
  ["projects", "Projects"],
  ["contact", "Contact"],
];

const NAV_IDS = NAV.map(([id]) => id);

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform ?? "");

/** Ctrl/Cmd+K opens the command palette; its code loads the first time it is opened. */
function Palette() {
  const open = useApp((s) => s.paletteOpen);
  const toggle = useApp((s) => s.togglePalette);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle]);
  useEffect(() => {
    if (open) setLoaded(true);
  }, [open]);
  return loaded ? (
    <Suspense fallback={null}>
      <CommandPalette />
    </Suspense>
  ) : null;
}

function TopBar() {
  const [open, setOpen] = useState(false);
  const { scrollYProgress } = useScroll();
  const soundOn = useApp((s) => s.soundOn);
  const toggleSound = useApp((s) => s.toggleSound);
  const active = useActiveSection(NAV_IDS);
  const theme = useApp((s) => s.theme);
  const toggleTheme = useApp((s) => s.toggleTheme);
  const togglePalette = useApp((s) => s.togglePalette);
  const setTheme = useApp((s) => s.setTheme);
  useEffect(() => watchSystemTheme(setTheme), [setTheme]);
  return (
    <div className="sticky top-0 z-30 border-b border-line bg-void/85 pt-[env(safe-area-inset-top,0px)] backdrop-blur">
      <motion.div aria-hidden="true" style={{ scaleX: scrollYProgress, transformOrigin: "0 50%" }} className="absolute inset-x-0 top-0 h-0.5 bg-researcher" />
      <div aria-hidden="true" className="route-stripe absolute inset-x-0 -bottom-[2px] h-[2px]" />
      <nav className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-2.5" aria-label="Sections">
        <a href="#top" className="font-mono text-sm font-bold"><span className="plate">JHS</span><span className="ml-1.5 text-mute">/mission-control</span></a>
        <span className="flex-1" />
        <ul className="hidden gap-4 text-sm text-mute md:flex">
          {NAV.slice(1).map(([id, label]) => (
            <li key={id} className="relative">
              <a
                href={`#${id}`}
                aria-current={active === id ? "true" : undefined}
                onClick={(e) => {
                  e.preventDefault();
                  jumpTo(id);
                }}
                className={`hover:text-ink ${active === id ? "text-ink" : ""}`}
              >
                {label}
              </a>
              {active === id && (
                <motion.span layoutId="nav-active" aria-hidden="true" className="absolute inset-x-0 -bottom-1.5 h-0.5 rounded-full bg-researcher" transition={{ type: "spring", stiffness: 500, damping: 38 }} />
              )}
            </li>
          ))}
        </ul>
        <a href="/plain/" className="hidden text-sm text-mute hover:text-ink sm:inline">Plain view</a>
        <button
          onClick={togglePalette}
          aria-label="Open command menu"
          className="hidden items-center gap-1 rounded border border-line px-1.5 py-0.5 font-mono text-[11px] text-mute hover:text-ink md:inline-flex"
        >
          {isMac ? "⌘" : "Ctrl"} K
        </button>
        <button
          onClick={toggleTheme}
          aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          title={theme === "dark" ? "Light mode" : "Dark mode"}
          className="rounded p-1.5 text-mute hover:text-ink"
        >
          {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <button
          onClick={toggleSound}
          aria-pressed={soundOn}
          aria-label="Sound effects"
          title={soundOn ? "Sound on" : "Sound off"}
          className="rounded p-1.5 text-mute hover:text-ink"
        >
          {soundOn ? <Volume2 size={18} /> : <VolumeX size={18} />}
        </button>
        <button
          className="rounded p-1.5 text-mute hover:text-ink md:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          aria-controls="mobile-menu"
          onClick={() => setOpen((o) => !o)}
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </nav>
      {open && (
        <ul id="mobile-menu" className="mx-auto grid max-w-6xl gap-1 border-t border-line px-4 py-3 md:hidden">
          {[...NAV, ["/plain/", "Plain view"]].map(([id, label]) => (
            <li key={id}>
              <a
                href={id.startsWith("/") ? id : `#${id}`}
                onClick={(e) => {
                  setOpen(false);
                  if (!id.startsWith("/")) {
                    e.preventDefault();
                    jumpTo(id);
                  }
                }}
                className="block rounded-lg px-2 py-2 text-sm text-ink hover:bg-raised"
              >
                {label}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Footer line driven by /api/status: it shows scripted values until real keys are on, then live ones. */
function SystemStatus() {
  const { data: s } = useStatus();
  const { data: evo } = useEvolution();
  if (!s) return null;
  const live = !!s.llm && !s.fallback;
  const mode = live ? "live" : s.llm ? "recorded runs (daily AI budget used)" : "scripted";
  const voice = s.voice?.stt && s.voice?.tts ? "fish audio" : "browser";
  const evolved = evo?.last_evolved_at ? "recently" : "coming soon";
  return (
    <p className="mt-3 flex flex-wrap items-center gap-x-2 font-mono text-[11px]" aria-label="Site status">
      <span className={`h-1.5 w-1.5 rounded-full ${live ? "bg-reviewer" : "bg-builder"}`} aria-hidden="true" />
      <span>{mode}</span>
      <span aria-hidden="true">·</span>
      <span>4 agents</span>
      <span aria-hidden="true">·</span>
      <span>voice: {voice}</span>
      <span aria-hidden="true">·</span>
      <span>last evolved: {evolved}</span>
      <span aria-hidden="true">·</span>
      <GraphicsToggle />
      <span aria-hidden="true">·</span>
      <ManilaClock />
    </p>
  );
}

/** Justin's local time (the 3D sky follows it too), e.g. "🌙 Candon, 11:42 PM". */
function ManilaClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  return <span title="Justin's local time (Philippines)">{manilaClock(now)}</span>;
}

/** Footer switch between the 3D version and the plain 2D one; "auto" lets the device decide. */
function GraphicsToggle() {
  const rich = useRichMode();
  const mode = useGraphics((s) => s.mode);
  const setMode = useGraphics((s) => s.setMode);
  return (
    <button type="button" onClick={() => setMode(rich ? "lite" : "full")} className="underline-offset-2 hover:text-ink hover:underline" title="Switch graphics">
      graphics: {rich ? "full" : "lite"}
      {mode === "auto" ? " (auto)" : ""}
    </button>
  );
}

/** Phones only: the two main actions stay in thumb reach. Hidden while the chat panel is open. */
function ActionBar() {
  const callOpen = useApp((st) => st.callOpen);
  const openCall = useApp((st) => st.openCall);
  const { data: status } = useStatus();
  const [heroInView, setHeroInView] = useState(true);
  useEffect(() => {
    const el = document.getElementById("hero-actions");
    if (!el || typeof IntersectionObserver === "undefined") {
      setHeroInView(false);
      return undefined;
    }
    const io = new IntersectionObserver(([e]) => setHeroInView(e.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);
  if (callOpen || heroInView) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 flex gap-2 border-t border-rule/10 bg-void/90 p-3 pb-[max(12px,env(safe-area-inset-bottom))] backdrop-blur md:hidden">
      <button onClick={openCall} className="flex flex-1 items-center justify-center gap-2 rounded-[10px] bg-sun py-2.5 text-sm font-bold text-onsun">
        <Phone size={16} aria-hidden="true" /> {status?.fallback ? "Chat" : "Call"}
      </button>
      <button onClick={() => jumpTo("mission-live")} className="flex flex-1 items-center justify-center gap-2 rounded-[10px] bg-builder py-2.5 text-sm font-semibold text-void">
        <Zap size={16} aria-hidden="true" /> Task
      </button>
    </div>
  );
}

function Home() {
  const rich = useRichMode();
  const callOpen = useApp((s) => s.callOpen);
  const minimized = useApp((s) => s.callMinimized);
  // room for the docked panel so it never hides the last lines of the page (it is nearly full width on phones)
  const clearance = !callOpen ? "pb-24 max-md:pb-32" : minimized ? "pb-44" : "pb-44 max-sm:pb-[34rem]";
  return (
    <div id="top" className="min-h-screen text-ink">
      <Backdrop />
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-researcher focus:px-3 focus:py-2 focus:text-void">
        Skip to content
      </a>
      <TopBar />
      <main id="main" className={`mx-auto max-w-6xl px-4 ${clearance}`}>
        <Hero />
        <Section id="mission" agent="researcher" kicker="mission control" title="Watch the agents work">
          {rich && (
            <Suspense fallback={null}>
              <ScrollMission />
            </Suspense>
          )}
          <div id="mission-live" className="scroll-mt-20">
            <MissionPanel />
          </div>
        </Section>
        <About />
        <Testimonials />
        <Skills />
        <Experience />
        <Projects />
        <BugBestiary />
        <Evolution />
        <HirePR />
        <Contact />
        <footer className="border-t border-line pt-6 text-xs text-mute">
          © {new Date().getFullYear()} Justin H. Sales · Calls are transcribed and the audio is not kept · Mission input is limited and moderated · <a href="/privacy/" className="underline">Privacy</a>
          <SystemStatus />
        </footer>
      </main>
      <ActionBar />
      <SystemRail />
      {rich && hasFinePointer() && (
        <Suspense fallback={null}>
          <Reticle />
        </Suspense>
      )}
      <Palette />
      <Notifications />
      <NavNote />
      <Presence />
      <Suspense fallback={null}>
        <CallDialog />
      </Suspense>
    </div>
  );
}

export default function App() {
  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  const shell = (content) => <div className="min-h-screen bg-void text-ink">{content}</div>;
  if (path === "/admin") {
    return shell(
      <Suspense fallback={null}>
        <AdminPage />
      </Suspense>,
    );
  }
  const shared = /^\/m\/([A-Za-z0-9_-]{4,40})$/.exec(path);
  if (shared) return shell(<SharedMission id={shared[1]} />);
  if (path !== "/") return shell(<NotFound path={path} />);
  return <Home />;
}
