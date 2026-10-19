import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Replays a finished mission's events with their original spacing (each gap kept between 120 ms and 1.2 s so a
 * replay never drags). `events` is what the graph and log show: the live list, or the replayed slice while replaying.
 */
export function useReplay(events) {
  const [shown, setShown] = useState(null); // null = not replaying
  const timers = useRef([]);

  const stop = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setShown(null);
  }, []);

  const start = useCallback(() => {
    stop();
    if (!events.length) return;
    let prev = Date.parse(events[0].timestamp);
    let at = 0;
    setShown([]);
    events.forEach((e, i) => {
      const t = Date.parse(e.timestamp);
      at += Math.min(Math.max(t - prev, 120), 1200);
      prev = t;
      timers.current.push(
        setTimeout(() => {
          setShown(events.slice(0, i + 1));
          if (i === events.length - 1) timers.current.push(setTimeout(() => setShown(null), 500));
        }, at),
      );
    });
  }, [events, stop]);

  useEffect(() => stop, [stop]);

  return { replaying: shown !== null, events: shown ?? events, start, stop };
}
