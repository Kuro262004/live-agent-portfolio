import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { jumpTo, prefersReducedMotion } from "../lib/motion";
import { usePortfolio } from "../lib/queries";
import { timeAgo } from "../lib/time";
import { useApp } from "../stores/app";

const KEY = "notified";
const seen = () => {
  try {
    return sessionStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
};
const markSeen = () => {
  try {
    sessionStorage.setItem(KEY, "1");
  } catch {
    // shown again on reload; harmless
  }
};

/**
 * First visit only: a few small notices built from the real changelog (no made-up activity), one at a time,
 * bottom-left on desktop (clear of the hero picture and the call panel) and above the action bar on phones.
 * On phones the notice would sit on top of the hero's "Call my AI" / "Give my agents a task" buttons, so it
 * waits until the visitor has scrolled past the hero.
 */
export default function Notifications() {
  const { data } = usePortfolio();
  const bootDone = useApp((s) => s.bootDone);
  const [queue, setQueue] = useState([]);
  const [index, setIndex] = useState(0);
  // The hero already shows "Now building", so the notices are changelog items only.
  const items = data.changelog.slice(0, 3).map((c, i) => ({
    id: `c${i}`,
    title: `Portfolio${c.published_at ? ` · ${timeAgo(c.published_at)}` : ""}`,
    text: c.entry,
    target: "evolution",
  }));
  const key = items.map((i) => i.id).join();

  // start the queue a moment after the boot intro
  useEffect(() => {
    if (!bootDone || prefersReducedMotion() || seen() || items.length === 0) return undefined;
    const phone = window.matchMedia("(max-width: 639px)").matches;
    let t;
    const start = () => {
      markSeen();
      t = setTimeout(() => setQueue(items.slice(0, phone ? 1 : 3)), 1500);
    };
    if (!phone) {
      start();
      return () => clearTimeout(t);
    }
    const onScroll = () => {
      if (window.scrollY < window.innerHeight) return;
      window.removeEventListener("scroll", onScroll);
      start();
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bootDone, key]);

  const current = queue[index];
  // each notice stays 6 s unless dismissed; the next one follows after a short pause
  useEffect(() => {
    if (!current) return undefined;
    const t = setTimeout(() => setIndex((i) => i + 1), 6000);
    return () => clearTimeout(t);
  }, [current]);

  const next = () => setIndex((i) => i + 1);
  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed bottom-4 left-4 z-40 w-[min(20rem,calc(100vw-2rem))] max-md:bottom-24 max-sm:left-1/2 max-sm:-translate-x-1/2">
      <AnimatePresence mode="popLayout">
        {current && (
          <motion.div
            key={current.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.25 }}
            className="pointer-events-auto flex items-start gap-2 rounded-[14px] border border-rule/10 bg-raised p-3 shadow-2xl"
          >
            <button
              type="button"
              onClick={() => {
                jumpTo(current.target);
                setQueue([]); // they went to read the changelog itself: no more notices
              }}
              className="min-w-0 flex-1 text-left"
            >
              <span className="flex items-center gap-1.5 font-mono text-[11px] text-researcher">
                <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-researcher" /> {current.title}
              </span>
              <span className="mt-0.5 line-clamp-3 block text-xs leading-5 text-ink/90">{current.text}</span>
            </button>
            <button type="button" onClick={next} aria-label="Dismiss notification" className="rounded p-0.5 text-mute hover:text-ink">
              <X size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
