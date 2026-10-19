const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY;
let scriptPromise;

function loadScript() {
  scriptPromise ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    s.async = true;
    s.onload = resolve;
    s.onerror = () => reject(new Error("Verification could not load"));
    document.head.appendChild(s);
  });
  return scriptPromise;
}

/** Resolves to a Turnstile token, or null when the server doesn't require one (local dev / no key). */
export async function getCaptchaToken(required) {
  if (!required) return null;
  if (!SITE_KEY) throw new Error("Verification is required but VITE_TURNSTILE_SITE_KEY is not set.");
  await loadScript();
  return new Promise((resolve, reject) => {
    const host = document.createElement("div");
    host.style.cssText = "position:fixed;bottom:16px;right:16px;z-index:60";
    document.body.appendChild(host);
    const done = (fn) => (arg) => {
      window.turnstile.remove(id);
      host.remove();
      fn(arg);
    };
    const id = window.turnstile.render(host, {
      sitekey: SITE_KEY,
      theme: "dark",
      callback: done(resolve),
      "error-callback": done(() => reject(new Error("Verification failed. Please try again."))),
    });
  });
}
