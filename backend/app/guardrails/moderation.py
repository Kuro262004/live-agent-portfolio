"""Basic input/output moderation. A local filter, not a substitute for a hosted moderation model."""
import re

from ..config import settings

_INJECTION = re.compile(
    r"(ignore (all |any |the )?(previous|prior|above) (instructions|prompts?)|"
    r"disregard (your|the) (system )?(prompt|instructions)|reveal (your|the) (system )?prompt|"
    r"you are now |act as (?!a customer)|jailbreak|developer mode)", re.I)
_ABUSE = re.compile(r"\b(fuck|shit|bitch|asshole|nigg\w+|faggot|cunt|retard(ed)?)\b", re.I)
_SECRET = re.compile(r"(sk-[A-Za-z0-9]{16,}|gsk_[A-Za-z0-9]{16,}|ghp_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16})")


class Rejected(ValueError):
    pass


def check_input(text: str, *, limit: int | None = None) -> str:
    text = (text or "").strip()
    limit = limit or settings.max_input_chars
    if not text:
        raise Rejected("Please enter something.")
    if len(text) > limit:
        raise Rejected(f"Please keep it under {limit} characters.")
    if _INJECTION.search(text):
        raise Rejected("That looks like an attempt to change my instructions, so I can't use it.")
    if _ABUSE.search(text):
        raise Rejected("Let's keep it respectful.")
    return text


def clean_output(text: str) -> str:
    """Strip anything that looks like a credential before it reaches a visitor."""
    return _SECRET.sub("[redacted]", text)
