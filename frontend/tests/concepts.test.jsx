import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import BugBestiary from "../src/components/BugBestiary";
import CommandPalette from "../src/components/CommandPalette";
import DepartureBoard from "../src/components/DepartureBoard";
import { HirePR } from "../src/components/HirePR";
import Notifications from "../src/components/Notifications";
import PassportStamps from "../src/components/PassportStamps";
import SplitFlap from "../src/components/SplitFlap";
import { Skills } from "../src/components/Sections";
import { firstPart, usedIn } from "../src/lib/names";
import Receipt from "../src/features/mission/Receipt";
import { useApp } from "../src/stores/app";
import seed from "../src/content/seed.json";
import { renderWithQuery } from "./helpers";

const events = [
  { agent: "planner", type: "step_started", message: "Planning", timestamp: "2026-10-14T10:00:00.000+08:00" },
  { agent: "planner", type: "step_done", message: "Plan ready", timestamp: "2026-10-14T10:00:01.500+08:00" },
  { agent: "builder", type: "step_started", message: "Writing", timestamp: "2026-10-14T10:00:02.000+08:00" },
  { agent: "builder", type: "step_done", message: "Draft 1 written (466 words)", timestamp: "2026-10-14T10:00:04.000+08:00" },
  { agent: "reviewer", type: "step_started", message: "Checking", timestamp: "2026-10-14T10:00:04.100+08:00" },
  { agent: "reviewer", type: "step_done", message: "Approved: all sections present", timestamp: "2026-10-14T10:00:04.600+08:00" },
];

describe("departure board", () => {
  it("lists every project and job, with honest statuses and gates from the content", async () => {
    renderWithQuery(<DepartureBoard />);
    const board = await screen.findByRole("table", { name: /Departure board/ });
    expect(within(board).getAllByRole("row").length).toBe(1 + seed.projects.length + seed.experience.length);
    expect(within(board).getByRole("img", { name: "AIKO" })).toBeInTheDocument();
    expect(within(board).getAllByRole("img", { name: "COMPLETE" }).length).toBe(seed.projects.length);
    expect(within(board).getAllByRole("img", { name: "IN PROGRESS" }).length).toBe(seed.experience.length);
    expect(within(board).getByRole("img", { name: "Hackathon" })).toBeInTheDocument();
  });

  it("clicking a project row asks for that project card", async () => {
    useApp.setState({ focusProject: null });
    renderWithQuery(<DepartureBoard />);
    await userEvent.click((await screen.findAllByRole("row"))[1]);
    expect(useApp.getState().focusProject).toBe(seed.projects[0].id);
  });

  it("split-flap shows its full text immediately without motion", () => {
    render(<SplitFlap text="Complete" start />);
    expect(screen.getByRole("img", { name: "Complete" })).toHaveTextContent("COMPLETE");
  });
});

describe("mobile fixes", () => {
  it("the board uses short labels, one line per cell, and still reads the full text aloud", async () => {
    renderWithQuery(<DepartureBoard />);
    const board = await screen.findByRole("table");
    expect(within(board).getByRole("img", { name: "Hotel Scan-to-Order System" })).toHaveTextContent("HOTEL QR ORDER");
    expect(within(board).getAllByRole("img", { name: "IN PROGRESS" })[0]).toHaveTextContent("IN DEV");
    for (const cell of within(board).getAllByRole("img")) expect(cell.className).toContain("whitespace-nowrap");
  });

  it("notifications sit bottom-left on desktop and above the action bar on phones, never over the hero", () => {
    renderWithQuery(<Notifications />);
    const cls = screen.getByRole("status").className;
    expect(cls).toMatch(/bottom-4 left-4/);
    expect(cls).toMatch(/max-md:bottom-24/);
    expect(cls).not.toMatch(/\btop-/);
  });
});

describe("pull request hire card", () => {
  it("repeats only résumé claims and links to an email when there is no booking page", async () => {
    renderWithQuery(<HirePR />);
    expect(await screen.findByText(/wants to merge 1 commit/)).toBeInTheDocument();
    expect(screen.getByText(/Technical lead experience \(AIKO at GOLI Company\)/)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`${seed.projects.length} projects shipped`))).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Merge (Hire)" }).getAttribute("href")).toMatch(/^mailto:/);
  });
});

describe("thermal receipt", () => {
  it("summarizes each agent from the event stream, with a download barcode", () => {
    render(<Receipt events={events} id="m_ab12cd34" mode="Scripted demo" href="/api/missions/m_ab12cd34/download" />);
    const r = screen.getByRole("group", { name: /Receipt for mission/ });
    expect(r).toHaveTextContent("PLANNER Plan ready");
    expect(r).toHaveTextContent("1.5s");
    expect(r).toHaveTextContent("BUILDER Draft 1 written");
    expect(r).toHaveTextContent("REVIEWER Approved");
    expect(r).toHaveTextContent("TOTAL");
    expect(r).toHaveTextContent("4.6s");
    expect(r).toHaveTextContent("scripted demo");
    expect(within(r).getByRole("link", { name: "Download the deliverable" })).toHaveAttribute("href", "/api/missions/m_ab12cd34/download");
  });

  it("renders nothing without events", () => {
    const { container } = render(<Receipt events={[]} id="m_x" mode="Live run" href="#" />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("passport stamps", () => {
  it("makes a stamp for every training and for the degree, each with its full text", () => {
    render(<PassportStamps education={seed.education} trainings={seed.trainings} />);
    expect(screen.getAllByRole("img").length).toBe(seed.trainings.length + seed.education.length);
    expect(screen.getByRole("img", { name: /BS Information Technology · Ilocos Sur Polytechnic State College · May 2026/ })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Cybersecurity and Ethical Hacking · Great Eastern Hotel/ })).toBeInTheDocument();
    // the stamp itself carries a short label; the full sentence stays in the accessible name
    expect(screen.getByRole("img", { name: /Cybersecurity and Ethical Hacking/ })).toHaveTextContent("Cybersec · Quezon City · Nov 2024");
    expect(screen.getByRole("img", { name: /Agentic AI Bootcamp/ })).toHaveTextContent(/^Bayanaihan · Agentic AI$/);
  });
});

describe("first-visit notifications", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    sessionStorage.clear();
    window.matchMedia = (q) => ({ matches: q.includes("max-width") ? false : false, addEventListener() {}, removeEventListener() {} });
    useApp.setState({ bootDone: true });
  });
  afterEach(() => {
    vi.useRealTimers();
    delete window.matchMedia;
  });

  it("shows real changelog items once per session (not the 'Now building' line the hero already has), then dismisses them", async () => {
    const { unmount } = renderWithQuery(<Notifications />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1600);
    });
    const live = screen.getByRole("status");
    expect(live).toHaveTextContent(/Launched: plain view/);
    expect(live).not.toHaveTextContent("Now building");
    // one at a time: the next appears only after the first has gone
    expect(live).not.toHaveTextContent(/Mission Control: four templates/);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(6400);
    });
    expect(live).toHaveTextContent(/Mission Control: four templates/); // (jsdom keeps the faded-out one; browsers remove it)
    fireEvent.click(within(live).getAllByRole("button", { name: "Dismiss notification" })[0]);
    expect(sessionStorage.getItem("notified")).toBe("1");
    unmount();
    // a second mount in the same session shows nothing
    renderWithQuery(<Notifications />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("on phones, waits until the visitor scrolls past the hero so it never covers the hero buttons", async () => {
    window.matchMedia = (q) => ({ matches: q.includes("max-width"), addEventListener() {}, removeEventListener() {} });
    renderWithQuery(<Notifications />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
    expect(sessionStorage.getItem("notified")).toBeNull(); // not used up while it was waiting
    await act(async () => {
      window.scrollY = window.innerHeight + 10;
      window.dispatchEvent(new Event("scroll"));
      await vi.advanceTimersByTimeAsync(1600);
    });
    expect(screen.getByRole("status")).toHaveTextContent(/Launched: plain view/);
    window.scrollY = 0;
  });

  it("stays silent with reduced motion", async () => {
    delete window.matchMedia;
    renderWithQuery(<Notifications />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });
});

describe("command palette", () => {
  it("lists the commands from the guide", async () => {
    useApp.setState({ paletteOpen: true });
    render(<CommandPalette />);
    for (const name of ["projects", "skills", "experience", "contact", "call", "task", "replay", "hire", "plain"]) {
      expect(await screen.findByText(name, { selector: "span" })).toBeInTheDocument();
    }
    expect(screen.getByText(/theme (light|dark)/)).toBeInTheDocument();
    useApp.setState({ paletteOpen: false });
  });
});

describe("bug bestiary", () => {
  it("is collapsed until opened, then shows real bug cards", async () => {
    render(<BugBestiary />);
    expect(screen.queryByText("The Echo Wraith")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /open the bestiary/i }));
    expect(screen.getByText("The Echo Wraith")).toBeInTheDocument();
    expect(screen.getByText(/★ LEGENDARY/)).toBeInTheDocument();
    expect(screen.getAllByRole("article").length).toBeLessThanOrEqual(4);
  });
});

describe("skills API view", () => {
  it("shows the same data as JSON, including where the module was used", async () => {
    renderWithQuery(<Skills />);
    await userEvent.click(await screen.findByRole("button", { name: "API" }));
    expect(screen.getByText(/GET \/justin\/skills\?module=ai-voice/)).toBeInTheDocument();
    const json = (await screen.findAllByText(/"module": "AI & Voice"/))[0].textContent;
    const parsed = JSON.parse(json);
    expect(parsed.loaded).toBe(seed.skills[0].names.length);
    expect(parsed.used_in).toContain("AIKO");
    await userEvent.click(screen.getByRole("button", { name: "frontend" }));
    expect(screen.getByText(/module=frontend/)).toBeInTheDocument();
  });
});

describe("names helpers", () => {
  it("shortens names and finds where a module was used", () => {
    expect(firstPart("DamAiyan — AI System for Rural Health Units")).toBe("DamAiyan");
    expect(usedIn(seed.skills[0], [...seed.projects, ...seed.experience])).toEqual(expect.arrayContaining(["AIKO", "DamAiyan"]));
  });
});
