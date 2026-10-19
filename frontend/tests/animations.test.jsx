import { act, render, renderHook, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import BootIntro, { bootLines, shouldBoot } from "../src/components/BootIntro";
import Hero from "../src/components/Hero";
import Markdown from "../src/components/Markdown";
import MissionProgress from "../src/features/mission/MissionProgress";
import { deriveGraph } from "../src/features/mission/state";
import TypedLine from "../src/features/mission/TypedLine";
import { useDecode } from "../src/lib/useDecode";
import { renderWithQuery } from "./helpers";

const realMatchMedia = window.matchMedia;

/** Pretend the visitor has NOT asked for reduced motion (jsdom has no matchMedia, which the app treats as reduced). */
function motionOn() {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    addEventListener() {},
    removeEventListener() {},
  });
}

beforeEach(() => {
  sessionStorage.clear();
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "requestAnimationFrame", "cancelAnimationFrame", "performance"] });
});

afterEach(() => {
  vi.useRealTimers();
  window.matchMedia = realMatchMedia;
});

const ev = (seq, agent, type, message = "") => ({ mission_id: "m", seq, agent, type, message, timestamp: "2026-10-14T09:40:00+08:00" });

describe("useDecode", () => {
  it("is the real text straight away with reduced motion", () => {
    const { result } = renderHook(() => useDecode("Justin H. Sales"));
    expect(result.current).toBe("Justin H. Sales");
  });

  it("scrambles, then resolves to the text; waits for start", () => {
    motionOn();
    const { result, rerender } = renderHook(({ start }) => useDecode("Justin H. Sales", { duration: 700, start }), { initialProps: { start: false } });
    expect(result.current).toBe("Justin H. Sales"); // not started: never blank or garbled
    rerender({ start: true });
    act(() => vi.advanceTimersByTime(200));
    expect(result.current).not.toBe("Justin H. Sales");
    expect(result.current).toHaveLength("Justin H. Sales".length);
    expect(result.current[6]).toBe(" "); // spaces are kept
    act(() => vi.advanceTimersByTime(800));
    expect(result.current).toBe("Justin H. Sales");
  });
});

describe("hero name", () => {
  it("keeps the real name as the accessible name while it decodes", () => {
    motionOn();
    sessionStorage.setItem("bootSeen", "1"); // no boot, so the name is on screen decoding
    renderWithQuery(<Hero />);
    act(() => vi.advanceTimersByTime(100));
    const h1 = screen.getByRole("heading", { level: 1, name: "Justin H. Sales" });
    expect(h1).toHaveAttribute("aria-label", "Justin H. Sales");
    expect(h1.querySelector("[aria-hidden=true]")).not.toBeNull();
  });
});

describe("boot intro", () => {
  it("plays once per session and never with reduced motion", () => {
    expect(shouldBoot()).toBe(false); // jsdom: no matchMedia counts as reduced motion
    motionOn();
    expect(shouldBoot()).toBe(true);
    sessionStorage.setItem("bootSeen", "1");
    expect(shouldBoot()).toBe(false);
  });

  it("reports real state in its lines", () => {
    const scripted = bootLines({ llm: false, voice: { stt: false, tts: false } });
    expect(scripted).toContain("> agents: 4/4 ready (scripted)");
    expect(scripted).toContain("> voice: browser speech");
    const live = bootLines({ llm: true, voice: { stt: true, tts: true } });
    expect(live).toContain("> agents: 4/4 ready (live)");
    // a spent budget is said out loud, never shown as live
    expect(bootLines({ llm: true, fallback: true, voice: { stt: true, tts: true } })[1]).toMatch(/recorded runs/);
    expect(live.some((l) => l.includes("Whisper"))).toBe(true);
  });

  it("types its lines, finishes by itself in about a second, and skips on any key", () => {
    const onDone = vi.fn();
    render(<BootIntro status={{ llm: false, voice: { stt: false, tts: false } }} onDone={onDone} />);
    expect(screen.queryByText(/loading shared brain/)).toBeNull();
    act(() => vi.advanceTimersByTime(300));
    expect(screen.getByText(/loading shared brain/)).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(900));
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem("bootSeen")).toBe("1");

    const skipped = vi.fn();
    render(<BootIntro status={null} onDone={skipped} />);
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "a" }));
    });
    expect(skipped).toHaveBeenCalled();
  });
});

describe("agent node states", () => {
  it("flags a revision when the reviewer sends the draft back, and clears it when the builder restarts", () => {
    const sent = deriveGraph([ev(1, "builder", "step_done"), ev(2, "reviewer", "step_progress", "needs work"), ev(3, "reviewer", "handoff")]);
    expect(sent.agents.builder).toMatchObject({ status: "active", revision: true });
    const resumed = deriveGraph([ev(1, "reviewer", "handoff"), ev(2, "builder", "step_started", "Revising after notes")]);
    expect(resumed.agents.builder.revision).toBeUndefined();
  });
});

describe("mission progress bar", () => {
  it("fills finished segments and shimmers the active one", () => {
    const events = [ev(1, "planner", "step_started"), ev(2, "planner", "step_done"), ev(3, "researcher", "step_started")];
    const { container } = render(<MissionProgress events={events} />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "1");
    expect(container.querySelector("[data-segment=planner]")).toHaveAttribute("data-status", "done");
    expect(container.querySelector("[data-segment=researcher] .seg-active")).not.toBeNull();
    expect(container.querySelector("[data-segment=builder]")).toHaveAttribute("data-status", "idle");
  });
});

describe("typed log lines", () => {
  it("types the newest line but keeps the full text for screen readers; older lines are instant", () => {
    motionOn();
    const { container, rerender } = render(<TypedLine text="Checking past project patterns" animate cursor />);
    act(() => vi.advanceTimersByTime(20));
    const visible = container.querySelector("[aria-hidden=true]").textContent;
    expect(visible.length).toBeGreaterThan(0);
    expect(visible.length).toBeLessThan("Checking past project patterns".length);
    expect(container.querySelector(".sr-only").textContent).toBe("Checking past project patterns");
    expect(container.querySelector(".cursor-block")).not.toBeNull();
    act(() => vi.advanceTimersByTime(200));
    expect(container.querySelector("[aria-hidden=true]").textContent).toBe("Checking past project patterns");
    rerender(<TypedLine text="An older line" animate={false} />);
    expect(container.querySelector("[aria-hidden=true]").textContent).toBe("An older line");
  });
});

describe("deliverable printing", () => {
  it("still renders every block of the document while revealing", () => {
    motionOn();
    render(<Markdown reveal source={["# Plan", "", "## Goal", "Serve faster.", "", "- one", "- two"].join("\n")} />);
    expect(screen.getByRole("heading", { name: "Plan" })).toBeInTheDocument();
    expect(screen.getByText("Serve faster.")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });
});
