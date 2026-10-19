import { useEffect, useMemo, useRef, useState } from "react";
import { getMission, wsUrl } from "../../lib/api";

/**
 * Streams a mission's events over the WebSocket; on a failed socket it falls back to polling. Trace spans arrive on
 * the same stream; they are handed back separately so the graph, log and receipt see only the visible steps.
 */
export function useMission(missionId) {
  const [all, setEvents] = useState([]);
  const [mission, setMission] = useState(null);
  const [error, setError] = useState(null);
  const doneRef = useRef(false);

  useEffect(() => {
    setEvents([]);
    setMission(null);
    setError(null);
    doneRef.current = false;
    if (!missionId) return undefined;

    let cancelled = false;
    let ws;
    let pollTimer;

    const finish = async () => {
      try {
        const m = await getMission(missionId);
        if (cancelled) return;
        setMission(m);
        setEvents(m.events);
        if (m.status === "running" || m.status === "queued") pollTimer = setTimeout(finish, 1200);
        else doneRef.current = true;
      } catch (e) {
        if (!cancelled) setError(e.message);
      }
    };

    try {
      ws = new WebSocket(wsUrl(`/ws/missions/${missionId}`));
      ws.onmessage = (msg) => {
        const ev = JSON.parse(msg.data);
        setEvents((prev) => (prev.some((p) => p.seq === ev.seq) ? prev : [...prev, ev]));
        if (ev.type === "complete" || ev.type === "error") {
          doneRef.current = true;
          finish();
        }
      };
      ws.onerror = () => {
        if (!doneRef.current) finish();
      };
      ws.onclose = () => {
        if (!doneRef.current) finish();
      };
    } catch {
      finish();
    }

    return () => {
      cancelled = true;
      clearTimeout(pollTimer);
      if (ws) {
        ws.onclose = null;
        ws.onerror = null;
        ws.close();
      }
    };
  }, [missionId]);

  const events = useMemo(() => all.filter((e) => e.type !== "span"), [all]);
  const spans = useMemo(() => all.filter((e) => e.span).map((e) => ({ ...e.span, seq: e.seq })), [all]);
  return { events, spans, mission, error };
}
