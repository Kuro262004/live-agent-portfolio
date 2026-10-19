/**
 * Live audio levels (0..1) written by the mic tap and the playback analyser, read by the voice orb (and the 3D
 * network's researcher node) every frame. `speaking` is true while the AI's voice is playing.
 * A plain mutable object on purpose: updating React state 60 times a second would re-render the whole panel.
 */
export const audioLevels = { mic: 0, out: 0, speaking: false };
