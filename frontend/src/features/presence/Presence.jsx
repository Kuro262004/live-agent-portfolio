import { useEffect, useRef, useState } from "react";
import { wsUrl } from "../../lib/api";
import { prefersReducedMotion } from "../../lib/motion";
import { useActiveSection } from "../../lib/useActiveSection";
import { useApp } from "../../stores/app";

const SECTIONS = ["mission", "about", "skills", "experience", "projects", "bestiary", "evolution", "hire", "contact"];
const IDLE_MS = 10_000; // a dot that hasn't moved for 10 s fades out
const SEND_MS = 150; // at most ~6 position updates a second

/**
 * Other visitors, live and anonymous: a random id per visit, a pointer position and the section being viewed,
 * relayed by the server and never stored. Their dots show only when they're looking at the same section you are;
 * the head count goes to the hero.
 */
export default function Presence() {
  const active = useActiveSection(SECTIONS) ?? "top";
  const activeRef = useRef(active);
  activeRef.current = active;
  const setCount = useApp((s) => s.setPresenceCount);
  const [peers, setPeers] = useState({});

  useEffect(() => {
    let ws;
    let retry;
    let tries = 0;
    let last = 0;
    let closed = false;
    const connect = () => {
      try {
        ws = new WebSocket(wsUrl("/ws/presence"));
      } catch {
        return;
      }
      ws.onopen = () => (tries = 0);
      ws.onmessage = (m) => {
        const msg = JSON.parse(m.data);
        if (msg.type === "count") setCount(msg.n);
        else if (msg.type === "move") setPeers((p) => ({ ...p, [msg.id]: { ...msg, at: Date.now() } }));
        else if (msg.type === "leave")
          setPeers((p) => {
            const next = { ...p };
            delete next[msg.id];
            return next;
          });
      };
      ws.onclose = () => {
        setCount(null);
        if (!closed && tries++ < 5) retry = setTimeout(connect, 5000 * tries); // the server may be waking up
      };
    };
    connect();
    const onMove = (e) => {
      const now = performance.now();
      if (now - last < SEND_MS || ws?.readyState !== 1) return;
      last = now;
      ws.send(JSON.stringify({ type: "move", x: e.clientX / window.innerWidth, y: e.clientY / window.innerHeight, section: activeRef.current }));
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    // forget dots that went quiet
    const sweep = setInterval(() => setPeers((p) => Object.fromEntries(Object.entries(p).filter(([, v]) => Date.now() - v.at < IDLE_MS + 1000))), 2000);
    return () => {
      closed = true;
      clearTimeout(retry);
      clearInterval(sweep);
      window.removeEventListener("pointermove", onMove);
      ws?.close();
      setCount(null);
    };
  }, [setCount]);

  const still = prefersReducedMotion();
  const here = Object.values(peers).filter((p) => p.section === active);
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[65]">
      {here.map((p) => (
        <span
          key={p.id}
          className={`absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-researcher/70 ring-4 ring-researcher/15 ${still ? "" : "transition-[left,top,opacity] duration-200 ease-out"}`}
          style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%`, opacity: Date.now() - p.at < IDLE_MS ? 1 : 0 }}
        />
      ))}
    </div>
  );
}
