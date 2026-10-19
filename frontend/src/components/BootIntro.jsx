import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { prefersReducedMotion } from "../lib/motion";

const KEY = "bootSeen";

function seen() {
  try {
    return sessionStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

/** True when the boot intro should play: once per session, never with reduced motion. */
export const shouldBoot = () => !prefersReducedMotion() && !seen();

/** The boot lines report real state: whether the server answered, and which voice stack is available. */
export function bootLines(status) {
  if (!status) {
    return ["> loading shared brain…  ok", "> agents: 4/4 ready", "> voice: checking…"];
  }
  const voice = status.voice.stt && status.voice.tts ? "server (Whisper + Fish Audio)" : "browser speech";
  const mode = !status.llm ? "scripted" : status.fallback ? "recorded runs: today's AI budget is used up" : "live";
  return ["> loading shared brain…  ok", `> agents: 4/4 ready (${mode})`, `> voice: ${voice}`];
}

/** Terminal boot under 1.2 s. Any click or key skips it. */
export default function BootIntro({ status, onDone }) {
  const [shown, setShown] = useState(0);
  const lines = bootLines(status);

  useEffect(() => {
    const finish = () => {
      try {
        sessionStorage.setItem(KEY, "1");
      } catch {
        /* storage blocked: the intro may replay on reload, which is harmless */
      }
      onDone();
    };
    const timers = [1, 2, 3].map((n) => setTimeout(() => setShown(n), n * 150));
    timers.push(setTimeout(finish, 550)); // the name decodes next (~600 ms), so the whole intro is about 1.2 s
    window.addEventListener("pointerdown", finish, { once: true });
    window.addEventListener("keydown", finish, { once: true });
    return () => {
      timers.forEach(clearTimeout);
      window.removeEventListener("pointerdown", finish);
      window.removeEventListener("keydown", finish);
    };
  }, [onDone]);

  return (
      <motion.div
        className="absolute inset-0 z-10 bg-void pt-12 font-mono text-sm text-reviewer sm:pt-20"
        initial={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        role="status"
        aria-label="Starting up"
      >
        {lines.slice(0, shown).map((l) => (
          <p key={l}>{l}</p>
        ))}
        <span className="inline-block h-4 w-2 animate-pulse bg-reviewer align-middle" aria-hidden="true" />
        <p className="mt-4 text-[11px] text-mute">click or press any key to skip</p>
      </motion.div>
  );
}

