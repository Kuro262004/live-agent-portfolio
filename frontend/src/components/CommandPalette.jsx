import { Command } from "cmdk";
import { useState } from "react";
import { jumpTo } from "../lib/motion";
import { resolveNav, runNav } from "../lib/navigate";
import { useGraphics } from "../lib/useRichMode";
import { useApp } from "../stores/app";

/**
 * Ctrl/⌘ + K: jump anywhere or run an action by typing. Loaded only the first time it is opened. Anything that isn't
 * a command can be asked in plain words ("show me his backend work"): the page goes there and the matching cards
 * light up.
 */
export default function CommandPalette() {
  const open = useApp((s) => s.paletteOpen);
  const setPaletteOpen = useApp((s) => s.setPalette);
  const [query, setQuery] = useState("");
  const [thinking, setThinking] = useState(false);
  const setOpen = (o) => {
    setPaletteOpen(o);
    if (!o) {
      setQuery("");
      setThinking(false);
    }
  };
  const ask = async () => {
    const q = query.trim();
    if (!q || thinking) return;
    setThinking(true);
    const result = await resolveNav(q);
    setOpen(false);
    if (result) runNav(result);
    else useApp.getState().setNavNote({ text: "I couldn't place that. Try “voice AI”, “backend” or “projects”.", source: null });
  };
  const openCall = useApp((s) => s.openCall);
  const requestRecorded = useApp((s) => s.requestRecorded);
  const theme = useApp((s) => s.theme);
  const toggleTheme = useApp((s) => s.toggleTheme);
  const setGraphics = useGraphics((s) => s.setMode);

  const section = (id, label) => ({ id, label, hint: "go to", run: () => jumpTo(id) });
  const commands = [
    section("mission", "mission control"),
    section("about", "about"),
    section("skills", "skills"),
    section("experience", "experience"),
    section("projects", "projects"),
    section("bestiary", "bug bestiary"),
    section("contact", "contact"),
    { id: "call", label: "call", hint: "open the call panel", run: openCall },
    {
      id: "task",
      label: "task",
      hint: "focus the mission form",
      run: () => {
        jumpTo("mission-live");
        setTimeout(() => document.querySelector("#mission-live input, #mission-live textarea")?.focus({ preventScroll: true }), 500);
      },
    },
    {
      id: "replay",
      label: "replay",
      hint: "play a recorded mission",
      run: () => {
        requestRecorded();
        jumpTo("mission-live");
      },
    },
    section("hire", "hire"),
    { id: "theme", label: theme === "dark" ? "theme light" : "theme dark", hint: "switch theme", run: toggleTheme },
    { id: "graphics-full", label: "graphics full", hint: "3D, shaders and scroll scenes", run: () => setGraphics("full") },
    { id: "graphics-lite", label: "graphics lite", hint: "the plain 2D site", run: () => setGraphics("lite") },
    { id: "graphics-auto", label: "graphics auto", hint: "let the device decide", run: () => setGraphics("auto") },
    { id: "plain", label: "plain", hint: "open the plain view", run: () => { window.location.href = "/plain/"; } },
  ];

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label="Command menu"
      overlayClassName="fixed inset-0 z-[70] bg-void/70 backdrop-blur-sm"
      contentClassName="fixed left-1/2 top-[16%] z-[71] w-[min(32rem,calc(100vw-2rem))] -translate-x-1/2 overflow-hidden rounded-[14px] border border-rule/10 bg-raised shadow-2xl"
    >
      <Command.Input value={query} onValueChange={setQuery} placeholder="Type a command, or ask: “show me his backend work”" className="w-full border-b border-line bg-transparent px-4 py-3 font-mono text-sm text-ink outline-none placeholder:text-mute" />
      <Command.List className="max-h-72 overflow-y-auto p-2">
        {query.trim().length <= 1 && (
          <Command.Empty className="px-3 py-6 text-center font-mono text-xs text-mute">No match. Try "projects" or "call", or ask in plain words.</Command.Empty>
        )}
        {commands.map((c) => (
          <Command.Item
            key={c.id}
            value={c.label}
            onSelect={() => {
              setOpen(false);
              setTimeout(c.run, 60);
            }}
            className="flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 font-mono text-sm text-ink data-[selected=true]:bg-researcher/15"
          >
            <span>{c.label}</span>
            <span className="text-[11px] text-mute">{c.hint}</span>
          </Command.Item>
        ))}
        {query.trim().length > 1 && (
          <Command.Item
            forceMount
            value={`ask ${query}`}
            onSelect={ask}
            className="flex cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2 font-mono text-sm text-ink data-[selected=true]:bg-researcher/15"
          >
            <span className="truncate">{thinking ? "thinking…" : `ask: “${query.trim()}”`}</span>
            <span className="shrink-0 text-[11px] text-mute">find it on the page</span>
          </Command.Item>
        )}
      </Command.List>
    </Command.Dialog>
  );
}
