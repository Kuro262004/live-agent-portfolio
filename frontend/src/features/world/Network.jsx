import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { audioLevels } from "../../lib/audioLevel";
import { edgeGlow } from "../../lib/worldBus";
import { tokenColor } from "../hero3d/colors";
import { NODES } from "../hero3d/store";

export const EDGES = [
  ["planner", "researcher"],
  ["brain", "researcher"],
  ["researcher", "builder"],
  ["builder", "reviewer"],
];

/** A soft round glow, drawn once and shared by every halo (a cheap stand-in for a bloom pass). */
let glowTexture = null;
function glow() {
  if (glowTexture) return glowTexture;
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.25, "rgba(255,255,255,0.45)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  glowTexture = new THREE.CanvasTexture(canvas);
  glowTexture.colorSpace = THREE.SRGBColorSpace;
  return glowTexture;
}

/** Light on navy adds up (additive glow); on paper it would wash out, so it is laid on softly instead. */
function Halo({ color, scale, light, haloRef }) {
  return (
    <sprite ref={haloRef} scale={[scale, scale, 1]}>
      <spriteMaterial map={glow()} color={color} transparent depthWrite={false} opacity={light ? 0.35 : 0.85} blending={light ? THREE.NormalBlending : THREE.AdditiveBlending} />
    </sprite>
  );
}

/** How loud the AI is right now (0..1): the measured playback level, or a gentle pulse for the browser's own voice. */
function voice(now) {
  if (!audioLevels.speaking) return 0;
  return audioLevels.out > 0.01 ? audioLevels.out : 0.35 + 0.25 * Math.sin(now / 140);
}

/** A glowing node that bobs gently in place, with a faint orbit ring. The researcher doubles as the voice orb. */
function Node({ id, pos, color, phase, light }) {
  const group = useRef(null);
  const ring = useRef(null);
  const halo = useRef(null);
  const level = useRef(0);
  const c = tokenColor(color); // read on every render: the theme toggle re-renders the scene, which recolours it
  useFrame(({ clock }) => {
    const t = clock.elapsedTime * 1.2 + phase;
    group.current.position.set(pos[0], pos[1] + Math.sin(t) * 0.08, pos[2]);
    group.current.rotation.y = Math.sin(t * 0.5) * 0.2;
    ring.current.rotation.z = t * 0.15;
    if (id === "researcher") {
      level.current += (voice(performance.now()) - level.current) * 0.3;
      const l = level.current;
      group.current.scale.setScalar(1 + l * 0.6);
      halo.current.scale.setScalar(1.7 * (1 + l * 1.2));
    }
  });
  return (
    <group ref={group}>
      <Halo color={c} scale={1.7} light={light} haloRef={halo} />
      <mesh>
        <sphereGeometry args={[0.28, 48, 48]} />
        <meshBasicMaterial color={c} />
      </mesh>
      <mesh ref={ring}>
        <ringGeometry args={[0.42, 0.45, 64]} />
        <meshBasicMaterial color={c} transparent opacity={0.35} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

/** A faint line between two agents with a bright packet travelling along it; both flare while a tool uses the edge. */
function Trail({ from, to, ids, color, light, speed = 0.35, offset = 0 }) {
  const packet = useRef(null);
  const travelled = useRef(offset);
  const a = useMemo(() => new THREE.Vector3(...from), [from]);
  const b = useMemo(() => new THREE.Vector3(...to), [to]);
  const c = tokenColor(color);
  const line = useMemo(() => {
    const geometry = new THREE.BufferGeometry().setFromPoints([a, b]);
    return new THREE.Line(geometry, new THREE.LineBasicMaterial({ transparent: true, opacity: 0.3 }));
  }, [a, b]);
  useEffect(() => {
    line.material.color.copy(c);
  }, [line, c]);
  useEffect(
    () => () => {
      line.geometry.dispose();
      line.material.dispose();
    },
    [line],
  );
  useFrame((_, dt) => {
    const g = edgeGlow(ids[0], ids[1]);
    line.material.opacity = 0.3 + g * 0.6;
    travelled.current += dt * speed * (1 + g * 3);
    const t = travelled.current % 1;
    packet.current.position.lerpVectors(a, b, t);
    packet.current.scale.setScalar((Math.sin(t * Math.PI) + 0.1) * (1 + g * 0.8));
  });
  return (
    <>
      <primitive object={line} />
      <group ref={packet}>
        <Halo color={c} scale={0.45} light={light} />
        <mesh>
          <sphereGeometry args={[0.07, 16, 16]} />
          <meshBasicMaterial color={c} />
        </mesh>
      </group>
    </>
  );
}

/** The five agents and their links, placed so they line up with the hero's picture box at the top of the page. */
export default function Network({ placement, light }) {
  return (
    <group position={[placement.x, placement.y, 0]} scale={placement.scale}>
      {Object.entries(NODES).map(([id, n], i) => (
        <Node key={id} id={id} pos={n.pos} color={n.color} phase={i * 1.3} light={light} />
      ))}
      {EDGES.map(([f, t], i) => (
        <Trail key={f + t} ids={[f, t]} from={NODES[f].pos} to={NODES[t].pos} color={NODES[t].color} light={light} offset={i * 0.25} />
      ))}
    </group>
  );
}
