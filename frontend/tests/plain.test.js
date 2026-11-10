import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { renderPlain } from "../scripts/plain.mjs";
import seed from "../src/content/seed.json";

describe("plain view", () => {
  const html = renderPlain(seed, { builtAt: new Date("2026-10-14T00:00:00Z") });

  it("contains the whole profile with no script tags", () => {
    expect(html).toContain("<h1>Justin H. Sales</h1>");
    const esc = (t) => t.replace(/&/g, "&amp;");
    for (const p of seed.projects) expect(html).toContain(esc(p.name));
    for (const e of seed.experience) expect(html).toContain(esc(e.title));
    expect(html).not.toContain("Phone:"); // the phone number is kept off the public site
    expect(renderPlain({ ...seed, profile: { ...seed.profile, contacts: { ...seed.profile.contacts, phone: "+63 900 000 0000" } } })).toContain("+63 900 000 0000");
    expect(html).toContain("Ilocos Sur Polytechnic State College");
    expect(html).not.toMatch(/<script/i);
    expect(html).toContain("@media print");
  });

  it("escapes content", () => {
    const evil = structuredClone(seed);
    evil.projects[0].name = '<img src=x onerror="alert(1)">';
    const out = renderPlain(evil);
    expect(out).not.toContain("<img src=x");
    expect(out).toContain("&lt;img src=x");
  });

  it("the bundled content copy matches the repo's content/seed.json", () => {
    const canonical = JSON.parse(readFileSync(resolve(process.cwd(), "../content/seed.json"), "utf8"));
    expect(seed).toEqual(canonical);
  });
});
