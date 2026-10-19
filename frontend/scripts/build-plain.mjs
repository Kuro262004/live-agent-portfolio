// Writes public/plain/index.html before every build.
// Content source, in order: the live API (VITE_API_URL, so approved GitHub updates appear),
// then the repo's content/seed.json, then the bundled copy in src/content/seed.json.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { renderPlain } from "./plain.mjs";
import { siteUrl } from "./seo.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

async function fromApi() {
  const base = process.env.VITE_API_URL;
  if (!base) return null;
  try {
    const res = await fetch(`${base.replace(/\/$/, "")}/api/profile`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.profile ? data : null;
  } catch {
    return null; // a sleeping free-tier server must never break the build
  }
}

function fromFiles() {
  for (const p of [resolve(root, "../content/seed.json"), resolve(root, "src/content/seed.json")]) {
    if (existsSync(p)) return JSON.parse(readFileSync(p, "utf8"));
  }
  throw new Error("No content source found");
}

const data = (await fromApi()) ?? fromFiles();
const out = resolve(root, "public/plain/index.html");
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, renderPlain(data, { site: siteUrl() }));
console.log(`plain view written: ${out}`);
