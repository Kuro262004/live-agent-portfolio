import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import CommandPalette from "../src/components/CommandPalette";
import Hero from "../src/components/Hero";
import NavNote from "../src/components/NavNote";
import CallDialog, { replyMeta } from "../src/features/call/CallDialog";
import TraceDrawer, { modeLabel } from "../src/features/mission/TraceDrawer";
import { pairSpans } from "../src/features/mission/state";
import { lightAt, manilaClock, manilaHour } from "../src/features/world/manilaLight";
import { streamChat } from "../src/lib/api";
import { keywordNav, resolveNav } from "../src/lib/navigate";
import { missionSchema } from "../src/lib/schemas";
import { edgeGlow, signalTool } from "../src/lib/worldBus";
import { useApp } from "../src/stores/app";
import { renderWithQuery } from "./helpers";
import { chatStream, server, status } from "./server";

const span = (over = {}) => ({
  span_id: "s1",
  agent: "researcher",
  started_at: "2026-10-19T05:00:00.000Z",
  ended_at: "2026-10-19T05:00:00.840Z",
  input: "workflow automation agentic AI",
  prompt_template: "researcher/v1: one shared-brain search per query",
  retrieved: [{ source: "experience/aiko", score: 0.82, excerpt: "voice ordering" }],
  output: "1 relevant pattern: experience/aiko",
  model: "shared brain (local hashed embeddings + keyword boost)",
  tokens_in: 0,
  tokens_out: 0,
  latency_ms: 5,
  cost_usd: null,
  mode: "local",
  recorded_mode: null,
  ...over,
});

describe("agent trace inspector", () => {
  it("keeps spans when a mission is loaded from the server", () => {
    const m = missionSchema.parse({
      mission_id: "m", template_id: "t", status: "complete", replay: false, result: null,
      events: [{ mission_id: "m", seq: 4, agent: "researcher", type: "span", message: "researcher trace", timestamp: "x", span: span() }],
    });
    expect(m.events[0].span.retrieved[0].source).toBe("experience/aiko");
  });

  it("pairs each span with the log line that reports its result, revisions included", () => {
    const lines = [
      { key: 1, agent: "reviewer", type: "step_started", message: "Checking" },
      { key: 2, agent: "reviewer", type: "step_progress", message: "Needs one revision" },
      { key: 5, agent: "reviewer", type: "step_started", message: "Checking" },
      { key: 6, agent: "reviewer", type: "step_done", message: "Accepted" },
    ];
    const spans = [span({ span_id: "a", agent: "reviewer", seq: 3 }), span({ span_id: "b", agent: "reviewer", seq: 7 })];
    const paired = pairSpans(lines, spans);
    expect(paired.find((l) => l.key === 2).span.span_id).toBe("a");
    expect(paired.find((l) => l.key === 6).span.span_id).toBe("b");
    expect(paired.find((l) => l.key === 1).span).toBeUndefined();
  });

  it("never passes scripted or recorded numbers off as live", () => {
    expect(modeLabel(span({ mode: "live" }))).toBe("live model");
    expect(modeLabel(span({ mode: "scripted" }))).toMatch(/scripted/);
    expect(modeLabel(span({ mode: "recorded", recorded_mode: "scripted" }))).toMatch(/^recorded run · scripted/);
  });

  it("shows input, memory with scores and metrics in tabs, and a timeline that switches spans", async () => {
    const onPick = vi.fn();
    const planner = span({ span_id: "s0", agent: "planner", started_at: "2026-10-19T04:59:59.000Z", ended_at: "2026-10-19T05:00:00.000Z", mode: "scripted", retrieved: [] });
    render(<TraceDrawer span={span()} spans={[planner, span()]} onClose={() => {}} onPick={onPick} />);
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/span 2 of 2/)).toBeInTheDocument();
    expect(within(dialog).getByText("1 relevant pattern: experience/aiko")).toBeInTheDocument(); // output tab first
    await userEvent.click(screen.getByRole("tab", { name: "memory" }));
    expect(screen.getByText("0.82")).toBeInTheDocument();
    expect(screen.getByText(/“voice ordering”/)).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("tab", { name: "memory" }), { key: "ArrowRight" }); // arrow keys move between tabs
    expect(screen.getByRole("tab", { name: "output" })).toHaveAttribute("aria-selected", "true");
    await userEvent.click(screen.getByRole("tab", { name: "metrics" }));
    expect(screen.getByText("none (no model call)")).toBeInTheDocument();
    expect(screen.getByText("5 ms")).toBeInTheDocument();
    await userEvent.click(within(screen.getByRole("list", { name: "Span timeline" })).getByRole("button", { name: /planner/ }));
    expect(onPick).toHaveBeenCalledWith(planner);
  });

  it("says 'price not set' for a live call without a configured price", async () => {
    render(<TraceDrawer span={span({ mode: "live", model: "groq:m1", tokens_in: 1240, tokens_out: 310 })} spans={[span()]} onClose={() => {}} onPick={() => {}} />);
    await userEvent.click(screen.getByRole("tab", { name: "metrics" }));
    expect(screen.getByText("1,240 in · 310 out")).toBeInTheDocument();
    expect(screen.getByText("price not set")).toBeInTheDocument();
  });
});

describe("streaming chat", () => {
  it("reads tokens and tool events as they arrive and returns the done payload", async () => {
    server.use(http.post("*/api/chat/stream", () => chatStream("AIKO answers calls.", { tools: ["search_portfolio"], live: true })));
    const tokens = [];
    const tools = [];
    const done = await streamChat("what is AIKO", [], "English", { onToken: (t) => tokens.push(t), onTool: (n) => tools.push(n) });
    expect(tokens.join("")).toBe("AIKO answers calls.");
    expect(tools).toEqual(["search_portfolio"]);
    expect(done.mode).toBe("live");
  });

  it("labels each reply with what answered it, honestly", () => {
    expect(replyMeta({ mode: "offline" })).toBe("scripted answer · no AI model");
    expect(replyMeta({ mode: "live", model: "groq:llama", ms: 840, tokens_in: 1240, tokens_out: 310, cost_usd: null })).toBe("live · llama · 840 ms · 1240 in · 310 out");
  });

  it("shows the streamed reply in the chat panel with its metrics line", async () => {
    useApp.setState({ messages: [], callOpen: true, callMinimized: false });
    server.use(
      http.get("*/api/status", () => HttpResponse.json({ ...status, fallback: true })),
      http.post("*/api/chat/stream", () => chatStream("He builds voice AI.", { tools: ["search_portfolio"] })),
    );
    renderWithQuery(<CallDialog />);
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText("Message"), "voice?{Enter}");
    expect(await screen.findByText("He builds voice AI.")).toBeInTheDocument();
    expect(screen.getByText("scripted answer · no AI model")).toBeInTheDocument();
  });
});

describe("voice-reactive network bus", () => {
  it("lights the edge a tool uses for a moment and returns its caption", () => {
    vi.spyOn(performance, "now").mockReturnValue(1000);
    expect(signalTool("search_portfolio", 1200)).toBe("searching the portfolio…");
    expect(edgeGlow("researcher", "brain", 1100)).toBe(1); // either direction
    expect(edgeGlow("brain", "researcher", 2300)).toBe(0);
    expect(signalTool("end_call")).toBeNull();
    vi.restoreAllMocks();
  });
});

describe("ask-to-navigate", () => {
  it("maps plain words to sections and cards without claiming facts", () => {
    expect(keywordNav("show me his backend work")).toMatchObject({ section: "skills", highlight: ["skills:Backend"], source: "keyword match" });
    expect(keywordNav("anything with voice AI?")).toMatchObject({ section: "experience", highlight: ["experience:aiko"] });
    expect(keywordNav("rural health")).toMatchObject({ section: "projects", highlight: ["projects:damaiyan"] });
    expect(keywordNav("zzzz")).toBeNull();
  });

  it("uses the live answer when the server has one, and the keyword map when it hands back", async () => {
    server.use(http.post("*/api/navigate", () => HttpResponse.json({ section: "contact", highlight: [], say: "Here's how to reach him.", model: "groq:m" })));
    expect(await resolveNav("how do I reach him")).toMatchObject({ section: "contact", source: "live AI" });
    server.use(http.post("*/api/navigate", () => HttpResponse.json({ fallback: true })));
    expect(await resolveNav("backend")).toMatchObject({ section: "skills", source: "keyword match" });
    server.use(http.post("*/api/navigate", () => HttpResponse.error()));
    expect(await resolveNav("backend")).toMatchObject({ section: "skills" });
  });

  it("asks from the command palette and shows where the answer came from", async () => {
    server.use(http.post("*/api/navigate", () => HttpResponse.json({ fallback: true })));
    useApp.setState({ paletteOpen: true, navNote: null });
    render(
      <>
        <CommandPalette />
        <NavNote />
      </>,
    );
    const user = userEvent.setup();
    await user.type(screen.getByRole("combobox"), "show me his backend work");
    expect(screen.getByRole("option", { name: /ask: “show me his backend work”/ })).toBeInTheDocument();
    await user.keyboard("{Enter}");
    expect(await screen.findByText("Here are his backend skills.")).toBeInTheDocument();
    expect(screen.getByText("· keyword match")).toBeInTheDocument();
    await waitFor(() => expect(useApp.getState().paletteOpen).toBe(false));
  });

  it("still runs a typed command instantly", async () => {
    useApp.setState({ paletteOpen: true });
    render(<CommandPalette />);
    await userEvent.type(screen.getByRole("combobox"), "call");
    // the command is first, so Enter runs it rather than asking
    expect(screen.getAllByRole("option")[0]).toHaveTextContent("call");
  });
});

describe("Philippine time", () => {
  it("reads the hour in Manila whatever the visitor's zone, and says sun or moon", () => {
    const d = new Date("2026-10-19T15:42:00Z"); // 11:42 PM in Manila (UTC+8)
    expect(manilaHour(d)).toBeCloseTo(23.7, 1);
    expect(manilaClock(d)).toBe("🌙 Candon, 11:42 PM");
    expect(manilaClock(new Date("2026-10-19T02:05:00Z"))).toBe("☀️ Candon, 10:05 AM");
  });

  it("blends the sky between its key hours", () => {
    expect(lightAt(9).stars).toBe(0);
    expect(lightAt(0).stars).toBe(1);
    const dawn = lightAt(7.5);
    expect(dawn.stars).toBeGreaterThan(0);
    expect(dawn.stars).toBeLessThan(0.4);
  });
});

describe("live presence", () => {
  it("says how many people are watching only when you aren't alone", async () => {
    act(() => useApp.setState({ presenceCount: 1 }));
    renderWithQuery(<Hero />);
    await screen.findByRole("heading", { level: 1 });
    expect(screen.queryByText(/people watching the agents/)).toBeNull();
    act(() => useApp.setState({ presenceCount: 3 }));
    expect(screen.getByText("3 people watching the agents")).toBeInTheDocument();
    act(() => useApp.setState({ presenceCount: null }));
  });
});
