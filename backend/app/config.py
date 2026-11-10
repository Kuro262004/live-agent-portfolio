import json

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    environment: str = "development"
    database_url: str = "sqlite:///./portfolio.db"
    cors_origins: str = "http://localhost:5173"

    supabase_url: str = ""
    supabase_service_key: str = ""

    groq_api_key: str = ""
    anthropic_api_key: str = ""
    fish_audio_api_key: str = ""
    fish_audio_voice_id: str = ""
    # Optional Fish Audio model (sent as the `model` header). Empty uses Fish's default; the free developer
    # tier uses "s2.1-pro-free".
    fish_audio_model: str = ""

    github_token: str = ""
    github_username: str = "Kuro262004"
    evolve_secret: str = ""
    captcha_secret: str = ""
    booking_url: str = ""

    # Models
    groq_chat_model: str = "llama-3.3-70b-versatile"
    # tried in order when the model above is not available on your Groq account (Groq retires and renames models)
    groq_chat_fallbacks: str = "openai/gpt-oss-120b,openai/gpt-oss-20b,llama-3.1-8b-instant"
    groq_stt_model: str = "whisper-large-v3-turbo"
    anthropic_model: str = "claude-sonnet-5-5"

    # Budget caps (daily, hard stop)
    daily_token_limit: int = 200_000
    daily_voice_seconds_limit: int = 3600
    daily_tts_chars_limit: int = 60_000
    daily_missions_limit: int = 100

    # Per-IP limits (daily)
    ip_calls_per_day: int = 2
    # missions, shared plans and call records (with IP addresses) are deleted after this many days; 0 keeps them forever
    retention_days: int = 30
    ip_missions_per_day: int = 3

    # Local testing only: skip the per-IP daily limits for requests from this machine while ENVIRONMENT is
    # "development" (or "dev"). Never applies in production or to other IPs. Set DEV_BYPASS_LIMITS=false to test the limits.
    dev_bypass_limits: bool = True

    # Prices per million tokens, keyed "groq:<model>" / "anthropic:<model>", as JSON, e.g.
    # PRICES_PER_MTOK={"groq:llama-3.3-70b-versatile": {"input": 0.0, "output": 0.0}}
    # Fill in from each provider's current pricing page; with no entry, cost shows as "price not set".
    prices_per_mtok: str = "{}"

    # Ask-to-navigate (plain-language palette questions) per visitor per day
    ip_navigate_per_day: int = 30

    # Visitor input limits
    max_input_chars: int = 600
    max_call_seconds: int = 180
    call_wrapup_seconds: int = 150

    @property
    def sqlalchemy_url(self) -> str:
        url = self.database_url
        for prefix in ("postgres://", "postgresql://"):
            if url.startswith(prefix):
                return "postgresql+psycopg://" + url[len(prefix):]
        return url

    @property
    def prices(self) -> dict[str, dict[str, float]]:
        try:
            data = json.loads(self.prices_per_mtok or "{}")
        except ValueError:
            return {}
        return data if isinstance(data, dict) else {}

    @property
    def cors_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def is_production(self) -> bool:
        return self.environment.lower() == "production"


def check_production_settings() -> None:
    """Refuse to start in production with a configuration that would let bots burn the AI budget."""
    if not settings.is_production:
        return
    problems = []
    ai_on = any([settings.groq_api_key, settings.anthropic_api_key, settings.fish_audio_api_key])
    if ai_on and not settings.captcha_secret:
        problems.append("AI keys are set but CAPTCHA_SECRET is not: bots could burn your budget. Set CAPTCHA_SECRET (Cloudflare Turnstile).")
    if not settings.cors_list or all("localhost" in o or "127.0.0.1" in o for o in settings.cors_list):
        problems.append("CORS_ORIGINS still points at localhost. Set it to your site's URL.")
    if problems:
        raise RuntimeError("Unsafe production configuration:\n- " + "\n- ".join(problems))


settings = Settings()
