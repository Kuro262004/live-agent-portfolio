import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import AgentGlyph from "../src/components/AgentGlyph";
import Hero from "../src/components/Hero";
import HeroGraph from "../src/components/HeroGraph";
import Section from "../src/components/Section";
import { Contact, Experience, Projects, Skills } from "../src/components/Sections";
import { AGENT_HEX } from "../src/lib/agents";
import App from "../src/App";
import { useApp } from "../src/stores/app";
import { renderWithQuery } from "./helpers";

const read = (p) => readFileSync(resolve(process.cwd(), p), "utf8");

describe("design system", () => {
  it("defines one colour per agent as tokens, in CSS and Tailwind", () => {
    const css = read("src/index.css");
    const dark = { planner: "128 174 232", researcher: "246 196 58", builder: "238 128 102", reviewer: "112 200 152", brain: "178 158 236" };
    for (const [agent, channels] of Object.entries(dark)) {
      expect(css).toContain(`--${agent}: ${channels};`);
      expect(read("tailwind.config.js")).toContain(`${agent}: "rgb(var(--${agent}) / <alpha-value>)"`);
      expect(AGENT_HEX[agent]).toBe(`rgb(var(--${agent}))`);
    }
  });

  it("uses a display font for headings", () => {
    expect(read("src/index.css")).toMatch(/h1, h2, h3 \{\s*font-family: "Bricolage Grotesque"/);
    expect(read("index.html")).toContain("Bricolage+Grotesque");
  });

  it("section headings carry a route signboard and a dashed lane line", () => {
    const { container } = render(<Section id="s" kicker="03 · experience" title="Active missions" meta="2 active">x</Section>);
    expect(screen.getByText("03 · experience")).toHaveClass("route-sign");
    expect(screen.getByText("2 active")).toBeInTheDocument();
    expect(container.querySelector(".route-dash")).toHaveAttribute("aria-hidden", "true");
  });

  it("keeps signboard lettering readable in both themes", () => {
    const css = read("src/index.css");
    expect(css).toContain("--sun: 246 196 58;");
    expect(css).toContain("--on-sun: 17 24 39;");
    expect(read("tailwind.config.js")).toContain('sun: "rgb(var(--sun) / <alpha-value>)"');
  });
});

describe("light mode", () => {
  const css = read("src/index.css");
  const light = css.slice(css.indexOf(':root[data-theme="light"] {'));
  const token = (name) => light.match(new RegExp(`--${name}: (\\d+) (\\d+) (\\d+);`)).slice(1).map(Number);
  const luminance = ([r, g, b]) => {
    const [R, G, B] = [r, g, b].map((v) => {
      const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * R + 0.7152 * G + 0.0722 * B;
  };
  const ratio = (a, b) => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };

  it("meets WCAG AA (4.5:1) for text and every agent colour on the paper", () => {
    for (const bg of ["bg", "panel"]) {
      for (const fg of ["ink", "mute", "alert", "planner", "researcher", "builder", "reviewer", "brain"]) {
        expect(ratio(token(fg), token(bg)), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("turns off glow and grain on paper", () => {
    expect(light).toMatch(/body::after[\s\S]*display: none/);
    expect(light).toMatch(/\.glow-cta[\s\S]*box-shadow/);
  });

  it("leaves no hard-coded dark colours in the components", () => {
    const files = ["components/Sections.jsx", "components/HeroGraph.jsx", "features/mission/AgentGraph.jsx", "features/mission/MissionProgress.jsx", "features/mission/PacketEdge.jsx", "features/evolution/CommitGraph.jsx"];
    for (const f of files) expect(read(`src/${f}`), f).not.toMatch(/#(1d2735|2a3748|7f8da3|7d8da3|0c1118|38e8ff|ffb44d|6ee787|7aa2ff|b38cff)/i);
  });

  it("toggles, remembers the choice and sets data-theme", () => {
    localStorage.removeItem("theme");
    useApp.getState().setTheme("dark");
    useApp.getState().toggleTheme();
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(localStorage.getItem("theme")).toBe("light");
    useApp.getState().toggleTheme();
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(localStorage.getItem("theme")).toBe("dark");
    localStorage.removeItem("theme");
  });

  it("has a labelled toggle in the top bar", async () => {
    useApp.getState().setTheme("dark");
    renderWithQuery(<App />);
    await userEvent.click(await screen.findByRole("button", { name: "Switch to light mode" }));
    expect(screen.getByRole("button", { name: "Switch to dark mode" })).toBeInTheDocument();
    localStorage.removeItem("theme");
  });
});

describe("hero visual", () => {
  it("is decorative, desktop-only and shows the four agents", () => {
    const { container } = render(<HeroGraph />);
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    for (const name of ["Planner", "Researcher", "Builder", "Reviewer", "Shared brain"]) expect(container).toHaveTextContent(name);
  });

  it("sits in a wrapper hidden below the lg breakpoint", async () => {
    const { container } = renderWithQuery(<Hero />);
    await screen.findByRole("heading", { level: 1 });
    expect(container.querySelector(".hidden.lg\\:block")).not.toBeNull();
  });

  it("agent glyphs are decorative", () => {
    const { container } = render(<AgentGlyph id="builder" />);
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });
});

describe("layout", () => {
  it("shows every skill module at once as a bento grid", async () => {
    renderWithQuery(<Skills />);
    for (const m of ["AI & Voice", "Frontend", "Backend", "Data & DevOps", "Testing & Quality", "Design & Other"]) {
      expect(await screen.findByRole("region", { name: m })).toBeInTheDocument();
    }
    expect(screen.queryByRole("tab")).toBeNull();
  });

  it("shows experience as a timeline", async () => {
    const { container } = renderWithQuery(<Experience />);
    await screen.findAllByRole("heading", { level: 3 });
    expect(container.querySelector("ol").children.length).toBeGreaterThan(0);
  });

  it("shows contact as an open channel with real links", async () => {
    renderWithQuery(<Contact />);
    const channel = await screen.findByRole("group", { name: "Contact channel" });
    expect(within(channel).getByText(/channel open/)).toBeInTheDocument();
    expect(within(channel).getAllByRole("link").some((a) => a.getAttribute("href").startsWith("mailto:"))).toBe(true);
  });
});

describe("page chrome", () => {
  it("has a mobile action bar and a footer status line from /api/status", async () => {
    renderWithQuery(<App />);
    const line = await screen.findByLabelText("Site status");
    await waitFor(() => expect(line).toHaveTextContent(/^scripted·4 agents·voice: browser·/));
    expect(screen.getByText(/last evolved: /)).toBeInTheDocument();
  });

  it("keeps the mobile action bar hidden while the hero buttons are on screen", async () => {
    renderWithQuery(<App />);
    await screen.findByLabelText("Site status");
    // the stubbed IntersectionObserver reports the hero buttons as visible, so the bar is not shown
    expect(screen.queryByRole("button", { name: /^(Call|Chat)$/ })).toBeNull();
  });
});

describe("round 2 layout fixes", () => {
  it("lists where a skill module was used, from the real project and job stacks", async () => {
    renderWithQuery(<Skills />);
    const tile = await screen.findByRole("region", { name: "AI & Voice" });
    expect(tile).toHaveTextContent(/Used in:.*AIKO/);
    expect(tile).toHaveTextContent(/DamAiyan/);
  });

  it("puts a cover on every project and makes the first one wide", async () => {
    const { container } = renderWithQuery(<Projects />);
    await screen.findAllByRole("group");
    expect(container.querySelectorAll("[aria-label$=\"goal, role and result\"]").length).toBe(3);
    expect(container.querySelector("article").className).toContain("md:col-span-2");
  });

  it("continues the story as a jeepney route through the bootcamp, the graduation and the current job", async () => {
    renderWithQuery(<Experience />);
    const route = await screen.findByRole("group", { name: /Route of Justin's journey/ });
    expect(route).toHaveAccessibleName(/Bayanaihan.*Ilocos Sur Polytechnic State College.*GOLI Company/);
    expect(screen.getByText(/CANDON\s+⇄\s+BAYANAIHAN\s+⇄\s+GOLI COMPANY/)).toBeInTheDocument();
  });

  it("shows a short LinkedIn name with the full link underneath", async () => {
    renderWithQuery(<Contact />);
    expect(await screen.findByRole("link", { name: "in/sales-justin-h" })).toHaveAttribute("href", expect.stringContaining("linkedin.com/in/sales-justin-h"));
  });

  it("the hero graph is a button that asks Mission Control for a recorded run", async () => {
    useApp.setState({ recordedRequest: 0 });
    render(<HeroGraph />);
    await userEvent.click(screen.getByRole("button", { name: /watch a recorded run/i }));
    expect(useApp.getState().recordedRequest).toBe(1);
  });
});
