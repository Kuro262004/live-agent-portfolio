import { audioLevels } from "../../lib/audioLevel";

const TARGET_RATE = 16000;

const WORKLET = `
class Tap extends AudioWorkletProcessor {
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (ch) this.port.postMessage(ch.slice(0));
    return true;
  }
}
registerProcessor("tap", Tap);
`;

/** Float32 mono at `rate` → Int16 at 16 kHz (linear resample). */
function toPcm16(float32, rate) {
  const ratio = rate / TARGET_RATE;
  const n = Math.floor(float32.length / ratio);
  const out = new Int16Array(n);
  for (let i = 0; i < n; i++) {
    const pos = i * ratio;
    const i0 = Math.floor(pos);
    const frac = pos - i0;
    const s = float32[i0] * (1 - frac) + (float32[Math.min(i0 + 1, float32.length - 1)] ?? 0) * frac;
    out[i] = Math.max(-1, Math.min(1, s)) * 0x7fff;
  }
  return out;
}

/** Opens the mic and calls onChunk(ArrayBuffer of 16 kHz PCM16) roughly every 40 ms. Returns a stop() function. */
export async function startMic(onChunk) {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  });
  const ctx = new AudioContext();
  const url = URL.createObjectURL(new Blob([WORKLET], { type: "application/javascript" }));
  await ctx.audioWorklet.addModule(url);
  URL.revokeObjectURL(url);
  const src = ctx.createMediaStreamSource(stream);
  const node = new AudioWorkletNode(ctx, "tap");
  let pending = [];
  let count = 0;
  node.port.onmessage = (e) => {
    let sum = 0;
    for (let i = 0; i < e.data.length; i++) sum += e.data[i] * e.data[i];
    audioLevels.mic = Math.min(1, Math.sqrt(sum / e.data.length) * 6); // RMS, scaled so normal speech reaches ~0.5-1
    pending.push(e.data);
    count += e.data.length;
    if (count >= (ctx.sampleRate * 40) / 1000) {
      const merged = new Float32Array(count);
      let o = 0;
      for (const p of pending) {
        merged.set(p, o);
        o += p.length;
      }
      pending = [];
      count = 0;
      onChunk(toPcm16(merged, ctx.sampleRate).buffer);
    }
  };
  src.connect(node);
  const mute = ctx.createGain();
  mute.gain.value = 0;
  node.connect(mute).connect(ctx.destination); // keeps the graph pulling without playing the mic back
  return () => {
    audioLevels.mic = 0;
    node.port.onmessage = null;
    stream.getTracks().forEach((t) => t.stop());
    ctx.close();
  };
}

/** Plays MP3 sentences in order; stop() drops everything queued (barge-in). */
export class Player {
  constructor() {
    this.ctx = null;
    this.queue = [];
    this.current = null;
    this.playing = false;
    this.generation = 0;
    this.onIdle = () => {};
  }

  async enqueue(arrayBuffer) {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.connect(this.ctx.destination);
      this.bins = new Uint8Array(this.analyser.frequencyBinCount);
    }
    const gen = this.generation;
    try {
      const buf = await this.ctx.decodeAudioData(arrayBuffer);
      if (gen !== this.generation) return;
      this.queue.push(buf);
      if (!this.playing) this.#next();
    } catch {
      /* a corrupt frame is skipped */
    }
  }

  #next() {
    const buf = this.queue.shift();
    if (!buf) {
      this.playing = false;
      this.onIdle();
      return;
    }
    this.playing = true;
    const s = this.ctx.createBufferSource();
    s.buffer = buf;
    s.connect(this.analyser);
    this.#meter();
    s.onended = () => {
      if (this.current === s) this.#next();
    };
    this.current = s;
    s.start();
  }

  #meter() {
    if (this.metering) return;
    this.metering = true;
    const loop = () => {
      if (!this.playing) {
        this.metering = false;
        audioLevels.out = 0;
        return;
      }
      this.analyser.getByteFrequencyData(this.bins);
      audioLevels.out = this.bins.reduce((a, b) => a + b, 0) / this.bins.length / 255;
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  stop() {
    this.generation++;
    this.queue = [];
    const s = this.current;
    this.current = null;
    this.playing = false;
    if (s) {
      s.onended = null;
      try {
        s.stop();
      } catch {
        /* already stopped */
      }
    }
  }

  close() {
    this.stop();
    this.ctx?.close();
  }
}

export const speechRecognitionCtor = () =>
  typeof window === "undefined" ? undefined : window.SpeechRecognition || window.webkitSpeechRecognition;
