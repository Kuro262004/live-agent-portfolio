"""Deterministic agent behaviour used when no LLM key is configured (and for recorded replays).

These are real, input-driven templates, not random text: the deliverable names the visitor's
business, channels, FAQs or process steps. With API keys set, the pipeline asks the LLMs instead.
"""
import re

PLAN_STEPS = {
    "food-ordering-automation": [
        "Map how an order moves from first message to kitchen ticket",
        "Choose channels and the order-taking dialogue",
        "List integrations (menu, payments, staff notifications)",
        "Draft a phased rollout",
    ],
    "hotel-self-service": [
        "Trace the guest journey from check-in to check-out",
        "Design the QR ordering flow for the room",
        "Define what the guest sees on the bill",
        "Define the staff dashboard and alerts",
    ],
    "voice-faq-bot": [
        "Sketch the call flow from greeting to goodbye",
        "Turn the top questions into intents",
        "Decide when the bot hands the call to a person",
        "List the inputs needed for a cost estimate",
    ],
    "workflow-audit": [
        "Restate the process step by step",
        "Score each step for effort and impact",
        "Rank the opportunities",
        "Recommend the first one to automate",
    ],
}


def _short(text: str, n: int = 230) -> str:
    text = re.sub(r"\s+", " ", text).strip()
    return text if len(text) <= n else text[: n - 1].rstrip() + "…"


def patterns_section(findings: list[dict]) -> str:
    if not findings:
        return "_No closely matching past work was found in the portfolio brain._"
    return "\n".join(f"- ({f['source']}) {_short(f['content'])}" for f in findings)


# --- workflow audit scoring ------------------------------------------------------------------

_IMPACT_WORDS = {
    "manual": 2, "manually": 2, "copy": 2, "paste": 1, "spreadsheet": 2, "excel": 2, "email": 1, "emails": 1,
    "phone": 2, "call": 1, "retype": 2, "re-enter": 2, "type": 1, "daily": 2, "every": 1, "report": 1,
    "reminder": 1, "follow up": 1, "follow-up": 1, "invoice": 1, "order": 1, "schedule": 1, "print": 1,
}
_EFFORT_WORDS = {
    "approve": 2, "approval": 2, "negotiate": 3, "decide": 2, "judgment": 3, "inspect": 3, "visit": 3,
    "physical": 3, "sign": 2, "meet": 2, "meeting": 2, "legal": 3, "custom": 2,
}


def score_steps(process: str) -> list[dict]:
    steps = [s.strip(" -•*\t0123456789.)") for s in re.split(r"[\n;]+", process) if s.strip()]
    if len(steps) == 1:
        steps = [s.strip() for s in re.split(r"(?<=[.!?])\s+|,\s*then\s+|\bthen\b", steps[0]) if s.strip()]
    steps = [s for s in steps if s][:10]
    out = []
    for i, s in enumerate(steps, 1):
        low = s.lower()
        impact = 1 + sum(w for k, w in _IMPACT_WORDS.items() if k in low)
        effort = 1 + sum(w for k, w in _EFFORT_WORDS.items() if k in low)
        impact, effort = min(impact, 5), min(effort, 5)
        out.append({"n": i, "step": s, "impact": impact, "effort": effort, "ratio": impact / effort})
    out.sort(key=lambda r: (-r["ratio"], r["n"]))
    return out


def _level(n: int) -> str:
    return "Low" if n <= 2 else "Medium" if n == 3 else "High"


# --- composers -------------------------------------------------------------------------------

def compose(template_id: str, inputs: dict, findings: list[dict], plan: list[str]) -> str:
    biz = inputs.get("business", "your business")
    notes = f"\n\nNotes from you: {inputs['notes']}" if inputs.get("notes") else ""
    pats = patterns_section(findings)
    plan_md = "\n".join(f"{i}. {s}" for i, s in enumerate(plan, 1))

    if template_id == "food-ordering-automation":
        ch = inputs.get("channels", "chat")
        voice = "voice" in ch
        chat = "chat" in ch
        return f"""# AI ordering system plan — {biz}

## Goal
Let customers of {biz} place and confirm orders through {ch} without staff taking each one by hand, while staff keep a live view of every order.{notes}

Plan followed:
{plan_md}

## Ordering flow
1. **Greet and identify intent.** The assistant greets the customer and asks whether they want to order, ask a question, or reach a person.
2. **Take the order.** It reads from the menu (name, size, add-ons, availability) and builds a running order, repeating it back after each change.
3. **Resolve ambiguity.** Unknown items get a short clarifying question or two close matches, never a guess.
4. **Confirm.** It reads the full order, the total and the pickup or delivery detail, then asks for a clear yes.
5. **Pay and send.** It takes payment or marks cash on pickup, then sends a ticket to the kitchen display.
6. **Update.** The customer gets a confirmation and a ready notice.

## Channels
{"- **Chat:** text ordering on the website or a messaging app, with buttons for common items and a visible order summary." if chat else ""}
{"- **Voice:** a phone line answered by the assistant, with speech-to-text, a short spoken confirmation, and a handoff to a person on request." if voice else ""}
- Both channels should write to the same order record so staff see one queue.

## Integrations to consider
- Menu and stock source, so sold-out items are never offered.
- Payments (an e-wallet or card provider) with a payment-confirmed event before the kitchen ticket prints.
- Kitchen display or printer, and staff notifications for problem orders.
- Click-to-call or a telephony provider for the voice line.
- An admin login (JWT-style) for staff, with live updates over WebSockets.

## Rollout steps
1. Load the real menu and test with staff for a week, with staff confirming every order.
2. Soft launch to regular customers on one channel.
3. Turn on payments, then the second channel.
4. Review failed or handed-off orders weekly and fix the top causes.

## Patterns from past work
{pats}
"""
    if template_id == "hotel-self-service":
        services = inputs.get("services", "room service")
        return f"""# Guest self-service plan — {biz}

## Goal
Replace phone calls to the front desk with self-service for {services}, so guests order faster and see exactly what they owe.{notes}

Plan followed:
{plan_md}

## Guest journey
1. **Arrival.** Check-in links the room to the guest's stay.
2. **In the room.** A QR code on the room TV (or card) opens the menu on the guest's own phone, with no app to install.
3. **Order.** The guest picks items from {services}, adds notes, and submits.
4. **Track.** They see status: received, preparing, on the way, delivered.
5. **Check-out.** The final bill matches what they saw during the stay.

## QR ordering flow
1. Scan the QR code, which carries the room identifier.
2. The page verifies the room has an active stay.
3. The guest builds an order and reviews it.
4. Submit; staff receive it instantly and the guest gets a reference.
5. The guest can cancel until staff accept it.

## Billing view
- A running list of orders with item, quantity, price and time.
- Taxes and service charges shown as separate lines.
- A clear total that updates after each order, with the same figures at check-out.

## Staff dashboard
- A live queue of orders by room and age, with colour for delayed ones.
- One-tap status changes that update the guest's tracker.
- Item availability toggles and a daily summary.

## Patterns from past work
{pats}
"""
    if template_id == "voice-faq-bot":
        faqs = [f.strip() for f in re.split(r"[,\n;]+", inputs.get("faqs", "")) if f.strip()][:8]
        intents = "\n".join(
            f"| `faq_{re.sub(r'[^a-z0-9]+', '_', q.lower()).strip('_')[:28]}` | “{q}” | Answer from the approved FAQ text |"
            for q in faqs
        ) or "| `faq_general` | General questions | Answer from the approved FAQ text |"
        return f"""# Voice FAQ assistant scope — {biz}

## Goal
Answer the most common phone questions for {biz} automatically and pass everything else to a person.{notes}

Plan followed:
{plan_md}

## Call flow
1. **Greeting.** "Thanks for calling {biz}. I'm the automated assistant. How can I help?"
2. **Listen and classify** the request into an intent (below), in the caller's language.
3. **Answer** in one or two short sentences, then ask "Does that help?"
4. **Offer next step:** another question, a booking or message, or a person.
5. **Close** politely; log the intent and outcome (no audio is kept).

## Sample intents
| Intent | Example | Action |
|---|---|---|
{intents}
| `human_request` | “Can I talk to someone?” | Hand off immediately |
| `unknown` | Anything not covered | Apologise once, offer a person or callback |

## Handoff rules
- The caller asks for a person, or sounds frustrated.
- Two failed attempts to understand the same question.
- Anything about payments disputes, emergencies, or complaints.
- Outside the FAQ scope: take a name and number for a callback.

## Cost estimate inputs
- Calls per month and average call length (minutes).
- Share of calls handled without a person (target after pilot).
- Speech-to-text, language model and text-to-speech price per minute or per character.
- Telephony minutes and number rental.
- One-off setup: FAQ writing, voice choice, testing.

## Patterns from past work
{pats}
"""
    # workflow-audit
    scored = score_steps(inputs.get("process", ""))
    rows = "\n".join(
        f"| {i} | {r['step']} | {_level(r['impact'])} | {_level(r['effort'])} |" for i, r in enumerate(scored, 1)
    ) or "| – | No steps recognised | – | – |"
    restated = "\n".join(f"{r['n']}. {r['step']}" for r in sorted(scored, key=lambda r: r["n"])) or "_No steps recognised._"
    first = scored[0]["step"] if scored else "the most repetitive step"
    return f"""# Workflow audit

## Goal
Find which steps of your process are worth automating first, judged by effort against impact.

Plan followed:
{plan_md}

## Process as understood
{restated}

## Ranked opportunities
| Rank | Step | Impact | Effort |
|---|---|---|---|
{rows}

Scores come from keywords in your description (manual copying, phone work and spreadsheets raise impact; approvals and judgment raise effort). Treat them as a first pass to confirm with the people who do the work.

## Suggested first step
Start with “{first}”: it has the best impact for the effort. Automate it for one week in parallel with the manual way, compare results, then move down the list.

## Patterns from past work
{pats}
"""


def review(template_id: str, markdown: str, sections: list[str], inputs: dict) -> list[str]:
    """Programmatic checks. Returns a list of problems (empty = pass)."""
    problems = []
    for s in sections:
        if not re.search(rf"^##\s+{re.escape(s)}\s*$", markdown, re.M):
            problems.append(f"Missing section: {s}")
    if len(markdown) < 600:
        problems.append("Deliverable is too short")
    key = (inputs.get("business") or inputs.get("process") or "").strip()
    if key and key.split()[0].lower() not in markdown.lower():
        problems.append("Deliverable does not reference the visitor's input")
    return problems
