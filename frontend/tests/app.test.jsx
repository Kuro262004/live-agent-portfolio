import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import Hero from "../src/components/Hero";
import { About, Contact, Projects, Skills } from "../src/components/Sections";
import MissionPanel from "../src/features/mission/MissionPanel";
import { useApp } from "../src/stores/app";
import { renderWithQuery } from "./helpers";
import { server, status } from "./server";

beforeEach(() => useApp.setState({ callOpen: false, focusProject: null, missionId: null, bookingShown: false }));

describe("hero", () => {
  it("shows the live evolution badge and the three actions", async () => {
    server.use(http.get("*/api/status", () => HttpResponse.json({ ...status, llm: true })));
    renderWithQuery(<Hero />);
    expect(screen.getByRole("heading", { name: "Justin H. Sales" })).toBeInTheDocument();
    expect(await screen.findByText("Last evolved 3 hours ago · 2 new commits learned")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /call my ai/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /give my agents a task/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /plain view/i })).toHaveAttribute("href", "/plain/");
  });

  it("turns the call button into text chat when the budget is hit", async () => {
    server.use(http.get("*/api/status", () => HttpResponse.json({ ...status, fallback: true, reason: "llm_tokens" })));
    renderWithQuery(<Hero />);
    expect(await screen.findByRole("button", { name: /chat with my ai/i })).toBeInTheDocument();
  });

  it("opens the call from the button", async () => {
    renderWithQuery(<Hero />);
    await userEvent.click(screen.getByRole("button", { name: /call my ai/i }));
    expect(useApp.getState().callOpen).toBe(true);
  });
});

describe("content sections (bundled content when the API is unreachable)", () => {
  it("lists projects and expands the one the assistant focuses", async () => {
    renderWithQuery(<Projects />);
    expect(screen.getByText("BOTPOINTS — Bottle Recycling Rewards")).toBeInTheDocument();
    useApp.getState().setFocusProject("botpoints");
    await waitFor(() => expect(screen.getByText(/IoT system rewarding disposal/)).toBeInTheDocument());
  });

  it("shows skills as agent modules", () => {
    renderWithQuery(<Skills />);
    expect(screen.getByRole("region", { name: "AI & Voice" })).toBeInTheDocument();
    expect(screen.getByText("Whisper")).toBeInTheDocument();
  });

  it("shows education, training and contact details", () => {
    renderWithQuery(
      <>
        <About />
        <Contact />
      </>,
    );
    expect(screen.getAllByText(/Ilocos Sur Polytechnic State College/).length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "justinsales76@gmail.com" })).toHaveAttribute("href", "mailto:justinsales76@gmail.com");
    expect(screen.queryByText(/^> phone:/)).not.toBeInTheDocument(); // the phone number is kept off the public site
  });
});

describe("mission form", () => {
  it("validates before sending and then starts a mission", async () => {
    let sent = null;
    server.use(
      http.post("*/api/missions", async ({ request }) => {
        sent = await request.json();
        return HttpResponse.json({ mission_id: "m_abc", replay: false }, { status: 201 });
      }),
    );
    renderWithQuery(<MissionPanel />);
    const user = userEvent.setup();
    await screen.findByLabelText(/describe your process/i);
    await user.click(screen.getByRole("button", { name: /run mission/i }));
    expect(await screen.findByText(/is required/i)).toBeInTheDocument();
    expect(sent).toBeNull();

    await user.type(screen.getByLabelText(/describe your process/i), "Copy orders");
    await user.click(screen.getByRole("button", { name: /run mission/i }));
    await waitFor(() => expect(sent).toEqual({ template_id: "workflow-audit", inputs: { process: "Copy orders" }, captcha: null, recorded: false }));
    await waitFor(() => expect(useApp.getState().missionId).toBe("m_abc"));
  });

  it("shows the server's rate-limit message", async () => {
    server.use(http.post("*/api/missions", () => HttpResponse.json({ detail: "Daily limit reached: 3 missions per visitor." }, { status: 429 })));
    renderWithQuery(<MissionPanel />);
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText(/describe your process/i), "Copy orders");
    await user.click(screen.getByRole("button", { name: /run mission/i }));
    expect(await screen.findByText(/Daily limit reached/)).toBeInTheDocument();
  });

  it("switches templates and resets the form", async () => {
    renderWithQuery(<MissionPanel />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("radio", { name: /Plan an AI ordering system/ }));
    const form = screen.getByRole("radio", { name: /Plan an AI ordering system/ }).closest("form");
    expect(within(form).getByLabelText("Business")).toBeInTheDocument();
    expect(within(form).getByLabelText("Channels").tagName).toBe("SELECT");
  });
});
