import { screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import Hero from "../src/components/Hero";
import { applyUiAction } from "../src/features/call/useCall";
import MissionPanel from "../src/features/mission/MissionPanel";
import { logLines, statusLine } from "../src/features/mission/state";
import { Evolution } from "../src/components/Sections";
import CallDialog from "../src/features/call/CallDialog";
import { useApp } from "../src/stores/app";
import { renderWithQuery } from "./helpers";
import { chatStream, server, status } from "./server";

beforeEach(() =>
  useApp.setState({ callOpen: true, callMinimized: false, focusProject: null, missionId: null, prefill: null, bookingShown: false }),
);

describe("page-driving actions from the assistant", () => {
  it("minimizes the call panel when it opens a section, so the section stays visible", () => {
    applyUiAction({ type: "open_section", section: "projects", item_id: "botpoints" });
    const s = useApp.getState();
    expect(s.focusProject).toBe("botpoints");
    expect(s.callMinimized).toBe(true);
  });

  it("starting a mission selects the template, remembers the answers and shows the graph", () => {
    applyUiAction({ type: "start_mission", mission_id: "m_1", template_id: "food-ordering-automation", inputs: { business: "my cafe" } });
    const s = useApp.getState();
    expect(s.missionId).toBe("m_1");
    expect(s.prefill).toEqual({ template_id: "food-ordering-automation", inputs: { business: "my cafe" } });
    expect(s.callMinimized).toBe(true);
  });

  it("fills the mission form from what the assistant chose", async () => {
    renderWithQuery(<MissionPanel />);
    await screen.findByLabelText(/describe your process/i);
    useApp.getState().setPrefill({ template_id: "food-ordering-automation", inputs: { business: "Kape Corner", channels: "chat" } });
    expect(await screen.findByLabelText("Business")).toHaveValue("Kape Corner");
    expect(screen.getByLabelText("Channels")).toHaveValue("chat");
    await waitFor(() => expect(useApp.getState().prefill).toBeNull());
  });
});

describe("honest status", () => {
  it("shows no 'last evolved' badge before the pipeline has ever run", async () => {
    server.use(
      http.get("*/api/evolution/status", () =>
        HttpResponse.json({ last_evolved_at: null, commits_learned: 0, latest_commit: null, repo: null }),
      ),
    );
    server.use(http.get("*/api/status", () => HttpResponse.json({ ...status, llm: true })));
    renderWithQuery(<Hero />);
    await screen.findByText("agents online");
    expect(screen.queryByText(/last evolved/i)).toBeNull();
  });

  it("hides 'agents online' when the API can't be reached", async () => {
    server.use(http.get("*/api/status", () => HttpResponse.error()));
    renderWithQuery(<Hero />);
    await screen.findByRole("heading", { name: "Justin H. Sales" });
    expect(screen.queryByText("agents online")).toBeNull();
  });
});

describe("log times", () => {
  it("are formatted from the ISO offset, not sliced out of the string", () => {
    const ev = { seq: 1, agent: "planner", type: "step_started", message: "x", timestamp: "2026-10-14T09:40:00+08:00" };
    const [line] = logLines([ev]);
    const expected = new Date("2026-10-14T09:40:00+08:00").toLocaleTimeString([], { hour12: false });
    expect(line.time).toBe(expected);
  });
});

describe("agents-online badge", () => {
  it("is hidden in scripted mode (no live model behind the agents)", async () => {
    renderWithQuery(<Hero />);
    await screen.findByRole("heading", { name: "Justin H. Sales" });
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByText("agents online")).toBeNull();
  });
});

describe("minimized call panel", () => {
  it("keeps the conversation after minimizing and expanding, and shows the latest reply", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    useApp.setState({ messages: [], missionLine: null });
    server.use(
      http.get("*/api/status", () => HttpResponse.json({ ...status, fallback: true })),
      http.post("*/api/chat/stream", () => chatStream("At GOLI Company he leads AIKO.", { actions: [{ type: "open_section", section: "experience" }] })),
    );
    renderWithQuery(<CallDialog />);
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText("Message"), "what is AIKO?");
    await user.keyboard("{Enter}");
    expect(await screen.findByText("At GOLI Company he leads AIKO.")).toBeInTheDocument();
    // the open_section action minimized the panel; the reply is now in the bar
    await waitFor(() => expect(useApp.getState().callMinimized).toBe(true));
    expect(screen.getByText("At GOLI Company he leads AIKO.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /expand panel/i }));
    expect(screen.getByText("what is AIKO?")).toBeInTheDocument();
    expect(screen.getByText("At GOLI Company he leads AIKO.")).toBeInTheDocument();
  });

  it("shows live mission status instead of a generic message", async () => {
    useApp.setState({ callOpen: true, callMinimized: true, messages: [], missionLine: "Builder: Writing the deliverable" });
    renderWithQuery(<CallDialog />);
    expect(await screen.findByText("Builder: Writing the deliverable")).toBeInTheDocument();
    expect(screen.queryByText(/expand it to keep chatting/i)).toBeNull();
  });
});

describe("statusLine", () => {
  const ev = (agent, type, message) => ({ seq: 1, agent, type, message, timestamp: "2026-10-14T09:40:00+08:00", mission_id: "m" });
  it("describes the current step, completion and failure", () => {
    expect(statusLine([])).toBeNull();
    expect(statusLine([ev("builder", "step_started", "Writing the deliverable")])).toBe("Builder: Writing the deliverable");
    expect(statusLine([ev("reviewer", "complete", "done")])).toBe("✓ Deliverable ready");
    expect(statusLine([ev("planner", "error", "boom")])).toMatch(/problem/);
  });
});

describe("self-evolving section wording", () => {
  it("says 'coming soon' until the nightly job has actually run", async () => {
    renderWithQuery(<Evolution />);
    expect(await screen.findByText(/Coming soon: a nightly job will read/)).toBeInTheDocument();
  });

  it("describes the nightly job once it has run", async () => {
    server.use(
      http.get("*/api/evolution/status", () =>
        HttpResponse.json({ last_evolved_at: null, last_run_at: new Date().toISOString(), commits_learned: 0, latest_commit: null, repo: null }),
      ),
    );
    renderWithQuery(<Evolution />);
    expect(await screen.findByText(/Every night a scheduled job reads/)).toBeInTheDocument();
  });
});
