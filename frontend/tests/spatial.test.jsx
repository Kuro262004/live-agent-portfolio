import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import App from "../src/App";
import Section from "../src/components/Section";
import SystemRail from "../src/components/SystemRail";
import { RECORDED_RUN, STEPS } from "../src/features/mission/recorded";
import { decideRich, deviceIsCapable, useGraphics } from "../src/lib/useRichMode";
import { useApp } from "../src/stores/app";
import { renderWithQuery } from "./helpers";

describe("capability gate", () => {
  it("lets reduced motion win, then the visitor's choice, then the device", () => {
    expect(decideRich({ reduced: true, mode: "full", slow: false, capable: true })).toBe(false);
    expect(decideRich({ reduced: false, mode: "lite", slow: false, capable: true })).toBe(false);
    expect(decideRich({ reduced: false, mode: "full", slow: true, capable: false })).toBe(true);
    expect(decideRich({ reduced: false, mode: "auto", slow: false, capable: true })).toBe(true);
    expect(decideRich({ reduced: false, mode: "auto", slow: true, capable: true })).toBe(false); // too slow this visit
    expect(decideRich({ reduced: false, mode: "auto", slow: false, capable: false })).toBe(false);
  });

  it("treats a browser without matchMedia or WebGL2 as not capable", () => {
    expect(deviceIsCapable()).toBe(false);
  });

  it("remembers the visitor's graphics choice", () => {
    useGraphics.getState().setMode("lite");
    expect(localStorage.getItem("graphics")).toBe("lite");
    expect(useGraphics.getState().mode).toBe("lite");
    useGraphics.getState().setMode("auto");
    localStorage.removeItem("graphics");
  });
});

describe("lite mode", () => {
  it("renders the still backdrop and the plain Mission Control, with a graphics switch in the footer", async () => {
    const { container } = renderWithQuery(<App />);
    await screen.findByRole("heading", { level: 1, name: "Justin H. Sales" });
    expect(container.querySelector(".backdrop-lite")).not.toBeNull();
    expect(container.querySelector("#mission-scroll")).toBeNull();
    expect(container.querySelector("#mission-live")).not.toBeNull();
    const toggle = await screen.findByRole("button", { name: /graphics: lite/ });
    await userEvent.click(toggle);
    expect(useGraphics.getState().mode).toBe("full"); // asked for full; reduced motion (jsdom) still keeps it 2D
    useGraphics.getState().setMode("auto");
    localStorage.removeItem("graphics");
  });
});

describe("scroll mission", () => {
  it("walks one recorded run through every agent in order and ends complete", () => {
    expect(STEPS.map((s) => s.agent)).toEqual(["task", "planner", "researcher", "brain", "builder", "reviewer"]);
    const steps = RECORDED_RUN.map((e) => e.step);
    expect(steps).toEqual([...steps].sort((a, b) => a - b));
    expect(Math.max(...steps)).toBe(STEPS.length - 1);
    expect(RECORDED_RUN.at(-1).type).toBe("complete");
  });
});

describe("system rail", () => {
  it("shows each agent's real state and opens the palette from the section counter", async () => {
    act(() => useApp.getState().setAgentStatus({ planner: "done", researcher: "thinking", builder: "idle", reviewer: "idle" }));
    render(<SystemRail />);
    expect(screen.getByRole("complementary", { name: "System status" })).toBeInTheDocument();
    expect(screen.getByText("researcher: thinking")).toBeInTheDocument();
    expect(screen.getByText("planner: done")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /open the command palette/i }));
    expect(useApp.getState().paletteOpen).toBe(true);
    act(() => {
      useApp.getState().setPalette(false);
      useApp.getState().setAgentStatus({});
    });
  });
});

describe("sections", () => {
  it("name their owning agent for the reticle and keep the real title as the heading name", () => {
    const { container } = render(<Section id="s" agent="builder" kicker="04 · projects" title="Completed missions">x</Section>);
    expect(container.querySelector("section")).toHaveAttribute("data-agent", "builder");
    expect(screen.getByRole("heading", { level: 2, name: "Completed missions" })).toBeInTheDocument();
  });
});
