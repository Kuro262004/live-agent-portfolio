"""Mission templates. Missions are templated only: no open-ended web actions, bounded inputs."""

TEMPLATES: dict[str, dict] = {
    "food-ordering-automation": {
        "id": "food-ordering-automation",
        "title": "Plan an AI ordering system for my restaurant or café",
        "inspired_by": "AIKO",
        "deliverable": "Ordering flow, channels (chat/voice), integrations to consider, rollout steps",
        "fields": [
            {"name": "business", "label": "Business name or type", "placeholder": "e.g. Kape Corner, a 20-seat café", "required": True, "max": 120},
            {"name": "channels", "label": "Channels", "type": "select", "options": ["chat", "voice", "chat and voice"], "required": True},
            {"name": "notes", "label": "Anything specific? (optional)", "placeholder": "e.g. 40 menu items, GCash payments", "required": False, "max": 300},
        ],
        "sections": ["Goal", "Ordering flow", "Channels", "Integrations to consider", "Rollout steps", "Patterns from past work"],
        "queries": ["AIKO AI telephone operator F&B ordering chat and voice", "payments bookings click-to-call integrations", "WebSockets live updates JWT"],
    },
    "hotel-self-service": {
        "id": "hotel-self-service",
        "title": "Plan guest self-service for my hotel",
        "inspired_by": "Hotel Scan-to-Order",
        "deliverable": "Guest journey, QR ordering flow, billing view, staff dashboard",
        "fields": [
            {"name": "business", "label": "Hotel name or size", "placeholder": "e.g. 40-room boutique hotel", "required": True, "max": 120},
            {"name": "services", "label": "Services to cover", "placeholder": "e.g. room service, laundry, spa", "required": True, "max": 200},
            {"name": "notes", "label": "Anything specific? (optional)", "placeholder": "", "required": False, "max": 300},
        ],
        "sections": ["Goal", "Guest journey", "QR ordering flow", "Billing view", "Staff dashboard", "Patterns from past work"],
        "queries": ["Hotel Scan-to-Order QR code room TV billing transparency", "Hotelogix bookings FIUU payments", "workflow automation team leader"],
    },
    "voice-faq-bot": {
        "id": "voice-faq-bot",
        "title": "Scope a voice assistant for my business FAQs",
        "inspired_by": "AIKO voice stack",
        "deliverable": "Call flow, sample intents, handoff rules, cost estimate inputs",
        "fields": [
            {"name": "business", "label": "Business name or type", "placeholder": "e.g. dental clinic", "required": True, "max": 120},
            {"name": "faqs", "label": "Top questions callers ask", "placeholder": "e.g. opening hours, prices, booking", "required": True, "max": 400},
            {"name": "notes", "label": "Anything specific? (optional)", "placeholder": "e.g. Filipino and English callers", "required": False, "max": 300},
        ],
        "sections": ["Goal", "Call flow", "Sample intents", "Handoff rules", "Cost estimate inputs", "Patterns from past work"],
        "queries": ["voice streaming Whisper Fish Audio WebSockets", "AIKO telephone operator answers inquiries", "Telavi click-to-call Groq"],
    },
    "workflow-audit": {
        "id": "workflow-audit",
        "title": "Find automation opportunities in my process",
        "inspired_by": "",
        "deliverable": "Ranked list of steps to automate, effort vs. impact",
        "fields": [
            {"name": "process", "label": "Describe your process, one step per line", "placeholder": "e.g.\nCustomer emails an order\nStaff copies it into a spreadsheet\nManager approves by message", "type": "textarea", "required": True, "max": 600},
        ],
        "sections": ["Goal", "Process as understood", "Ranked opportunities", "Suggested first step", "Patterns from past work"],
        "queries": ["workflow automation agentic AI", "replace phone-based manual process", "automation pipelines scheduled jobs"],
    },
}


def public_templates() -> list[dict]:
    return [
        {k: t[k] for k in ("id", "title", "inspired_by", "deliverable", "fields")}
        for t in TEMPLATES.values()
    ]


def validate_inputs(template_id: str, inputs: dict) -> dict:
    """Return cleaned inputs, or raise ValueError with a visitor-friendly message."""
    t = TEMPLATES.get(template_id)
    if t is None:
        raise ValueError("Unknown mission template.")
    clean: dict = {}
    for f in t["fields"]:
        raw = str(inputs.get(f["name"], "") or "").strip()
        if f.get("required") and not raw:
            raise ValueError(f"“{f['label']}” is required.")
        if len(raw) > f.get("max", 300):
            raise ValueError(f"“{f['label']}” is too long (max {f.get('max', 300)} characters).")
        if f.get("type") == "select" and raw and raw not in f["options"]:
            raise ValueError(f"“{f['label']}” must be one of: {', '.join(f['options'])}.")
        clean[f["name"]] = raw
    return clean
