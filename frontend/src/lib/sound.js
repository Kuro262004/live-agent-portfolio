const KEY = "sound";

/** Sound is off by default and remembered per visitor. Storage can be blocked, so every access is guarded. */
export function soundEnabled() {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function rememberSound(on) {
  try {
    localStorage.setItem(KEY, on ? "1" : "0");
  } catch {
    /* blocked storage: the choice only lasts for this page view */
  }
}

let ctx;

function tone(freq, duration, delay = 0, gain = 0.035) {
  try {
    ctx ??= new AudioContext();
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    amp.gain.setValueAtTime(gain, t);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(amp).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + duration);
  } catch {
    /* no audio support: stay silent */
  }
}

/** Soft tick on each handoff. */
export const tick = () => tone(880, 0.05);

/** Two-note chime when the deliverable is ready. */
export function chime() {
  tone(660, 0.14);
  tone(990, 0.22, 0.12);
}
