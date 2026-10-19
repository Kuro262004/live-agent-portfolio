import { describe, expect, it } from "vitest";
import { deriveGraph } from "../src/features/mission/state";

const ev = (seq, agent, type, message = "") => ({
  mission_id: "m",
  seq,
  agent,
  type,
  message,
  timestamp: "2026-10-14T08:56:00+08:00",
});

describe("deriveGraph", () => {
  it("is idle with no events", () => {
    const g = deriveGraph([]);
    expect(Object.values(g.agents).every((a) => a.status === "idle")).toBe(true);
    expect(g.complete).toBe(false);
  });

  it("tracks the active agent and the handoff edge", () => {
    const g = deriveGraph([ev(1, "planner", "step_started", "planning"), ev(2, "planner", "step_done"), ev(3, "planner", "handoff")]);
    expect(g.agents.planner.status).toBe("done");
    expect(g.activeEdge).toBe("planner>researcher");
    const g2 = deriveGraph([ev(1, "planner", "handoff"), ev(2, "researcher", "step_started", "searching")]);
    expect(g2.agents.researcher).toEqual({ status: "active", message: "searching" });
    expect(g2.activeEdge).toBeNull();
  });

  it("sends work back to the builder on a reviewer handoff", () => {
    const g = deriveGraph([ev(1, "builder", "step_done"), ev(2, "reviewer", "step_progress", "needs a revision"), ev(3, "reviewer", "handoff")]);
    expect(g.agents.builder.status).toBe("active");
    expect(g.activeEdge).toBe("reviewer>builder");
  });

  it("marks completion and failure", () => {
    expect(deriveGraph([ev(1, "reviewer", "complete")]).complete).toBe(true);
    const f = deriveGraph([ev(1, "planner", "error", "boom")]);
    expect(f.failed).toBe(true);
    expect(f.agents.planner.status).toBe("error");
  });
});
