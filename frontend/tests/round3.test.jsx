import { act, render, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Section from "../src/components/Section";
import BootIntro from "../src/components/BootIntro";
import CallDialog from "../src/features/call/CallDialog";
import { CommitGraph } from "../src/features/evolution/CommitGraph";
import { useReplay } from "../src/features/mission/useReplay";
import { rememberSound, soundEnabled } from "../src/lib/sound";
import { useApp } from "../src/stores/app";
import { renderWithQuery } from "./helpers";
import { chatStream, server } from "./server";

beforeEach(() => {
  useApp.setState({ callOpen: true, callMinimized: false, messages: [], missionLine: null, bootDone: false });
});

describe("text only is the chat experience, not a timed call", () => {
  it("shows the chat title, greeting and suggestion chips with no countdown", async () => {
    renderWithQuery(<CallDialog />);
    await userEvent.click(await screen.findByRole("button", { name: /text only/i }));
    expect(screen.getByText("Chat with Justin's AI")).toBeInTheDocument();
    expect(screen.getByText(/not Justin himself/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "What is AIKO?" })).toBeInTheDocument();
    expect(screen.queryByText(/chat time left|left$/)).toBeNull();
    expect(screen.getByRole("button", { name: /prefer to talk/i })).toBeInTheDocument();
  });

  it("sends a suggestion through the chat endpoint", async () => {
    let sent = null;
    server.use(
      http.post("*/api/chat/stream", async ({ request }) => {
        sent = await request.json();
        return chatStream("AIKO is an AI telephone operator.");
      }),
    );
    renderWithQuery(<CallDialog />);
    await userEvent.click(await screen.findByRole("button", { name: /text only/i }));
    await userEvent.click(screen.getByRole("button", { name: "What is AIKO?" }));
    expect(await screen.findByText("AIKO is an AI telephone operator.")).toBeInTheDocument();
    expect(sent.message).toBe("What is AIKO?");
  });
});

describe("pill during and after a mission", () => {
  it("offers a View button once the deliverable is ready", async () => {
    useApp.setState({ callMinimized: true, missionLine: "✓ Deliverable ready" });
    renderWithQuery(<CallDialog />);
    expect(await screen.findByText("✓ Deliverable ready")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View" })).toBeInTheDocument();
  });

  it("shows no View button while the agents are still working", async () => {
    useApp.setState({ callMinimized: true, missionLine: "Builder: Writing the deliverable" });
    renderWithQuery(<CallDialog />);
    await screen.findByText("Builder: Writing the deliverable");
    expect(screen.queryByRole("button", { name: "View" })).toBeNull();
  });
});

describe("headings wait for the boot intro", () => {
  afterEach(() => vi.useRealTimers());

  it("does not decode until the boot is done", () => {
    const original = window.matchMedia;
    window.matchMedia = (q) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} });
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame", "performance", "setTimeout", "clearTimeout"] });
    class IO {
      constructor(cb) {
        // report "visible" a tick later, after the observer variable exists
        setTimeout(() => cb([{ isIntersecting: true, target: document.body }]), 0);
      }
      observe() {}
      disconnect() {}
      unobserve() {}
    }
    const prev = globalThis.IntersectionObserver;
    globalThis.IntersectionObserver = IO;
    render(<Section id="s" kicker="k" title="Agent modules">x</Section>);
    act(() => vi.advanceTimersByTime(150));
    expect(screen.getByRole("heading", { name: "Agent modules" }).textContent).toBe("Agent modules"); // boot not done: real text
    act(() => useApp.getState().setBootDone());
    act(() => vi.advanceTimersByTime(150));
    expect(screen.getByRole("heading", { name: "Agent modules" }).textContent).not.toBe("Agent modules"); // now decoding
    act(() => vi.advanceTimersByTime(800));
    expect(screen.getByRole("heading", { name: "Agent modules" }).textContent).toBe("Agent modules");
    globalThis.IntersectionObserver = prev;
    window.matchMedia = original;
  });

  it("the boot intro finishes in about half a second so the whole intro is ~1.2 s", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const done = vi.fn();
    render(<BootIntro status={null} onDone={done} />);
    act(() => vi.advanceTimersByTime(500));
    expect(done).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(100));
    expect(done).toHaveBeenCalledTimes(1);
  });
});

describe("replay", () => {
  const ev = (seq, ms) => ({ mission_id: "m", seq, agent: "planner", type: "step_started", message: `s${seq}`, timestamp: new Date(Date.UTC(2026, 9, 14, 1, 0, 0, ms)).toISOString() });

  afterEach(() => vi.useRealTimers());

  it("re-plays the stored events in order with their original spacing, then returns to the live list", () => {
    vi.useFakeTimers();
    const events = [ev(1, 0), ev(2, 500), ev(3, 5000)];
    const { result } = renderHook(() => useReplay(events));
    expect(result.current.replaying).toBe(false);
    expect(result.current.events).toBe(events);
    act(() => result.current.start());
    expect(result.current.replaying).toBe(true);
    expect(result.current.events).toHaveLength(0);
    act(() => vi.advanceTimersByTime(130));
    expect(result.current.events.map((e) => e.seq)).toEqual([1]);
    act(() => vi.advanceTimersByTime(500));
    expect(result.current.events.map((e) => e.seq)).toEqual([1, 2]);
    act(() => vi.advanceTimersByTime(1200)); // the 4.5 s gap is capped at 1.2 s
    expect(result.current.events.map((e) => e.seq)).toEqual([1, 2, 3]);
    act(() => vi.advanceTimersByTime(600));
    expect(result.current.replaying).toBe(false);
  });

  it("can be stopped", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useReplay([ev(1, 0), ev(2, 400)]));
    act(() => result.current.start());
    act(() => result.current.stop());
    expect(result.current.replaying).toBe(false);
  });
});

describe("commit graph and sound", () => {
  it("draws one dot per changelog entry, hidden from screen readers", () => {
    const { container } = render(<CommitGraph commits={[{ id: 0, type: "release" }, { id: 1, type: "commit" }, { id: 2, type: "commit" }]} />);
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelectorAll("circle")).toHaveLength(3);
  });

  it("is off by default and remembers the visitor's choice", () => {
    localStorage.clear();
    expect(soundEnabled()).toBe(false);
    rememberSound(true);
    expect(soundEnabled()).toBe(true);
    rememberSound(false);
    expect(soundEnabled()).toBe(false);
  });

  it("survives blocked storage", () => {
    const spy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(soundEnabled()).toBe(false);
    spy.mockRestore();
  });

  it("the toggle flips the store flag", async () => {
    localStorage.clear();
    useApp.setState({ soundOn: false });
    useApp.getState().toggleSound();
    await waitFor(() => expect(useApp.getState().soundOn).toBe(true));
    useApp.getState().toggleSound();
    expect(useApp.getState().soundOn).toBe(false);
  });
});
