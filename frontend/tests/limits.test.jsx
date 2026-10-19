import { render, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import BootIntro from "../src/components/BootIntro";
import { BookCallLink, InfoNote } from "../src/components/InfoNote";
import { applyUiAction } from "../src/features/call/useCall";
import { scrollToEl } from "../src/lib/motion";
import { useApp } from "../src/stores/app";
import { renderWithQuery } from "./helpers";
import { server, status } from "./server";

beforeEach(() => useApp.setState({ runNotice: null, missionId: null, prefill: null, callMinimized: false }));
afterEach(() => vi.restoreAllMocks());

describe("limit messages are calm and give the visitor somewhere to go", () => {
  it("uses the info style, not the error style", () => {
    render(<InfoNote>You've used today's live runs.</InfoNote>);
    const note = screen.getByRole("status");
    expect(note.className).toMatch(/border-researcher/);
    expect(note.className).not.toMatch(/alert|red/);
  });

  it("links 'book a call' to the contact section when there is no booking URL", async () => {
    renderWithQuery(<BookCallLink />);
    const link = await screen.findByRole("link", { name: /book a call with the real Justin/i });
    expect(link).toHaveAttribute("href", "#contact");
  });

  it("links to the real booking page when one is configured", async () => {
    server.use(http.get("*/api/status", () => HttpResponse.json({ ...status, booking_url: "https://cal.com/justin" })));
    renderWithQuery(<BookCallLink />);
    const link = await screen.findByRole("link", { name: /book a call with the real Justin/i });
    await vi.waitFor(() => expect(link).toHaveAttribute("href", "https://cal.com/justin"));
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("an assistant-started mission that fell back to a recorded run tells the page why", () => {
    applyUiAction({ type: "start_mission", mission_id: "m_1", template_id: "workflow-audit", inputs: {}, replay: true, reason: "limit" });
    expect(useApp.getState().runNotice).toBe("limit");
    applyUiAction({ type: "start_mission", mission_id: "m_2", template_id: "workflow-audit", inputs: {}, replay: false, reason: null });
    expect(useApp.getState().runNotice).toBeNull();
  });
});

describe("boot backdrop", () => {
  it("is solid, so the hero text never shows through", () => {
    const { container } = render(<BootIntro status={null} onDone={() => {}} />);
    const overlay = container.firstChild;
    expect(overlay.className).toMatch(/\bbg-void\b/);
    expect(overlay.className).not.toMatch(/bg-void\//);
  });
});

describe("scrolling", () => {
  function fakeEl(top) {
    return { getBoundingClientRect: () => ({ top }), scrollIntoView: vi.fn() };
  }
  beforeEach(() => {
    window.matchMedia = (q) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} });
    Object.defineProperty(window, "innerHeight", { value: 900, configurable: true });
  });
  afterEach(() => {
    delete window.matchMedia;
  });

  it("glides for a short hop", () => {
    const el = fakeEl(600);
    scrollToEl(el, "center");
    expect(el.scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "center" });
  });

  it("jumps instantly for a long distance, in either direction", () => {
    for (const top of [4000, -4000]) {
      const el = fakeEl(top);
      scrollToEl(el);
      expect(el.scrollIntoView).toHaveBeenCalledWith({ behavior: "auto", block: "start" });
    }
  });

  it("is always instant with reduced motion", () => {
    window.matchMedia = (q) => ({ matches: true, media: q, addEventListener() {}, removeEventListener() {} });
    const el = fakeEl(300);
    scrollToEl(el);
    expect(el.scrollIntoView).toHaveBeenCalledWith({ behavior: "auto", block: "start" });
  });
});
