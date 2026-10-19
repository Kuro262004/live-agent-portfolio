import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { tokenColor } from "../hero3d/colors";
import { PANELS_OFFSET } from "./stations";

// one panel per shipped project, in the project cards' cover colours, fanned out and slowly turning
const PANELS = [
  { color: "planner", at: [-1.5, 0.35, 0.4], turn: 0.35 },
  { color: "builder", at: [0, -0.1, 0], turn: 0 },
  { color: "reviewer", at: [1.5, 0.3, 0.4], turn: -0.35 },
];

const BASE = [0.08, 0.6, 0.35, 0.35, 0.35];

function Panel({ color, at, turn, phase, fade }) {
  const ref = useRef(null);
  const mats = useRef([]); // [fill, outline, bar, bar, bar], each with its full opacity below
  const c = tokenColor(color);
  const edges = useMemo(() => new THREE.EdgesGeometry(new THREE.PlaneGeometry(1.2, 0.8)), []);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime * 0.5 + phase;
    ref.current.position.set(at[0], at[1] + Math.sin(t) * 0.06, at[2]);
    ref.current.rotation.set(Math.sin(t * 0.7) * 0.05, turn + Math.sin(t) * 0.08, 0);
    mats.current.forEach((m, i) => {
      if (m) m.opacity = BASE[i] * fade.current;
    });
  });
  return (
    <group ref={ref}>
      <mesh>
        <planeGeometry args={[1.2, 0.8]} />
        <meshBasicMaterial ref={(m) => (mats.current[0] = m)} color={c} transparent opacity={0} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <lineSegments geometry={edges}>
        <lineBasicMaterial ref={(m) => (mats.current[1] = m)} color={c} transparent opacity={0} />
      </lineSegments>
      {/* three "lines of text" on the cover: Goal → Built by → Result, as in the cards */}
      {[0.18, 0, -0.18].map((y, i) => (
        <mesh key={y} position={[-0.12 + i * 0.04, y, 0.001]}>
          <planeGeometry args={[0.7 - i * 0.12, 0.05]} />
          <meshBasicMaterial ref={(m) => (mats.current[2 + i] = m)} color={c} transparent opacity={0} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

const centre = new THREE.Vector3();

/**
 * Abstract floating project panels near the projects station; the real cards are the HTML in front. They fade in
 * only as the camera comes close, so they never drift into view behind other sections on the way.
 */
export default function ProjectPanels({ placement }) {
  const fade = useRef(0);
  const at = [placement.x + PANELS_OFFSET[0], placement.y + PANELS_OFFSET[1], PANELS_OFFSET[2]];
  useFrame(({ camera }) => {
    const d = camera.position.distanceTo(centre.set(...at));
    fade.current = THREE.MathUtils.clamp((12 - d) / 4, 0, 1); // full by ~8 units away, gone beyond 12
  });
  return (
    <group position={at}>
      {PANELS.map((p, i) => (
        <Panel key={p.color} {...p} phase={i * 1.7} fade={fade} />
      ))}
    </group>
  );
}
