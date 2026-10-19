import { useCallback, useEffect, useRef, useState } from "react";
import { getCaptchaToken } from "../../components/captcha";
import { wsUrl } from "../../lib/api";
import { audioLevels } from "../../lib/audioLevel";
import { signalTool } from "../../lib/worldBus";
import { scrollToSection, useApp } from "../../stores/app";
import { Player, speechRecognitionCtor, startMic } from "./audio";

/** Handles the page-driving actions the assistant sends (spec: it opens projects and scrolls to skills). */
export function applyUiAction(act, app = useApp.getState()) {
  switch (act.type) {
    case "open_section":
      if (act.section === "projects" && act.item_id) app.setFocusProject(act.item_id); // the card centres itself once expanded
      else scrollToSection(act.section);
      app.minimizeCall(); // keep the panel out of the way of what was just opened
      break;
    case "start_mission":
      app.setPrefill({ template_id: act.template_id, inputs: act.inputs ?? {} });
      app.setRunNotice(act.reason ?? null);
      app.setMissionId(act.mission_id);
      app.minimizeCall();
      break;
    case "offer_mission":
      app.setPrefill(act.template_id ? { template_id: act.template_id, inputs: {} } : null);
      scrollToSection("mission");
      app.minimizeCall();
      break;
    case "book_meeting":
      app.showBooking();
      if (act.url) window.open(act.url, "_blank", "noopener");
      else scrollToSection("contact");
      app.minimizeCall();
      break;
    default:
  }
}

/**
 * One call session. phase: idle | connecting | live | ended | error.
 * mode "voice": server pipeline (VAD/Whisper/Fish) when available, else browser speech APIs.
 * mode "text": typed messages over the same socket.
 */
export function useCall({ captchaRequired }) {
  const [phase, setPhase] = useState("idle");
  const messages = useApp((s) => s.messages);
  const [info, setInfo] = useState(null);
  const [error, setError] = useState(null);
  const [speaking, setSpeaking] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(null);
  const [wrapup, setWrapup] = useState(false);
  const [caption, setCaption] = useState(null); // "searching the portfolio…" while a tool runs

  const wsRef = useRef(null);
  const stopMicRef = useRef(null);
  const playerRef = useRef(null);
  const recogRef = useRef(null);
  const infoRef = useRef(null);
  const timerRef = useRef(null);
  const speakingRef = useRef(false);
  const modeRef = useRef("text");

  const setSpeakingBoth = (v) => {
    speakingRef.current = v;
    audioLevels.speaking = v; // the 3D researcher node pulses with the AI's voice
    setSpeaking(v);
  };

  const push = (role, text) => useApp.getState().addMessage(role, text);

  const cleanup = useCallback(() => {
    clearInterval(timerRef.current);
    stopMicRef.current?.();
    stopMicRef.current = null;
    playerRef.current?.close();
    playerRef.current = null;
    try {
      recogRef.current?.abort();
    } catch {
      /* not running */
    }
    recogRef.current = null;
    window.speechSynthesis?.cancel();
    setMicOn(false);
    setSpeakingBoth(false);
  }, []);

  const startBrowserRecognition = useCallback(() => {
    const Ctor = speechRecognitionCtor();
    if (!Ctor) return false;
    const r = new Ctor();
    r.continuous = true;
    r.interimResults = false;
    r.lang = "en-US";
    r.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          const text = e.results[i][0].transcript.trim();
          if (text && wsRef.current?.readyState === 1) wsRef.current.send(JSON.stringify({ type: "text", text }));
        }
      }
    };
    // Recognition is paused while the browser voice speaks, so it never hears itself.
    r.onend = () => {
      if (recogRef.current === r && !speakingRef.current && wsRef.current?.readyState === 1) {
        try {
          r.start();
        } catch {
          /* already started */
        }
      }
    };
    recogRef.current = r;
    r.start();
    return true;
  }, []);

  const speakInBrowser = useCallback((text) => {
    if (!window.speechSynthesis) return;
    const u = new SpeechSynthesisUtterance(text);
    u.onstart = () => {
      setSpeakingBoth(true);
      try {
        recogRef.current?.stop();
      } catch {
        /* not running */
      }
    };
    u.onend = u.onerror = () => {
      setSpeakingBoth(false);
      if (recogRef.current) {
        try {
          recogRef.current.start();
        } catch {
          /* already started */
        }
      }
    };
    window.speechSynthesis.speak(u);
  }, []);

  const handle = useCallback(
    (msg) => {
      switch (msg.type) {
        case "ready":
          infoRef.current = msg;
          setInfo(msg);
          setPhase("live");
          setSecondsLeft(msg.max_seconds);
          timerRef.current = setInterval(() => setSecondsLeft((s) => (s == null ? s : Math.max(0, s - 1))), 1000);
          break;
        case "transcript":
          push("user", msg.text);
          break;
        case "tool":
          setCaption(signalTool(msg.name));
          break;
        case "reply":
        case "narration":
        case "wrapup":
          if (msg.type === "reply") setCaption(null);
          push(msg.type === "reply" ? "ai" : "note", msg.text);
          if (msg.type === "wrapup") setWrapup(true);
          if (modeRef.current === "voice" && !infoRef.current?.tts) speakInBrowser(msg.text);
          break;
        case "ui":
          applyUiAction(msg.action);
          break;
        case "audio_start":
          setSpeakingBoth(true);
          break;
        case "audio_end":
          // the last sentence may still be playing; the player reports idle when it finishes
          if (!playerRef.current?.playing) setSpeakingBoth(false);
          break;
        case "interrupt":
          playerRef.current?.stop();
          window.speechSynthesis?.cancel();
          setSpeakingBoth(false);
          break;
        case "ended":
          setPhase("ended");
          cleanup();
          break;
        case "error":
          setError(msg.message);
          setPhase("error");
          cleanup();
          break;
        default:
      }
    },
    [cleanup, speakInBrowser],
  );

  const start = useCallback(
    async (mode) => {
      modeRef.current = mode;
      setError(null);
      useApp.getState().clearMessages();
      setWrapup(false);
      setPhase("connecting");
      let token = null;
      try {
        token = await getCaptchaToken(captchaRequired);
      } catch (e) {
        setError(e.message);
        setPhase("error");
        return;
      }
      const ws = new WebSocket(wsUrl("/ws/call"));
      ws.binaryType = "arraybuffer";
      wsRef.current = ws;
      playerRef.current = new Player();
      playerRef.current.onIdle = () => setSpeakingBoth(false);
      ws.onopen = () => ws.send(JSON.stringify({ type: "start", mode, captcha: token, language: useApp.getState().language }));
      ws.onmessage = async (e) => {
        if (typeof e.data !== "string") {
          playerRef.current?.enqueue(e.data);
          return;
        }
        const msg = JSON.parse(e.data);
        handle(msg);
        if (msg.type === "ready" && mode === "voice") {
          try {
            if (msg.stt) {
              stopMicRef.current = await startMic((buf) => ws.readyState === 1 && ws.send(buf));
              setMicOn(true);
            } else if (startBrowserRecognition()) {
              setMicOn(true);
            }
          } catch {
            push("note", "Microphone unavailable. You can type instead.");
          }
        }
      };
      ws.onerror = () => {
        setError("Couldn't connect. The server may be waking up; try again in a moment, or use text chat.");
        setPhase("error");
      };
      ws.onclose = () => setPhase((p) => (p === "live" || p === "connecting" ? "ended" : p));
    },
    [captchaRequired, handle, startBrowserRecognition],
  );

  const sendText = useCallback((text) => {
    const t = text.trim();
    if (!t || wsRef.current?.readyState !== 1) return;
    wsRef.current.send(JSON.stringify({ type: "text", text: t }));
  }, []);

  const interrupt = useCallback(() => {
    playerRef.current?.stop();
    window.speechSynthesis?.cancel();
    setSpeakingBoth(false);
    if (wsRef.current?.readyState === 1) wsRef.current.send(JSON.stringify({ type: "barge_in" }));
  }, []);

  const end = useCallback(() => {
    if (wsRef.current?.readyState === 1) wsRef.current.send(JSON.stringify({ type: "end" }));
    wsRef.current?.close();
    cleanup();
    setPhase("ended");
  }, [cleanup]);

  useEffect(
    () => () => {
      wsRef.current?.close();
      cleanup();
    },
    [cleanup],
  );

  return { phase, messages, info, error, speaking, micOn, secondsLeft, wrapup, caption, start, sendText, interrupt, end };
}
