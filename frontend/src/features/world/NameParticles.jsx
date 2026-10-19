import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useApp } from "../../stores/app";
import { tokenColor } from "../hero3d/colors";
import { NODES } from "../hero3d/store";
import { EDGES } from "./Network";
import { HOME, nodeWorld } from "./stations";
import { useWorld } from "./store";

const COUNT = 4000;
const FORM = 0.9; // seconds: scattered dust gathers into the name
const HOLD = 0.8; // the name holds
const SCATTER = 1.6; // it scatters into the network

/** Pixels of the heading's text (drawn in its own font and size), as page coordinates of the filled pixels. */
async function sampleHeading(el) {
  await document.fonts.ready;
  const r = el.getBoundingClientRect();
  const style = getComputedStyle(el);
  const text = el.getAttribute("aria-label") || el.textContent;
  const w = Math.ceil(r.width);
  const h = Math.ceil(r.height);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  let size = parseFloat(style.fontSize);
  ctx.font = `${style.fontWeight} ${size}px ${style.fontFamily}`;
  if ("letterSpacing" in ctx && style.letterSpacing !== "normal") ctx.letterSpacing = style.letterSpacing; // the heading is tracked tight
  const measured = ctx.measureText(text).width;
  if (measured > w) {
    size *= w / measured;
    ctx.font = `${style.fontWeight} ${size}px ${style.fontFamily}`;
  }
  ctx.fillStyle = "#fff";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 0, h / 2);
  const data = ctx.getImageData(0, 0, w, h).data;
  const pts = [];
  for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) if (data[(y * w + x) * 4 + 3] > 128) pts.push([r.left + x, r.top + window.scrollY + y]);
  return pts;
}

/** A page pixel (at the top of the page) on the z = 0 plane, as seen by the home camera. */
function toWorld([px, py]) {
  const H = HOME.camera[2] * Math.tan(THREE.MathUtils.degToRad(HOME.fov / 2));
  const W = H * (window.innerWidth / window.innerHeight);
  return [(px / window.innerWidth) * 2 - 1, -((py / window.innerHeight) * 2 - 1)].map((v, i) => v * (i ? H : W));
}

const vertex = /* glsl */ `
  attribute vec3 aStart; attribute vec3 aText; attribute vec3 aA; attribute vec3 aB; attribute vec3 aColor;
  attribute float aRand; attribute float aT;
  uniform float uTime, uForm, uScatter, uPixel;
  uniform vec3 uInk;
  varying vec3 vColor; varying float vAlpha;
  void main(){
    vec3 formed = mix(aStart, aText, smoothstep(aRand * 0.3, aRand * 0.3 + 0.7, uForm));
    float tt = fract(aT + uTime * (0.04 + aRand * 0.05));
    // a loose stream around each edge rather than a single file: spread across the edge, wobbling gently
    vec3 dir = normalize(aB - aA);
    vec3 side = normalize(cross(dir, vec3(0.0, 0.0, 1.0)));
    float spread = (fract(aRand * 53.0) - 0.5) * 0.22 * sin(tt * 3.14159);
    vec3 net = mix(aA, aB, tt) + side * spread + 0.03 * vec3(sin(uTime * 2.0 + aRand * 40.0), cos(uTime * 1.7 + aRand * 30.0), 0.0);
    float p = smoothstep(aRand * 0.4, aRand * 0.4 + 0.6, uScatter);
    vec3 pos = mix(formed, net, p);
    vColor = mix(uInk, aColor, p);
    // fewer, larger dots once they're streaming (most fade back so the edges stay calm)
    float keep = step(0.7, fract(aRand * 97.0));
    vAlpha = mix(uForm, 0.75 * keep, p) * (0.6 + 0.4 * aRand);
    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = mix(1.2 + aRand * 1.6, 2.4 + aRand * 2.2, p) * uPixel * (8.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }`;
const fragment = /* glsl */ `
  varying vec3 vColor; varying float vAlpha;
  void main(){
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    gl_FragColor = vec4(vColor, vAlpha * smoothstep(0.5, 0.0, d));
    #include <colorspace_fragment>
  }`;

/**
 * First load, rich mode: GPU particles gather into the name exactly over the real heading, hold, then scatter onto
 * the network's edges and keep flowing along them as data streams. The HTML heading stays the real name (the
 * particles are decorative) and fades in as they scatter. Skipped when the page isn't at the top.
 */
export default function NameParticles({ placement, light }) {
  const bootDone = useApp((s) => s.bootDone);
  const setPhase = useWorld((s) => s.setNamePhase);
  const { gl } = useThree();
  const [points, setPoints] = useState(null);
  const start = useRef(null);
  const phase = useRef("idle");
  const mat = useRef(null);

  useEffect(() => {
    if (!bootDone || points) return;
    const el = document.getElementById("hero-name");
    if (!el || window.scrollY > 40) {
      setPhase("done"); // not at the top: no intro, the name just shows
      return;
    }
    let cancelled = false;
    sampleHeading(el)
      .then((pts) => !cancelled && (pts.length ? setPoints(pts) : setPhase("done")))
      .catch(() => setPhase("done"));
    return () => {
      cancelled = true;
    };
  }, [bootDone, points, setPhase]);

  const geo = useMemo(() => {
    if (!points) return null;
    const g = new THREE.BufferGeometry();
    const attr = { aStart: 3, aText: 3, aA: 3, aB: 3, aColor: 3, aRand: 1, aT: 1 };
    const arrays = Object.fromEntries(Object.entries(attr).map(([k, n]) => [k, new Float32Array(COUNT * n)]));
    const edges = EDGES.map(([a, b]) => ({ a: nodeWorld(a, placement), b: nodeWorld(b, placement), color: tokenColor(NODES[b].color) }));
    const shuffled = points.slice().sort(() => Math.random() - 0.5);
    for (let i = 0; i < COUNT; i++) {
      const [x, y] = toWorld(shuffled[i % shuffled.length]);
      const rand = Math.random();
      const e = edges[i % edges.length];
      arrays.aText.set([x, y, 0], i * 3);
      arrays.aStart.set([x + (Math.random() - 0.5) * 3, y + (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2], i * 3);
      arrays.aA.set(e.a, i * 3);
      arrays.aB.set(e.b, i * 3);
      arrays.aColor.set([e.color.r, e.color.g, e.color.b], i * 3);
      arrays.aRand[i] = rand;
      arrays.aT[i] = Math.random();
    }
    g.setAttribute("position", new THREE.BufferAttribute(arrays.aText, 3)); // three needs one; the shader moves them
    for (const [k, n] of Object.entries(attr)) g.setAttribute(k, new THREE.BufferAttribute(arrays[k], n));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4); // never culled: the shader moves the points
    return g;
  }, [points, placement]);
  useEffect(() => () => geo?.dispose(), [geo]);

  const uniforms = useMemo(
    () => ({ uTime: { value: 0 }, uForm: { value: 0 }, uScatter: { value: 0 }, uPixel: { value: 1 }, uInk: { value: new THREE.Color() } }),
    [],
  );

  useFrame(({ clock }) => {
    if (!geo || !mat.current) return;
    const now = clock.elapsedTime;
    start.current ??= now;
    const t = now - start.current;
    const u = mat.current.uniforms; // the material's own (R3F copies the initial uniforms object)
    u.uTime.value = now;
    u.uPixel.value = gl.getPixelRatio();
    u.uInk.value.copy(tokenColor("ink"));
    u.uForm.value = Math.min(1, t / FORM);
    u.uScatter.value = THREE.MathUtils.clamp((t - FORM - HOLD) / SCATTER, 0, 1);
    const next = t < FORM + HOLD ? "forming" : t < FORM + HOLD + SCATTER ? "scatter" : "done";
    if (next !== phase.current) {
      phase.current = next;
      setPhase(next);
    }
  });

  if (!geo) return null;
  return (
    <points geometry={geo} frustumCulled={false}>
      <shaderMaterial
        ref={mat}
        uniforms={uniforms}
        vertexShader={vertex}
        fragmentShader={fragment}
        transparent
        depthWrite={false}
        blending={light ? THREE.NormalBlending : THREE.AdditiveBlending}
      />
    </points>
  );
}
