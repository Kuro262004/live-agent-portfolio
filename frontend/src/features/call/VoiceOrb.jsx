import { useEffect, useRef } from "react";
import { audioLevels } from "../../lib/audioLevel";
import { prefersReducedMotion, useOnScreen } from "../../lib/motion";

/**
 * Glowing orb that follows real audio levels (written by the mic tap and the playback analyser).
 * listening: the visitor's mic level. thinking: a slow rotating gradient. speaking: the AI's output level.
 * With the browser's own speech (no audio stream to measure) it fakes a gentle pulse while speaking.
 */
export default function VoiceOrb({ state, measured }) {
  const ref = useRef(null);
  const onScreen = useOnScreen(ref);

  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion() || !onScreen || state === "thinking") return undefined;
    let raf;
    let cur = 0;
    const t0 = performance.now();
    const loop = (now) => {
      let target = 0.04;
      if (state === "speaking") target = measured.out ? audioLevels.out : 0.35 + 0.25 * Math.sin((now - t0) / 140);
      else if (state === "listening" && measured.mic) target = audioLevels.mic;
      cur += (target - cur) * 0.3;
      el.style.setProperty("--level", cur.toFixed(3));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [state, measured.mic, measured.out, onScreen]);

  return (
    <span
      ref={ref}
      data-state={state}
      aria-hidden="true"
      className={`block h-10 w-10 shrink-0 rounded-full ${state === "thinking" ? "orb-thinking" : "orb"}`}
    />
  );
}
