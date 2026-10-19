// Writes public/robots.txt and (when the public URL is known) public/sitemap.xml before every build.
// The site URL comes from VITE_SITE_URL, or from Vercel's VERCEL_PROJECT_PRODUCTION_URL at build time.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { robotsTxt, siteUrl, sitemapXml } from "./seo.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const site = siteUrl();
mkdirSync(resolve(root, "public"), { recursive: true });
writeFileSync(resolve(root, "public/robots.txt"), robotsTxt(site));
if (site) {
  writeFileSync(resolve(root, "public/sitemap.xml"), sitemapXml(site));
  console.log(`seo files written for ${site}`);
} else {
  console.log("seo: no VITE_SITE_URL / VERCEL_PROJECT_PRODUCTION_URL, so robots.txt has no Sitemap line and sitemap.xml was not written");
}
