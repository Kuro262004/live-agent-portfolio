import { create } from "zustand";
import { scrollToEl } from "../lib/motion";
import { rememberSound, soundEnabled } from "../lib/sound";
import { applyTheme, initialTheme, rememberTheme } from "../lib/theme";

const startTheme = initialTheme();
applyTheme(startTheme);

/** Cross-feature UI state: the call can drive the page, and the page can hand a mission to the graph. */
export const useApp = create((set) => ({
  callOpen: false,
  /** The call panel shrinks to a small bar so whatever the AI opened stays visible. */
  callMinimized: false,
  openCall: () => set({ callOpen: true, callMinimized: false }),
  closeCall: () => set({ callOpen: false, callMinimized: false }),
  minimizeCall: () => set({ callMinimized: true }),
  restoreCall: () => set({ callMinimized: false }),

  /** The Ctrl/Cmd+K command palette. */
  paletteOpen: false,
  setPalette: (open) => set({ paletteOpen: open }),
  togglePalette: () => set((s) => ({ paletteOpen: !s.paletteOpen })),

  /** "dark" or "light": the visitor's choice, else the operating system's. */
  theme: startTheme,
  setTheme: (theme) => {
    applyTheme(theme);
    set({ theme });
  },
  toggleTheme: () =>
    set((s) => {
      const theme = s.theme === "dark" ? "light" : "dark";
      rememberTheme(theme);
      applyTheme(theme);
      return { theme };
    }),

  /** Bumped when the hero graph is clicked; Mission Control then starts a recorded run. */
  recordedRequest: 0,
  requestRecorded: () => set((s) => ({ recordedRequest: s.recordedRequest + 1 })),

  /** Which project card the assistant wants expanded. */
  /** How many visitors are on the site right now (live presence); null when the server can't be reached. */
  presenceCount: null,
  setPresenceCount: (presenceCount) => set({ presenceCount }),

  /** The one-line answer after ask-to-navigate ({ text, source }), shown briefly at the bottom. */
  navNote: null,
  setNavNote: (navNote) => set({ navNote }),
  focusProject: null,
  setFocusProject: (id) => set({ focusProject: id }),

  /** Mission currently shown in the graph (started from the form or by the assistant). */
  missionId: null,
  setMissionId: (id) => set({ missionId: id }),

  /** Template and answers the assistant chose; the mission form fills itself in from this. */
  prefill: null,
  setPrefill: (prefill) => set({ prefill }),

  /** The conversation, kept outside the panel so minimizing or remounting it never loses a reply. */
  messages: [],
  addMessage: (role, text) =>
    set((s) => ({
      messages: [...s.messages, { role, text }],
      // a fresh reply supersedes the mission progress line in the minimized bar
      missionLine: role === "ai" ? null : s.missionLine,
    })),
  /** Streaming: grow the newest message as text arrives, then settle it with the final text and its metrics. */
  updateLastMessage: (patch) =>
    set((s) => (s.messages.length ? { messages: [...s.messages.slice(0, -1), { ...s.messages.at(-1), ...patch }] } : s)),
  clearMessages: () => set({ messages: [], missionLine: null }),

  /** Live mission status ("Builder: Writing the deliverable"), shown in the minimized bar. */
  missionLine: null,
  setMissionLine: (missionLine) => set({ missionLine }),

  /** One large looping animation at a time: the hero constellation rests while the graph or the orb is busy. */
  missionRunning: false,
  setMissionRunning: (missionRunning) => set({ missionRunning }),
  callLive: false,
  setCallLive: (callLive) => set({ callLive }),

  /** Each agent's state in the mission on screen ("idle" | "thinking" | "done" | "error"), for the system rail. */
  agentStatus: {},
  setAgentStatus: (agentStatus) =>
    set((s) => {
      const keys = Object.keys(agentStatus);
      const same = keys.length === Object.keys(s.agentStatus).length && keys.every((k) => s.agentStatus[k] === agentStatus[k]);
      return same ? s : { agentStatus };
    }),

  /** True while the project carousel is pinned and sliding; the system rail fades so cards never pass under it. */
  carouselPinned: false,
  setCarouselPinned: (carouselPinned) => set((s) => (s.carouselPinned === carouselPinned ? s : { carouselPinned })),

  /** Below-the-fold effects wait for the boot intro, so two effects never compete at load. */
  bootDone: false,
  setBootDone: () => set({ bootDone: true }),

  /** Optional sound (off by default, remembered per visitor). */
  soundOn: soundEnabled(),
  toggleSound: () =>
    set((s) => {
      rememberSound(!s.soundOn);
      return { soundOn: !s.soundOn };
    }),

  /** Why the current mission is a recorded run: "limit" (visitor's daily runs) or "budget" (site-wide), else null. */
  runNotice: null,
  setRunNotice: (runNotice) => set({ runNotice }),

  /** Language the AI answers in: English, Filipino or Ilocano (non-English needs a live model on the server). */
  language: "English",
  setLanguage: (language) => set({ language }),

  bookingShown: false,
  showBooking: () => set({ bookingShown: true }),
}));

export function scrollToSection(id) {
  scrollToEl(document.getElementById(id), "start");
}
