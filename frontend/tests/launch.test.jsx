import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../src/App";
import Hero from "../src/components/Hero";
import { Testimonials } from "../src/components/Sections";
import CallDialog from "../src/features/call/CallDialog";
import MissionPanel from "../src/features/mission/MissionPanel";
import ShareButton from "../src/features/mission/ShareButton";
import { track } from "../src/lib/analytics";
import { seedPortfolio } from "../src/lib/api";
import { useApp } from "../src/stores/app";
import { personJsonLd, robotsTxt, seoTags, siteUrl, sitemapXml } from "../scripts/seo.mjs";
import seed from "../src/content/seed.json";
import { renderWithQuery } from "./helpers";
import { chatStream, server } from "./server";

const portfolioWith = (extra) => ({ ...seed, profile: { ...seed.profile, ...extra } });
const usePortfolioResponse = (data) => server.use(http.get("*/api/profile", () => HttpResponse.json(data)));

beforeEach(() => useApp.setState({ callOpen: false, runNotice: null, missionId: null, language: "English", messages: [] }));
afterEach(() => {
  window.history.pushState({}, "", "/");
  vi.restoreAllMocks();
});

describe("routing", () => {
  it("shows a stack-trace 404 for unknown URLs, with a way home", () => {
    window.history.pushState({}, "", "/definitely/not/here");
    renderWithQuery(<App />);
    expect(screen.getByRole("heading", { name: "PageNotFoundError" })).toBeInTheDocument();
    expect(screen.getByText(/\/definitely\/not\/here/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /return to mission control/i })).toHaveAttribute("href", "/");
  });

  it("shows a shared plan at /m/<id>", async () => {
    server.use(
      http.get("*/api/missions/abc123def", () =>
        HttpResponse.json({ mission_id: "abc123def", template_id: "hotel-self-service", status: "complete", replay: false, events: [],
          result: { title: "Guest self-service plan", markdown: "# Guest self-service plan — Seaview Inn\n\n## Goal\nHelp guests order." } }),
      ),
    );
    window.history.pushState({}, "", "/m/abc123def");
    renderWithQuery(<App />);
    expect(await screen.findByRole("heading", { name: /Seaview Inn/ })).toBeInTheDocument();
    expect(screen.getByText(/Planned by Justin's AI agents/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /run your own mission/i })).toBeInTheDocument();
  });

  it("explains a shared link that no longer exists", async () => {
    window.history.pushState({}, "", "/m/gone1234");
    renderWithQuery(<App />);
    expect(await screen.findByText("This plan isn't available")).toBeInTheDocument();
  });

  it("links to the privacy page from the footer", () => {
    renderWithQuery(<App />);
    expect(screen.getByRole("link", { name: "Privacy" })).toHaveAttribute("href", "/privacy/");
  });
});

describe("recorded run on demand", () => {
  it("posts recorded:true with no details and remembers why it is a recorded run", async () => {
    let sent = null;
    server.use(
      http.post("*/api/missions", async ({ request }) => {
        sent = await request.json();
        return HttpResponse.json({ mission_id: "m_rec", replay: true, reason: "recorded" }, { status: 201 });
      }),
    );
    renderWithQuery(<MissionPanel />);
    await userEvent.click(await screen.findByRole("button", { name: /watch a recorded run/i }));
    await waitFor(() => expect(sent).toEqual({ template_id: "workflow-audit", inputs: {}, captcha: null, recorded: true }));
    await waitFor(() => expect(useApp.getState().runNotice).toBe("recorded"));
    expect(useApp.getState().missionId).toBe("m_rec");
    expect(await screen.findByRole("button", { name: "Replaying…" })).toBeInTheDocument();
  });
});

describe("sharing a deliverable", () => {
  it("copies a link to /m/<id>", async () => {
    const writeText = vi.fn().mockResolvedValue();
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    render(<ShareButton id="m_abc" />);
    await userEvent.click(screen.getByRole("button", { name: /share/i }));
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/m/m_abc`);
    expect(await screen.findByText("Link copied")).toBeInTheDocument();
  });

  it("shows the link to copy by hand when the clipboard is blocked", async () => {
    Object.defineProperty(navigator, "clipboard", { value: { writeText: vi.fn().mockRejectedValue(new Error("blocked")) }, configurable: true });
    render(<ShareButton id="m_abc" />);
    await userEvent.click(screen.getByRole("button", { name: /share/i }));
    expect(await screen.findByLabelText("Link to this plan")).toHaveValue(`${window.location.origin}/m/m_abc`);
  });
});

describe("answer language", () => {
  it("sends the chosen language with the chat message", async () => {
    let sent = null;
    server.use(
      http.post("*/api/chat/stream", async ({ request }) => {
        sent = await request.json();
        return chatStream("Ok");
      }),
    );
    useApp.setState({ callOpen: true });
    renderWithQuery(<CallDialog />);
    await userEvent.click(await screen.findByRole("button", { name: /text only/i }));
    await userEvent.selectOptions(screen.getByLabelText("Answer language"), "Ilocano");
    expect(screen.getByText(/needs the live AI model/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "What is AIKO?" }));
    await waitFor(() => expect(sent).toMatchObject({ message: "What is AIKO?", language: "Ilocano" }));
  });
});

describe("owner-supplied content: shown when it exists, hidden when it doesn't (nothing invented)", () => {
  it("shows the 'now building' line from the profile", async () => {
    usePortfolioResponse(portfolioWith({ now_building: "AIKO's voice stack at GOLI." }));
    renderWithQuery(<Hero />);
    expect(await screen.findByText(/AIKO's voice stack at GOLI\./)).toBeInTheDocument();
    expect(screen.getByText(/Now building/)).toBeInTheDocument();
  });

  it("hides the stats strip and testimonials when there are none", async () => {
    usePortfolioResponse(portfolioWith({ stats: [], testimonials: [] }));
    renderWithQuery(
      <>
        <Hero />
        <Testimonials />
      </>,
    );
    await screen.findByRole("heading", { level: 1 });
    expect(screen.queryByLabelText("Results")).toBeNull();
    expect(screen.queryByText("What people say")).toBeNull();
  });

  it("renders stats and a testimonial when the owner adds them", async () => {
    usePortfolioResponse(portfolioWith({ stats: [{ value: "4", label: "LLMs integrated" }], testimonials: [{ quote: "Reliable and fast.", name: "A mentor", role: "Bootcamp" }] }));
    renderWithQuery(
      <>
        <Hero />
        <Testimonials />
      </>,
    );
    expect(await screen.findByText("LLMs integrated")).toBeInTheDocument();
    expect(await screen.findByText(/Reliable and fast\./)).toBeInTheDocument();
    expect(screen.getByText(/A mentor/)).toBeInTheDocument();
  });

  it("the bundled seed content validates with the new optional fields", () => {
    expect(seedPortfolio.profile.now_building).toMatch(/AIKO/);
    expect(seedPortfolio.profile.stats).toEqual([]);
    expect(seedPortfolio.profile.testimonials).toEqual([]);
  });
});

describe("search and sharing metadata", () => {
  const site = "https://justin.example";

  it("builds Open Graph and Twitter cards with an absolute 1200x630 image", () => {
    const tags = seoTags(seed, { site });
    expect(tags).toContain('<meta property="og:image" content="https://justin.example/og.png" />');
    expect(tags).toContain('content="1200"');
    expect(tags).toContain('content="630"');
    expect(tags).toContain('<meta name="twitter:card" content="summary_large_image" />');
    expect(tags).toContain('<link rel="canonical" href="https://justin.example/" />');
  });

  it("emits a JSON-LD Person without contact details", () => {
    const ld = JSON.parse(personJsonLd(seed, site));
    expect(ld["@type"]).toBe("Person");
    expect(ld.name).toBe("Justin H. Sales");
    expect(ld.jobTitle).toMatch(/AI Automation/);
    expect(ld.sameAs).toEqual(["https://github.com/Kuro262004", "https://linkedin.com/in/sales-justin-h-8808a7257"]);
    expect(JSON.stringify(ld)).not.toMatch(/@gmail|\+63/);
  });

  it("works without a known site URL: relative image, no canonical", () => {
    const tags = seoTags(seed, { site: "" });
    expect(tags).toContain('content="/og.png"');
    expect(tags).not.toContain("canonical");
  });

  it("adds Plausible only when a domain is configured", () => {
    expect(seoTags(seed, {})).not.toContain("plausible");
    expect(seoTags(seed, { plausibleDomain: "justin.example" })).toContain('data-domain="justin.example"');
  });

  it("derives the site URL from VITE_SITE_URL or Vercel", () => {
    expect(siteUrl({ VITE_SITE_URL: "https://a.example/" })).toBe("https://a.example");
    expect(siteUrl({ VERCEL_PROJECT_PRODUCTION_URL: "portfolio.vercel.app" })).toBe("https://portfolio.vercel.app");
    expect(siteUrl({})).toBe("");
  });

  it("writes real robots.txt and sitemap.xml content", () => {
    expect(robotsTxt(site)).toContain("Sitemap: https://justin.example/sitemap.xml");
    expect(robotsTxt(site)).toContain("Disallow: /admin");
    expect(robotsTxt("")).not.toContain("Sitemap");
    const xml = sitemapXml(site, new Date("2026-10-14T00:00:00Z"));
    expect(xml).toContain("<loc>https://justin.example/</loc>");
    expect(xml).toContain("<loc>https://justin.example/plain/</loc>");
    expect(xml).toContain("<lastmod>2026-10-14</lastmod>");
  });
});

describe("static files", () => {
  const file = (p) => readFileSync(resolve(process.cwd(), "public", p), "utf8");

  it("has a real 404 page, a privacy page, a manifest and robots.txt", () => {
    expect(file("404.html")).toContain("PageNotFoundError");
    expect(file("404.html")).toContain("3 more frames");
    expect(file("robots.txt")).toMatch(/User-agent: \*/);
    const manifest = JSON.parse(file("manifest.webmanifest"));
    expect(manifest.icons.map((i) => i.sizes)).toEqual(expect.arrayContaining(["192x192", "512x512"]));
    const privacy = file("privacy/index.html");
    expect(privacy).toMatch(/No audio and no transcript is stored/);
    expect(privacy).toMatch(/IP address/);
    expect(privacy).toMatch(/Shared plans/);
  });

  it("ships the share image and icons as real PNGs (1200x630 for og.png)", () => {
    const png = (p) => readFileSync(resolve(process.cwd(), "public", p));
    const og = png("og.png");
    expect(og.subarray(1, 4).toString()).toBe("PNG");
    expect(og.readUInt32BE(16)).toBe(1200);
    expect(og.readUInt32BE(20)).toBe(630);
    expect(png("icon-512.png").readUInt32BE(16)).toBe(512);
    expect(png("apple-touch-icon.png").readUInt32BE(16)).toBe(180);
  });

  it("the share image only claims things that are live", () => {
    const html = readFileSync(resolve(process.cwd(), "scripts/og.html"), "utf8");
    expect(html).not.toMatch(/Self-updating/i);
  });
});

describe("analytics", () => {
  it("is a silent no-op without Plausible and calls it when present", () => {
    expect(() => track("Call")).not.toThrow();
    window.plausible = vi.fn();
    track("Mission", { template: "x" });
    expect(window.plausible).toHaveBeenCalledWith("Mission", { props: { template: "x" } });
    delete window.plausible;
  });
});
