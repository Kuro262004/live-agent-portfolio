const KEY = "theme";
const CHROME = { dark: "#0d1321", light: "#f7f3eb" };

/** The visitor's explicit choice, if any. Storage can be blocked, so every access is guarded. */
function storedTheme() {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : null;
  } catch {
    return null;
  }
}

function systemTheme() {
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export const initialTheme = () => storedTheme() ?? systemTheme();

/** Sets data-theme on <html> (the CSS tokens switch on it) and the browser chrome colour. */
export function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  document.querySelector("meta[name=theme-color]")?.setAttribute("content", CHROME[theme]);
}

export function rememberTheme(theme) {
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    // not remembered; the choice still applies for this visit
  }
}

/** Follow the operating system until the visitor makes their own choice. Returns a cleanup function. */
export function watchSystemTheme(onChange) {
  if (typeof window.matchMedia !== "function") return () => {};
  const mq = window.matchMedia("(prefers-color-scheme: light)");
  const handler = () => {
    if (!storedTheme()) onChange(mq.matches ? "light" : "dark");
  };
  mq.addEventListener?.("change", handler);
  return () => mq.removeEventListener?.("change", handler);
}
