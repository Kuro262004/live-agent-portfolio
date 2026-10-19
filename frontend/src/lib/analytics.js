/**
 * Privacy-friendly product analytics (Plausible). A no-op unless the Plausible script was injected at build time
 * (set VITE_PLAUSIBLE_DOMAIN), so visitors are never tracked by default. Events carry no personal data.
 */
export function track(event, props) {
  try {
    if (typeof window.plausible === "function") window.plausible(event, props ? { props } : undefined);
  } catch {
    /* analytics must never break the page */
  }
}
