import { useEffect, useRef } from "react";
import { prefersReducedMotion, useOnScreen } from "../lib/motion";
import { useApp } from "../stores/app";

/** Faint dots behind the hero; neighbours connect and brighten near the cursor. Rests when another big animation is running. */
export default function Constellation() {
  const wrap = useRef(null);
  const canvas = useRef(null);
  const onScreen = useOnScreen(wrap);
  const busy = useApp((s) => s.missionRunning || s.callLive);
  const live = onScreen && !busy;
  const liveRef = useRef(live);
  liveRef.current = live;

  useEffect(() => {
    const el = canvas.current;
    const box = wrap.current;
    const ctx = el.getContext("2d");
    if (!ctx) return undefined; // no canvas support: the hero just has no background
    const reduced = prefersReducedMotion();
    const mouse = { x: -999, y: -999 };
    let w = 0;
    let h = 0;
    let dots = [];
    let raf = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = box.clientWidth;
      h = box.clientHeight;
      el.width = w * dpr;
      el.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = w < 640 ? 20 : 50;
      dots = Array.from({ length: n }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() - 0.5) * 0.25,
      }));
      draw();
    };

    // faint city lights on the night route, in the muted text colour so they never compete with the content
    const sun = (getComputedStyle(document.documentElement).getPropertyValue("--mute").trim() || "148 156 176").split(/\s+/).join(",");

    function draw() {
      ctx.clearRect(0, 0, w, h);
      const reach = w < 640 ? 90 : 130;
      for (let i = 0; i < dots.length; i++) {
        const a = dots[i];
        const ma = Math.hypot(a.x - mouse.x, a.y - mouse.y);
        ctx.fillStyle = `rgba(${sun},${ma < 160 ? 0.7 : 0.35})`;
        ctx.beginPath();
        ctx.arc(a.x, a.y, 1.4, 0, 6.283);
        ctx.fill();
        for (let j = i + 1; j < dots.length; j++) {
          const b = dots[j];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d > reach) continue;
          const near = Math.min(ma, Math.hypot(b.x - mouse.x, b.y - mouse.y)) < 160;
          ctx.strokeStyle = `rgba(${sun},${(1 - d / reach) * (near ? 0.5 : 0.14)})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
    }

    function step() {
      if (liveRef.current) {
        for (const d of dots) {
          d.x += d.vx;
          d.y += d.vy;
          if (d.x < 0 || d.x > w) d.vx *= -1;
          if (d.y < 0 || d.y > h) d.vy *= -1;
        }
        draw();
      }
      raf = requestAnimationFrame(step);
    }

    const onMove = (e) => {
      const r = box.getBoundingClientRect();
      mouse.x = e.clientX - r.left;
      mouse.y = e.clientY - r.top;
    };
    const ro = new ResizeObserver(resize);
    ro.observe(box);
    resize();
    if (!reduced) {
      window.addEventListener("pointermove", onMove, { passive: true });
      raf = requestAnimationFrame(step);
    } // reduced motion: the single static frame drawn by resize()

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("pointermove", onMove);
    };
  }, []);

  return (
    <div ref={wrap} className="constellation pointer-events-none absolute inset-0 -z-0" aria-hidden="true">
      <canvas ref={canvas} className="h-full w-full" />
    </div>
  );
}
