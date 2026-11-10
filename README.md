# Justin H. Sales — Live Agent Portfolio

A portfolio that is also a working AI product, built from `justin-portfolio-spec.md`:

- **Call my AI** — talk to Justin's AI assistant (voice or text). It answers from one shared knowledge base, drives the page (opens projects, scrolls to skills) and can start a mission.
- **Mission Control** — four agents (Planner → Researcher → Builder → Reviewer) build a real deliverable for the visitor's task while a React Flow graph animates from the live event stream. Download it or book a call.
- **Self-evolving** — a nightly GitHub Actions job asks the API to read Justin's *public* repos and write **draft** updates. Nothing goes live until approved on `/admin`.
- **Plain view** — `/plain/`: a static, printable page that works with JavaScript off.

## Works with no API keys

Every feature runs offline so you can try it immediately; keys only make it smarter.

| Without keys | With keys |
|---|---|
| Assistant routes by intent and answers straight from retrieved chunks (never invents facts) | Groq tool-calling loop with `search_portfolio`, `open_section`, `start_mission`, `narrate_mission`, `book_meeting`, `end_call` |
| Agents run deterministic, input-driven templates (the reviewer really checks sections and sends back one revision) | Groq plans/researches/reviews, Claude writes the deliverable |
| Voice uses the browser's speech recognition + synthesis | Mic → server VAD → Whisper (Groq) → LLM → Fish Audio streaming TTS, with barge-in |
| Evolution drafts list the actual commit messages | Claude writes the drafts (told not to invent metrics) |

## Run it

Backend (http://localhost:8000, docs at `/docs`):

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\pip install -r requirements.txt
copy .env.example .env       # add keys when you have them
.\.venv\Scripts\uvicorn app.main:app --reload
```

Startup applies the Alembic migration and seeds the database from `content/seed.json`.

Frontend (http://localhost:5173), Node 20+:

```powershell
cd frontend
npm install --legacy-peer-deps
npm run dev
```

Vite proxies `/api`, `/evolve` and `/ws` to the backend.

Tests and checks:

```powershell
cd backend;  .\.venv\Scripts\python -m pytest tests          # 69 tests
cd frontend; npm test; npm run lint; npm run knip; npm run build
```

## Content

One source of truth: `content/seed.json` seeds the database (`profile`, `skills`, `experience`, `projects`, `education`, `trainings`, `changelog`), the shared brain chunks, the plain view and the fallback copy bundled in the frontend (`frontend/src/content/seed.json`). A test fails if the two JSON copies drift, so after editing run:

```powershell
copy content\seed.json frontend\src\content\seed.json
```

The seed only fills an empty database. To re-seed, delete `backend/portfolio.db` and restart. (The spec names `content/seed.md`; JSON is used here so the same file can feed the database and the plain view.)

## Deploy

| Part | Where | Notes |
|---|---|---|
| Frontend | Vercel, Root Directory `frontend` | env `VITE_API_URL=https://<api>` (baked in at build time); optional `VITE_TURNSTILE_SITE_KEY` |
| Backend | Any Docker host (`render.yaml` for Render) | Build from the repo root: `docker build -f backend/Dockerfile .`; needs WebSockets |
| Database | Supabase Postgres | `DATABASE_URL`; on Render's free tier use the Session pooler string (no IPv6) |
| Nightly job | GitHub Actions `evolve.yml` | repo secrets `API_URL` and `EVOLVE_SECRET` |

1. Create the database, then deploy the backend with the environment variables from `backend/.env.example` (`ENVIRONMENT=production`, `DATABASE_URL`, `EVOLVE_SECRET`, `CORS_ORIGINS=<your Vercel URL>`, plus any API keys). Check `/api/health`.
2. Deploy the frontend to Vercel with `VITE_API_URL`. The build also writes `/plain/` from the live API (falling back to the bundled content, so a sleeping server never breaks a build).
3. Add the `API_URL` / `EVOLVE_SECRET` secrets to the GitHub repo. Run the workflow once with *Run workflow* to test it.
4. Open `/admin`, paste `EVOLVE_SECRET`, review drafts, approve or reject.

## Going live: turn on the real AI

Nothing here needs code changes, only keys. Put them in `backend/.env` locally and in your backend host's environment variables in production. **Never paste a key into a chat, a commit or the frontend.**

1. **Models.** `GROQ_API_KEY` (fast chat, agent steps and Whisper speech-to-text) and `ANTHROPIC_API_KEY` (long deliverables). `GET /api/status` then reports `llm: true`, the "Scripted demo" label disappears and the boot line and footer say "live".
2. **Voice.** `FISH_AUDIO_API_KEY` (and optionally `FISH_AUDIO_VOICE_ID` for a voice such as your own clone, and `FISH_AUDIO_MODEL`, e.g. `s2.1-pro-free` on Fish's free developer tier) turns on server text-to-speech: the AI speaks with Fish Audio even before Groq is added; with the Groq key the call then uses Whisper + Fish Audio instead of the browser's speech.
3. **CAPTCHA (do this before step 1 goes public).** Create a Cloudflare Turnstile widget; put the secret in `CAPTCHA_SECRET` (backend) and the site key in `VITE_TURNSTILE_SITE_KEY` (Vercel). In production the backend **refuses to start** if any AI key is set without `CAPTCHA_SECRET`, or if `CORS_ORIGINS` still points at localhost.
4. **Check it worked:** `cd backend; .\.venv\Scripts\python -m app.scripts.check_services` tests each key with a tiny request and prints ✓/✗ (never the keys). The Fish Audio request follows its public docs and hasn't been exercised by the author.
5. **Re-record the fallback replays** with real keys: `python -m app.scripts.record_replays`.

## Sharing and search

- `VITE_SITE_URL` (or Vercel's production URL, picked up automatically) feeds the canonical link, the Open Graph / Twitter card (`public/og.png`, 1200×630; source in `scripts/og.html`), the JSON-LD `Person` block and `sitemap.xml`. `robots.txt` and `sitemap.xml` are real files generated at build.
- Unknown URLs get a "Lost signal" page (`public/404.html` with a real 404 status on Vercel; the same page inside the app).
- `/privacy/` explains what is stored; check it still matches what you ship before launch. `/m/<id>` is a read-only link to a finished deliverable (the **Share** button); `vercel.json` rewrites it to the app.
- Optional cookie-less analytics: set `VITE_PLAUSIBLE_DOMAIN`. Events: Call, Mission, Recorded run, Share.
- `manifest.webmanifest` + icons make it installable on a phone's home screen.

## Content only you can supply

The profile content supports optional `extras` in `content/seed.json` → `profile.extras`: `now_building` (a sentence, already filled from your résumé), `stats` (`[{"value": "…", "label": "…"}]`, shown as a strip under the hero) and `testimonials` (`[{"quote": "…", "name": "…", "role": "…"}]`). They stay hidden until you add real ones; nothing is invented. After editing, copy the file to `frontend/src/content/seed.json` and re-seed (delete `backend/portfolio.db`).

## When a visitor runs out of live runs

Nobody hits a dead end. When a visitor's 3 daily missions (or the site-wide daily budget) are used up, a new mission becomes a **recorded run** of the same template (from `content/replays/`), with a calm notice and a "book a call" link; the assistant says the same thing when it starts a mission. Calls over the limit fall back to text chat with the same notice.

**Testing locally:** while `ENVIRONMENT=development`, requests from this machine skip the per-IP limits (`DEV_BYPASS_LIMITS=true`, the default). It never applies in production or to other IPs. Set `DEV_BYPASS_LIMITS=false` to see the fallback yourself.

## Guardrails (all enforced server-side)

CAPTCHA (Cloudflare Turnstile, when `CAPTCHA_SECRET` is set) · per-IP limits (2 calls, 3 missions a day) · daily caps on LLM tokens, voice seconds and TTS characters with a hard stop · templated missions with input length limits · input moderation (prompt-injection, abuse and secret patterns) and output redaction · **fallback mode**: when a cap is hit, calls become text chat and new missions replay a recording from `content/replays/` · calls end at 3:00 with a wrap-up at 2:30 · audio is never stored (only counts and outcome are logged).

### Data retention

Missions (typed details, log, deliverable, shared links) and call records (which hold an IP address) are deleted automatically after `RETENTION_DAYS` (default 30; `0` keeps them forever). The purge runs at startup and once a day. Daily usage totals hold no personal data and are kept. The privacy page says 30 days, so change it there too if you change this value.

## Before going public (spec §12)

- [ ] Confirm with GOLI Company what can be shown about AIKO and the body-cam project.
- [ ] **Re-record the fallback replays with real keys:** `cd backend; .\.venv\Scripts\python -m app.scripts.record_replays`. The ones in `content/replays/` were recorded with the offline agents.
- [ ] Set the budget caps and test the hard stop with real traffic.
- [ ] Set `BOOKING_URL` (until then "Book a call" opens an email).
- [ ] Test the plain view on a phone and with JavaScript disabled.
- [ ] Privacy note: the call dialog and footer include a short one; adjust the wording to taste.

## What has and hasn't been verified

Verified here: backend tests (API, guardrails, fallback, WebSocket missions and calls, VAD, a mocked Whisper/Fish pipeline including barge-in, evolution with a mocked GitHub), frontend tests, lint, knip, the production build, and a headless-browser run of the real UI (mission flow, call dialog, page-driving, plain view without JS, 400 px mobile with no horizontal overflow).

**Not verified** (needs your accounts or hardware): real Groq / Claude / Whisper / Fish Audio calls (the HTTP calls follow their public APIs but haven't been exercised), a real microphone and audio playback, Cloudflare Turnstile, Postgres, the Docker image build (no Docker daemon was running), and the GitHub Actions schedule.

## Differences from the spec

- Embeddings: the shared brain uses a dependency-free hashing embedder stored as JSON, not pgvector. `brain/embeddings.py` is the one place to swap in a hosted model; moving the column to `vector` is a small migration.
- `/admin` uses the `EVOLVE_SECRET` bearer token (no separate user system), and there is no phone-notification approval link yet.
- Moderation is a local filter, not a hosted moderation model.

## Graphics modes

Two versions of the same page, chosen by `src/lib/useRichMode.js`:

- **Full** (desktop with a fine pointer, 1024px+, 4+ cores, 4 GB+ memory and WebGL2): **one 3D world** behind the whole page (`src/features/world/`). A single fixed canvas holds the sky, the agent network, floating project panels and the particle name; as you scroll, the camera travels through stations tied to the real sections (wide at the top, close on the graph for Mission Control, past the shared brain for Skills, out to the project panels, a calm wide shot at Contact). At the top, the network is placed to fill the hero's picture box. **Call my AI** flies the camera toward the researcher. Also: the scroll-driven recorded mission, the sideways project rail with tilting cards, light parallax and the reticle cursor.
- **Lite** (phones, tablets, reduced motion, no WebGL2, or a world that can't hold ~40 fps for its first 2 seconds): the 2D site, with a still gradient behind the panels and the 2D hero picture.

Visitors can override it with `graphics full`, `graphics lite` or `graphics auto` in the command palette (Ctrl/⌘+K) or the switch in the footer status line. Reduced motion always wins. Everywhere: kinetic headings, the name intro (letter by letter in lite; in full mode particles spell it over the heading, then scatter onto the network's edges and keep flowing as data streams) and, from 1280px, the system rail.

The 3D engine (three.js + React Three Fiber) is a separate chunk loaded only in full mode, after the first paint. One WebGL context for the whole site; rendering stops when the tab is hidden. Glows are halo sprites rather than a bloom pass, to stay within the bundle budget. The world dims behind long-reading sections (About, Bug bestiary, Evolution), and panels over it are mostly solid with a light blur. Not verified: frame rate on real mid-range hardware (checked here only in a software-rendered headless browser).

## Living system (Level 3)

- **Real metrics and streaming.** Every model call records input/output tokens, the model that answered and its latency (`app/llm.py`). The call panel's text chat streams replies from `POST /api/chat/stream` (Server-Sent Events: `token`, `tool`, `done`); each reply ends with a small line such as `live · llama-3.3-70b-versatile · 840 ms · 1240 in · 310 out`, or `scripted answer · no AI model` without keys. Text is passed through the output filter a word at a time, so a credential can't slip out split across chunks. Costs appear only when you set `PRICES_PER_MTOK` (see `.env.example`); otherwise "price not set", never a guess.
- **Honest status.** Boot line `agents: 4/4 ready (live | scripted | recorded runs: today's AI budget is used up)` and the footer `live · 4 agents · voice: fish audio`.
- **Agent trace inspector.** Each agent step emits a trace span on the mission event stream (`type: "span"`, stored with the mission's events, same 30-day retention): input, prompt template with its filled variables, what the shared brain returned (with scores), output, model, tokens, latency, cost and a `mode`: `live` (a model answered), `local` (real work without a model: search, rule checks), `scripted` (template text, no AI key) or `recorded` (replayed; `recorded_mode` says what it was). Click an agent in Mission Control, or "inspect" in the log, to open the drawer with a timeline of all spans. Recorded runs ship with recorded spans, so the inspector works in fallback mode. No keys, IPs or private instructions are ever in a span.
- **Voice-reactive network.** During a call the researcher node pulses with the AI's voice, and tool use lights the matching edge (`search_portfolio` → brain–researcher, `open_section` → researcher–planner, `start_mission` → researcher–builder) with a caption such as "searching the portfolio…".
- **Ask-to-navigate.** In the Ctrl/⌘+K menu, typed commands still run instantly; anything else gets an "ask" row. `POST /api/navigate` has the model answer through a forced `navigate` tool (section, cards to highlight, one short line), with every card id checked against the real ones; without a live model, or past `IP_NAVIGATE_PER_DAY`, the browser's keyword map answers and says so ("· keyword match"). The page scrolls there and the cards pulse in their agent's colour.
- **Philippine-time lighting.** In dark mode the sky is tinted by the time in Candon (night navy with stars, violet sunrise, coral golden hour); the footer shows e.g. `🌙 Candon, 11:42 PM`.
- **Live presence.** Other visitors appear as dots when they're on the same section as you, and the hero says "3 people watching the agents" when you aren't alone. It runs on the backend's own WebSocket (`/ws/presence`, one in-memory room per server process) rather than Supabase Realtime, so it needs no extra service; ids are random per visit and nothing is stored. With more than one backend instance, visitors only see others on the same instance.

## Motion

Motion shows the system working (see `portfolio-animations.md`): glowing packets travel the agent graph while a handoff is active, nodes breathe / spin a ring while thinking / pop a check when done (amber flash on a revision), the log types its newest line, a four-segment bar tracks the mission, and the deliverable "prints" in. The hero has a one-per-session boot intro (click or press any key to skip), a decoding name, a constellation background and a sonar pulse on **Call my AI**; the call panel has an audio-reactive orb and morphs into a pill when minimized; sections get cursor spotlights, a border beam on in-progress cards, a sliding tab underline, a drawing trace line and commit graph, a scroll-progress line and an active-nav indicator.

Rules the code follows: only `transform`/`opacity` (plus CSS custom properties for gradients) are animated; everything respects `prefers-reduced-motion` (no boot, decode, packets, beams, typing or orb pulse); looping effects pause off-screen and in hidden tabs; the constellation rests while the graph or the call orb is busy; decorative layers are `aria-hidden` and decoding text keeps a real `aria-label`. Not built: the optional 3D neural sphere. Not measured: frame rate on a mid-range Android phone.
