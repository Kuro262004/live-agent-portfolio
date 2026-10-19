// Search and sharing metadata, generated from the same profile content as everything else.

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

/** The site's public origin, from VITE_SITE_URL or Vercel's production URL. Empty when unknown (e.g. local dev). */
export function siteUrl(env = process.env) {
  const raw = env.VITE_SITE_URL || (env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}` : "");
  return raw.replace(/\/+$/, "");
}

const absolute = (site, path) => (site ? `${site}${path}` : path);

/** JSON-LD Person block so a search result can show a clean name, title and links. */
export function personJsonLd(seed, site) {
  const p = seed.profile;
  const c = p.contacts;
  const edu = seed.education?.[0];
  const abs = (u) => (/^https?:/.test(u) ? u : `https://${u}`);
  const data = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: p.name,
    jobTitle: p.title,
    description: p.summary,
    ...(site ? { url: `${site}/` } : {}),
    sameAs: [c.github, c.linkedin].filter(Boolean).map(abs),
    knowsLanguage: c.languages ?? [],
    knowsAbout: seed.skills.flatMap((g) => g.names).slice(0, 12),
    ...(edu ? { alumniOf: { "@type": "CollegeOrUniversity", name: edu.school.split(",")[0] } } : {}),
    worksFor: seed.experience?.[0] ? { "@type": "Organization", name: seed.experience[0].org } : undefined,
  };
  // contact details are deliberately left out: structured data is scraped
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

/** Everything injected into <head> at build time. */
export function seoTags(seed, { site = "", plausibleDomain = "" } = {}) {
  const p = seed.profile;
  const title = `${p.name} — Full-Stack Developer, AI Automation & Agentic AI`;
  const description = "A portfolio that is also a working AI product: call Justin's AI, watch his agents work live, and see the site update itself from GitHub.";
  const image = absolute(site, "/og.png");
  const lines = [
    site && `<link rel="canonical" href="${esc(site)}/" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${esc(p.name)}" />`,
    `<meta property="og:title" content="${esc(title)}" />`,
    `<meta property="og:description" content="${esc(description)}" />`,
    site && `<meta property="og:url" content="${esc(site)}/" />`,
    `<meta property="og:image" content="${esc(image)}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:image:alt" content="${esc(p.name)}: Live Agent Portfolio. Call my AI, watch my agents work." />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${esc(title)}" />`,
    `<meta name="twitter:description" content="${esc(description)}" />`,
    `<meta name="twitter:image" content="${esc(image)}" />`,
    `<script type="application/ld+json">${personJsonLd(seed, site)}</script>`,
    plausibleDomain && `<script defer data-domain="${esc(plausibleDomain)}" src="https://plausible.io/js/script.js"></script>`,
  ];
  return lines.filter(Boolean).join("\n    ");
}

/** robots.txt: everything public is crawlable; /admin is kept out. */
export function robotsTxt(site) {
  return ["User-agent: *", "Allow: /", "Disallow: /admin", ...(site ? ["", `Sitemap: ${site}/sitemap.xml`] : []), ""].join("\n");
}

export function sitemapXml(site, lastmod = new Date()) {
  const day = lastmod.toISOString().slice(0, 10);
  const urls = ["/", "/plain/", "/privacy/"];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${esc(site)}${u}</loc><lastmod>${day}</lastmod></url>`).join("\n")}
</urlset>
`;
}
