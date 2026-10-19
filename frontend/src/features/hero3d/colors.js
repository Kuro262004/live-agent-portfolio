import * as THREE from "three";

/** A theme token ("researcher", "bg", ...) as a three.js colour. Read again after a theme change. */
export function tokenColor(name) {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim();
  const [r, g, b] = raw ? raw.split(/\s+/).map(Number) : [128, 128, 128];
  return new THREE.Color().setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace);
}
