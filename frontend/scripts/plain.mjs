// Renders the static "plain view": a fast, printable page that works with JavaScript disabled.
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const list = (items) => (items.length ? `<ul>${items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>` : "");
const href = (u) => (/^https?:\/\//.test(u) ? u : `https://${u}`);

export function renderPlain(d, { builtAt = new Date(), site = "" } = {}) {
  const p = d.profile;
  const c = p.contacts;
  // the API flattens profile.extras; the bundled seed still nests them
  const nowBuilding = p.now_building ?? p.extras?.now_building ?? "";
  const stats = p.stats ?? p.extras?.stats ?? [];
  const testimonials = p.testimonials ?? p.extras?.testimonials ?? [];
  const skills = d.skills
    .map((s) => `<tr><th scope="row">${esc(s.module)}</th><td>${esc(s.names.join(", "))}</td></tr>`)
    .join("");
  const experience = d.experience
    .map(
      (e) => `<article>
  <h3>${esc(e.title)}</h3>
  <p class="meta">${esc([e.org, e.role, e.period].filter(Boolean).join(" · "))}</p>
  ${list(e.bullets)}
  ${e.stack.length ? `<p class="stack"><strong>Stack:</strong> ${esc(e.stack.join(", "))}</p>` : ""}
</article>`,
    )
    .join("\n");
  const projects = d.projects
    .map(
      (x) => `<article id="${esc(x.id)}">
  <h3>${esc(x.name)}</h3>
  <p class="meta">${esc(x.context)}</p>
  <dl>
    <dt>Role</dt><dd>${esc(x.role)}</dd>
    <dt>Goal</dt><dd>${esc(x.goal)}</dd>
    <dt>Result</dt><dd>${esc(x.result)}</dd>
    <dt>Tools</dt><dd>${esc(x.stack.join(", "))}</dd>
    ${x.repo_url ? `<dt>Repo</dt><dd><a href="${esc(x.repo_url)}">${esc(x.repo_url)}</a></dd>` : ""}
  </dl>
</article>`,
    )
    .join("\n");
  const education = d.education
    .map((e) => `<p><strong>${esc(e.degree)}</strong>${e.specialization ? `, ${esc(e.specialization)}` : ""}<br>${esc(e.school)} · ${esc(e.date)}</p>`)
    .join("");
  const trainings = list(d.trainings.map((t) => [t.title, t.provider, t.date].filter(Boolean).join(" — ")));

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="icon" href="data:,">
<title>${esc(p.name)} — Plain view</title>
<meta name="description" content="${esc(p.title)}. Full profile, skills, experience and projects on one printable page.">
${site ? `<link rel="canonical" href="${esc(site)}/plain/">\n<meta property="og:url" content="${esc(site)}/plain/">` : ""}
<meta property="og:type" content="profile">
<meta property="og:title" content="${esc(p.name)} — Plain view">
<meta property="og:image" content="${esc(site)}/og.png">
<meta name="twitter:card" content="summary_large_image">
<style>
  @view-transition { navigation: auto; }
  :root { color-scheme: light dark; --fg:#0e1834; --bg:#faf3e2; --mute:#585a68; --line:#e0d2b2; --accent:#965800; }
  @media (prefers-color-scheme: dark) { :root { --fg:#f8f1e1; --bg:#0c1428; --mute:#a0a8be; --line:#283964; --accent:#ffc928; } }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--fg); font:16px/1.6 system-ui,-apple-system,Segoe UI,Roboto,sans-serif; }
  main { max-width: 46rem; margin: 0 auto; padding: 1.5rem 1.25rem 4rem; }
  h1 { font-size: 2rem; margin: 0; line-height:1.2; }
  h2 { font-size: .8rem; letter-spacing:.14em; text-transform:uppercase; color:var(--accent); border-bottom:1px solid var(--line); padding-bottom:.35rem; margin:2.2rem 0 .8rem; }
  h3 { font-size:1.05rem; margin:0; }
  .sub { color:var(--mute); margin:.2rem 0 1rem; font-size:1.05rem; }
  .meta { color:var(--mute); margin:.1rem 0 .4rem; font-size:.9rem; }
  a { color:var(--accent); }
  article { margin: 0 0 1.25rem; break-inside: avoid; }
  ul { margin:.3rem 0; padding-left:1.2rem; }
  table { width:100%; border-collapse:collapse; font-size:.95rem; }
  th,td { text-align:left; vertical-align:top; padding:.4rem .5rem .4rem 0; border-bottom:1px solid var(--line); }
  th { width:9.5rem; color:var(--mute); font-weight:600; }
  dl { display:grid; grid-template-columns: 5rem 1fr; gap:.15rem .75rem; margin:.3rem 0; }
  dt { color:var(--mute); } dd { margin:0; }
  .top { display:flex; flex-wrap:wrap; gap:.4rem 1rem; font-size:.9rem; margin-bottom:1rem; }
  .contact li { margin:.15rem 0; }
  footer { margin-top:3rem; color:var(--mute); font-size:.8rem; }
  @media print { a { color:inherit; text-decoration:none; } .top { display:none; } main { padding:0; } body { font-size:11pt; } }
</style>
</head>
<body>
<main>
  <nav class="top"><a href="/">← Interactive site (call my AI, watch my agents work)</a><a href="#" onclick="window.print();return false">Print</a></nav>
  <header>
    <h1>${esc(p.name)}</h1>
    <p class="sub">${esc(p.title)}</p>
    <p>${esc(p.summary)}</p>
    ${nowBuilding ? `<p><strong>Now building:</strong> ${esc(nowBuilding)}</p>` : ""}
    ${stats.length ? `<ul class="stats">${stats.map((s) => `<li><strong>${esc(s.value)}</strong> ${esc(s.label)}</li>`).join("")}</ul>` : ""}
  </header>

  <h2 id="contact">Contact</h2>
  <ul class="contact">
    <li>Email: <a href="mailto:${esc(c.email)}">${esc(c.email)}</a></li>
    ${c.phone ? `<li>Phone: <a href="tel:${esc(c.phone.replace(/\s/g, ""))}">${esc(c.phone)}</a></li>` : ""}
    <li>LinkedIn: <a href="${esc(href(c.linkedin))}">${esc(c.linkedin)}</a></li>
    <li>GitHub: <a href="${esc(href(c.github))}">${esc(c.github)}</a></li>
    <li>Languages: ${esc((c.languages || []).join(", "))}</li>
  </ul>

  <h2 id="skills">Skills</h2>
  <table><tbody>${skills}</tbody></table>

  <h2 id="experience">Experience</h2>
  ${experience}

  <h2 id="projects">Projects</h2>
  ${projects}

  ${testimonials.length ? `<h2 id="testimonials">What people say</h2>
  ${testimonials.map((t) => `<blockquote>“${esc(t.quote)}” <br>— ${esc(t.name)}${t.role ? `, ${esc(t.role)}` : ""}</blockquote>`).join("")}` : ""}

  <h2 id="education">Education</h2>
  ${education}

  <h2 id="training">Training &amp; certifications</h2>
  ${trainings}

  <footer>Plain view generated ${esc(builtAt.toISOString().slice(0, 10))}. No JavaScript required.</footer>
</main>
</body>
</html>
`;
}
