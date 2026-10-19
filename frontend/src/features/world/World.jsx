import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { useActiveSection } from "../../lib/useActiveSection";
import { useGraphics } from "../../lib/useRichMode";
import { useApp } from "../../stores/app";
import { useHero3D } from "../hero3d/store";
import CameraPath from "./CameraPath";
import NameParticles from "./NameParticles";
import Network from "./Network";
import ProjectPanels from "./ProjectPanels";
import Sky from "./Sky";
import { HOME } from "./stations";
import { useWorld } from "./store";
import { useWorldProgress } from "./useWorldProgress";

const NETWORK_WIDTH = 6.4; // the network's own width (planner to reviewer plus their glow), in world units
const NETWORK_CENTER_X = 0.2; // its centre is a little right of the origin
// long-reading sections: the world steps back (dims) so the text has the stage
const SECTIONS = ["mission", "about", "skills", "experience", "projects", "bestiary", "evolution", "hire", "contact"];
const READING = new Set(["about", "bestiary", "evolution"]);

/**
 * Where to put the network so that, seen from the home camera, it fills the hero's picture box (#hero-visual) when
 * the page is at the top. Page coordinates, so it is right whatever the current scroll.
 */
function measure() {
  const box = document.getElementById("hero-visual");
  if (!box) return { x: 2.2, y: 0, scale: 0.75 };
  const r = box.getBoundingClientRect();
  const H = HOME.camera[2] * Math.tan(THREE.MathUtils.degToRad(HOME.fov / 2));
  const W = H * (window.innerWidth / window.innerHeight);
  const cx = r.left + r.width / 2;
  const cy = r.top + window.scrollY + r.height / 2 - 24; // a little above centre, clear of the legend row
  const scale = Math.min(1.1, ((r.width / window.innerWidth) * 2 * W) / NETWORK_WIDTH);
  return { x: ((cx / window.innerWidth) * 2 - 1) * W - NETWORK_CENTER_X * scale, y: -((cy / window.innerHeight) * 2 - 1) * H, scale };
}

function usePlacement() {
  const placement = useWorld((s) => s.placement);
  const setPlacement = useWorld((s) => s.setPlacement);
  useEffect(() => {
    let frame;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setPlacement(measure()));
    };
    update();
    window.addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", update);
    };
  }, [setPlacement]);
  return placement;
}

/** Hidden tab: stop rendering entirely. */
function usePageVisible() {
  const [visible, setVisible] = useState(() => !document.hidden);
  useEffect(() => {
    const on = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", on);
    return () => document.removeEventListener("visibilitychange", on);
  }, []);
  return visible;
}

/** Counts frames for two seconds after start; below ~40 fps the site switches to the 2D version for this visit. */
function FpsGuard() {
  const frames = useRef(0);
  const start = useRef(null);
  const done = useRef(false);
  useFrame(({ clock }) => {
    if (done.current) return;
    start.current ??= clock.elapsedTime;
    frames.current += 1;
    const elapsed = clock.elapsedTime - start.current;
    if (elapsed >= 2) {
      done.current = true;
      if (frames.current / elapsed < 40 && useGraphics.getState().mode === "auto") useGraphics.getState().markSlow();
    }
  });
  return null;
}

/** Tells the page once the first frame is on screen, so the hero's 2D stand-in can step aside. */
function ReadySignal() {
  const said = useRef(false);
  useFrame(() => {
    if (said.current) return;
    said.current = true;
    useWorld.getState().setReady();
  });
  return null;
}

/**
 * Rich mode: ONE fixed canvas behind the whole site (one WebGL context, one render loop). The sky, the agent
 * network, the project panels and the particle name are one world; scrolling moves the camera through it while the
 * HTML scrolls normally on top. Decorative throughout: aria-hidden, never focusable, no pointer events.
 */
export default function World() {
  const placement = usePlacement();
  const progress = useWorldProgress();
  const visible = usePageVisible();
  const theme = useApp((s) => s.theme);
  const active = useActiveSection(SECTIONS);
  const light = theme === "light";
  const callOpen = useApp((s) => s.callOpen);
  // after a call, the camera goes back to following the page
  useEffect(() => {
    if (!callOpen) useHero3D.getState().reset();
  }, [callOpen]);
  return (
    <div className="pointer-events-none fixed inset-0 -z-10" aria-hidden="true">
      {placement && (
        <Canvas
          frameloop={visible ? "always" : "never"}
          dpr={[1, 1.5]}
          camera={{ position: HOME.camera, fov: HOME.fov }}
          gl={{ antialias: true, powerPreference: "high-performance" }}
          tabIndex={-1}
        >
          <Sky />
          <Network placement={placement} light={light} />
          <ProjectPanels placement={placement} />
          <NameParticles placement={placement} light={light} />
          <CameraPath progress={progress} placement={placement} />
          <FpsGuard />
          <ReadySignal />
        </Canvas>
      )}
      <div className="absolute inset-0 bg-void transition-opacity duration-700" style={{ opacity: READING.has(active) ? 0.45 : 0 }} />
    </div>
  );
}
