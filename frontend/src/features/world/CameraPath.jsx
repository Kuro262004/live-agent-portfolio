import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useHero3D } from "../hero3d/store";
import { stations } from "./stations";

const goal = new THREE.Vector3();
const lookGoal = new THREE.Vector3();
const drift = new THREE.Vector3();
const toward = new THREE.Vector3();
const FLY = 0.25; // how far the camera slides toward the researcher on "Call my AI"

/**
 * Moves the one camera along a smooth path through the stations as the page scrolls, with a little cursor drift.
 * "Call my AI" slides the camera part of the way toward the researcher without turning it, so the node stays where
 * it is on screen and simply grows (about 1.3×) instead of swinging across the page text.
 */
export default function CameraPath({ progress, placement }) {
  const { camera } = useThree();
  const target = useHero3D((s) => s.cameraTarget);
  const look = useRef(new THREE.Vector3());
  const curves = useMemo(() => {
    const st = stations(placement);
    return {
      pos: new THREE.CatmullRomCurve3(st.map((s) => new THREE.Vector3(...s.camera))),
      look: new THREE.CatmullRomCurve3(st.map((s) => new THREE.Vector3(...s.look))),
    };
  }, [placement]);

  useFrame(({ pointer }, dt) => {
    const u = THREE.MathUtils.clamp(progress.current, 0, 1);
    // by segment, not arc length: station i is reached exactly at u = i / (stations - 1), however long each leg is
    curves.pos.getPoint(u, goal);
    curves.look.getPoint(u, lookGoal);
    if (target) {
      toward.set(...target).sub(goal).multiplyScalar(FLY);
      goal.add(toward);
      lookGoal.add(toward);
    } else {
      goal.add(drift.set(pointer.x * 0.35, pointer.y * 0.22, 0));
    }
    const k = 1 - Math.pow(0.0005, Math.min(dt, 0.1)); // frame-rate independent smoothing
    camera.position.lerp(goal, k);
    look.current.lerp(lookGoal, k);
    camera.lookAt(look.current);
  });
  return null;
}
