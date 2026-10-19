import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useApp } from "../../stores/app";
import { tokenColor } from "../hero3d/colors";
import { lightAt, manilaHour } from "./manilaLight";

// colours arrive linear (tokenColor) and the include converts them back for the screen, so the sky matches the
// page's own CSS colours exactly
// slow fbm clouds of sun, coral and sky over the page colour (kept faint so text stays the focus), tinted by the
// time in the Philippines, with a few stars at night; uShift drifts the clouds as the camera travels
const frag = /* glsl */ `
  uniform float uTime, uTintAmount, uStars;
  uniform vec2 uShift, uAspect;
  uniform vec3 uBg, uA, uB, uC, uTint;
  varying vec2 vUv;
  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p){
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1,0)), u.x), mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), u.x), u.y);
  }
  float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++){ v += a * noise(p); p *= 2.0; a *= 0.5; } return v; }
  void main(){
    vec2 p = vUv * 2.2 + uShift;
    float t = uTime * 0.03;
    float n1 = fbm(p + vec2(t, -t));
    float n2 = fbm(p * 1.3 - vec2(t * 0.7, t * 0.4) + 4.0);
    vec3 col = mix(uBg, uTint, uTintAmount);
    col = mix(col, uA, smoothstep(0.55, 0.95, n1) * 0.09);
    col = mix(col, uB, smoothstep(0.60, 1.00, n2) * 0.07);
    col = mix(col, uC, smoothstep(0.65, 1.00, n1 * n2 * 1.6) * 0.06);
    vec2 g = (vUv + uShift * 0.25) * uAspect * 90.0;
    float star = step(0.9965, hash(floor(g))) * smoothstep(0.5, 0.0, length(fract(g) - 0.5));
    col += star * uStars * (0.55 + 0.45 * sin(uTime * 1.3 + hash(floor(g)) * 40.0));
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }`;
const vert = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.9999, 1.0); }`;

/** Recomputed every minute: the light is the Philippine sky right now, only in dark mode (the theme toggle wins). */
function light(theme) {
  if (theme === "light") return { tint: [1, 1, 1], strength: 0, stars: 0 };
  const l = lightAt(manilaHour());
  return { ...l, strength: l.strength * 0.45, stars: l.stars * 0.5 };
}

export default function Sky() {
  const mat = useRef(null);
  const theme = useApp((s) => s.theme);
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uShift: { value: new THREE.Vector2() },
      uAspect: { value: new THREE.Vector2(1, 1) },
      uBg: { value: new THREE.Color() },
      uA: { value: new THREE.Color() },
      uB: { value: new THREE.Color() },
      uC: { value: new THREE.Color() },
      uTint: { value: new THREE.Color() },
      uTintAmount: { value: 0 },
      uStars: { value: 0 },
    }),
    [],
  );
  // the theme toggle swaps the CSS tokens; recolour to match, and re-read the Philippine light every minute
  useEffect(() => {
    const apply = () => {
      uniforms.uBg.value.copy(tokenColor("bg"));
      uniforms.uA.value.copy(tokenColor("sun"));
      uniforms.uB.value.copy(tokenColor("builder"));
      uniforms.uC.value.copy(tokenColor("planner"));
      const l = light(theme);
      uniforms.uTint.value.setRGB(...l.tint, THREE.SRGBColorSpace);
      uniforms.uTintAmount.value = l.strength;
      uniforms.uStars.value = l.stars;
    };
    apply();
    const id = setInterval(apply, 60_000);
    return () => clearInterval(id);
  }, [theme, uniforms]);
  useFrame(({ clock, camera, size }) => {
    const u = mat.current.uniforms;
    u.uTime.value = clock.elapsedTime;
    u.uShift.value.set(camera.position.x * 0.03, camera.position.y * 0.03 - camera.position.z * 0.01);
    u.uAspect.value.set(size.width / size.height, 1);
  });
  return (
    <mesh frustumCulled={false} renderOrder={-1}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial ref={mat} uniforms={uniforms} vertexShader={vert} fragmentShader={frag} depthWrite={false} depthTest={false} />
    </mesh>
  );
}
