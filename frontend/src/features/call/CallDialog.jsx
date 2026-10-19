import * as Dialog from "@radix-ui/react-dialog";
import { useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ChevronDown, ChevronUp, MessageSquare, Mic, PhoneOff, Send, Square, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { BookCallLink, InfoNote } from "../../components/InfoNote";
import { streamChat } from "../../lib/api";
import { signalTool } from "../../lib/worldBus";
import { scrollToEl } from "../../lib/motion";
import { useStatus } from "../../lib/queries";
import { useApp } from "../../stores/app";
import { applyUiAction, useCall } from "./useCall";
import VoiceOrb from "./VoiceOrb";

const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

const SUGGESTIONS = ["What is AIKO?", "What's his tech stack?", "Can your agents plan guest self-service for my hotel?"];

function Bubble({ m }) {
  if (m.role === "note") return <p className="text-center font-mono text-[11px] text-mute">{m.text}</p>;
  const ai = m.role === "ai";
  return (
    <motion.div
      className={`flex ${ai ? "justify-start" : "justify-end"}`}
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 420, damping: 30 }}
    >
      <p className={`max-w-[88%] rounded-2xl px-3.5 py-2 text-sm leading-6 ${ai ? "bg-raised text-ink" : "bg-researcher/20 text-ink"}`}>
        {m.text}
        {m.meta && <span className="mt-1 block font-mono text-[10px] text-mute">{m.meta}</span>}
      </p>
    </motion.div>
  );
}

/** The AI can answer in English, Filipino or Ilocano; the last two need a live model on the server. */
function LanguageSelect() {
  const language = useApp((s) => s.language);
  const setLanguage = useApp((s) => s.setLanguage);
  const { data: status } = useStatus();
  return (
    <label className="flex items-center gap-2 text-[11px] text-mute">
      Answer in
      <select
        aria-label="Answer language"
        value={language}
        onChange={(e) => setLanguage(e.target.value)}
        className="rounded-md border border-line bg-void px-2 py-1 text-xs text-ink focus:border-researcher focus:outline-none"
      >
        {["English", "Filipino", "Ilocano"].map((l) => <option key={l}>{l}</option>)}
      </select>
      {language !== "English" && !status?.llm && <span className="text-mute/80">(needs the live AI model)</span>}
    </label>
  );
}

/** Three bouncing dots while a reply is on its way. */
function TypingDots() {
  return (
    <div className="flex justify-start" role="status" aria-label="Justin's AI is typing">
      <span className="typing-dots rounded-2xl bg-raised px-3.5 py-3" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
    </div>
  );
}

function Suggestions({ onPick, disabled }) {
  return (
    <div className="flex flex-wrap gap-1.5" aria-label="Suggested questions">
      {SUGGESTIONS.map((q) => (
        <button
          key={q}
          type="button"
          disabled={disabled}
          onClick={() => onPick(q)}
          className="rounded-full border border-line px-2.5 py-1 text-left text-[11px] text-mute transition hover:border-researcher hover:text-ink disabled:opacity-40"
        >
          {q}
        </button>
      ))}
    </div>
  );
}

function Composer({ onSend, disabled, placeholder }) {
  const [text, setText] = useState("");
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (text.trim()) {
          onSend(text);
          setText("");
        }
      }}
    >
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={400}
        disabled={disabled}
        placeholder={placeholder}
        aria-label="Message"
        className="min-w-0 flex-1 rounded-lg border border-line bg-void px-3 py-2 text-sm placeholder:text-mute/60 focus:border-researcher focus:outline-none disabled:opacity-50"
      />
      <button type="submit" disabled={disabled || !text.trim()} aria-label="Send" className="rounded-lg bg-researcher px-3 text-void disabled:opacity-40">
        <Send size={16} />
      </button>
    </form>
  );
}

function useStickToBottom(dep) {
  const ref = useRef(null);
  useEffect(() => {
    ref.current?.scrollIntoView({ block: "end" });
  }, [dep]);
  return ref;
}

/** Text chat over plain HTTP: used when the live-call budget is spent (spec: fallback mode). */
const CHAT_GREETING =
  "Hi, I'm Justin's AI assistant, not Justin himself. Ask me about his work, skills or projects, or have my agents plan something for you.";

/** The small line under a reply: what answered it and how long it took. Offline answers say so; costs need prices. */
export function replyMeta(d) {
  if (d.mode !== "live") return "scripted answer · no AI model";
  const parts = ["live", d.model?.replace(/^\w+:/, ""), `${d.ms.toLocaleString()} ms`];
  if (d.tokens_in || d.tokens_out) parts.push(`${d.tokens_in} in · ${d.tokens_out} out`);
  if (d.cost_usd != null) parts.push(`$${d.cost_usd.toFixed(4)}`);
  return parts.filter(Boolean).join(" · ");
}

function ChatPanel() {
  const messages = useApp((s) => s.messages);
  const addMessage = useApp((s) => s.addMessage);
  const updateLastMessage = useApp((s) => s.updateLastMessage);
  const [caption, setCaption] = useState(null);
  const [streaming, setStreaming] = useState(false);
  useEffect(() => {
    if (useApp.getState().messages.length === 0) useApp.getState().addMessage("ai", CHAT_GREETING);
  }, []);
  const endRef = useStickToBottom(messages.length + (messages.at(-1)?.text.length ?? 0));
  const send = useMutation({
    mutationFn: async (text) => {
      const history = messages.filter((m) => m.role !== "note").map((m) => ({ role: m.role === "ai" ? "assistant" : "user", content: m.text }));
      let started = false;
      const used = new Set();
      const done = await streamChat(text, history.slice(-8), useApp.getState().language, {
        onToken: (t) => {
          if (!started) {
            started = true;
            setStreaming(true);
            addMessage("ai", t);
          } else updateLastMessage({ text: useApp.getState().messages.at(-1).text + t });
        },
        onTool: (name) => {
          used.add(name);
          setCaption(signalTool(name));
        },
      });
      // tools the scripted assistant used without a tool call still light their edge
      done.actions.forEach((a) => !used.has(a.type) && signalTool(a.type));
      if (started) updateLastMessage({ text: done.reply, meta: replyMeta(done) });
      else addMessage("ai", done.reply);
      return done;
    },
    onSuccess: (r) => r.actions.forEach((a) => applyUiAction(a)),
    onError: (e) => addMessage("note", e.message),
    onSettled: () => {
      setCaption(null);
      setStreaming(false);
    },
  });
  const ask = (t) => {
    addMessage("user", t);
    send.mutate(t);
  };
  return (
    <div className="flex h-[24rem] max-h-[60vh] flex-col gap-3">
      <div className="flex-1 space-y-2 overflow-y-auto pr-1">
        {messages.map((m, i) => <Bubble key={i} m={m} />)}
        {send.isPending && !streaming && <TypingDots />}
        {caption && <p className="font-mono text-[11px] text-researcher" aria-live="polite">{caption}</p>}
        <div ref={endRef} />
      </div>
      {messages.length <= 2 && <Suggestions onPick={ask} disabled={send.isPending} />}
      <LanguageSelect />
      <Composer placeholder="Ask about Justin's work…" disabled={send.isPending} onSend={ask} />
    </div>
  );
}

function LiveCall({ call }) {
  const { phase, messages, info, speaking, micOn, secondsLeft, wrapup, error, caption } = call;
  const endRef = useStickToBottom(messages.length);
  const waiting = !speaking && messages[messages.length - 1]?.role === "user"; // asked, reply not here yet
  const orbState = speaking ? "speaking" : waiting ? "thinking" : micOn ? "listening" : "idle";
  const state = phase === "connecting" ? "Connecting…" : speaking ? "Speaking" : waiting ? "Thinking" : micOn ? "Listening" : "Ready";
  return (
    <div className="flex h-[24rem] max-h-[60vh] flex-col gap-3">
      <div className="flex items-center gap-3 rounded-xl border border-line bg-void p-3">
        <VoiceOrb state={orbState} measured={{ mic: !!info?.stt, out: !!info?.tts }} />
        <div className="min-w-0 flex-1">
          <p className="font-mono text-xs uppercase tracking-wider text-researcher">{state}</p>
          <p className="truncate text-xs text-mute">
            {info?.stt ? "Whisper + Fish Audio" : info?.fallback ? "Text chat (live budget used up)" : micOn ? "Browser speech" : "Text chat"}
          </p>
        </div>
        {secondsLeft != null && (
          <span className={`font-mono text-xs tabular-nums ${wrapup ? "text-builder" : "text-mute"}`}>
            {fmt(secondsLeft)} {micOn || info?.stt ? "left" : "chat time left"}
          </span>
        )}
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto pr-1" aria-live="polite">
        {messages.map((m, i) => <Bubble key={i} m={m} />)}
        {waiting && <TypingDots />}
        {caption && <p className="font-mono text-[11px] text-researcher">{caption}</p>}
        {error && <p className="text-sm text-alert">{error}</p>}
        <div ref={endRef} />
      </div>
      {messages.length <= 2 && <Suggestions onPick={call.sendText} disabled={phase !== "live"} />}
      <Composer onSend={call.sendText} disabled={phase !== "live"} placeholder={micOn ? "Or type here…" : "Type a message…"} />
      <div className="flex gap-2">
        {speaking && (
          <button onClick={call.interrupt} className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-xs hover:border-mute">
            <Square size={12} /> Interrupt
          </button>
        )}
        <span className="flex-1" />
        <button onClick={call.end} className="flex items-center gap-1.5 rounded-lg bg-alert px-3 py-2 text-xs font-semibold text-void hover:brightness-110">
          <PhoneOff size={14} /> End call
        </button>
      </div>
    </div>
  );
}

export default function CallDialog() {
  const open = useApp((s) => s.callOpen);
  const minimized = useApp((s) => s.callMinimized);
  const close = useApp((s) => s.closeCall);
  const minimize = useApp((s) => s.minimizeCall);
  const restore = useApp((s) => s.restoreCall);
  const { data: status } = useStatus();
  const call = useCall({ captchaRequired: !!status?.captcha_required });
  const [forceChat, setForceChat] = useState(false);
  const limitHit = !!call.error?.toLowerCase().includes("limit");
  const fallback = status?.fallback || forceChat || limitHit;
  const idle = call.phase === "idle" || call.phase === "ended" || call.phase === "error";
  const missionLine = useApp((s) => s.missionLine);
  const setCallLive = useApp((s) => s.setCallLive);
  useEffect(() => {
    setCallLive(open && call.phase === "live");
    return () => setCallLive(false);
  }, [open, call.phase, setCallLive]);
  const messages = useApp((s) => s.messages);
  const lastAi = [...messages].reverse().find((m) => m.role === "ai")?.text;

  const onOpenChange = (o) => {
    if (!o) {
      if (!idle) call.end();
      setForceChat(false);
      close();
    }
  };

  // A docked, non-modal panel: the page stays visible and usable, so whatever the AI opens can be seen.
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange} modal={false}>
      <Dialog.Portal>
        <Dialog.Content
          onInteractOutside={(e) => e.preventDefault()}
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="fixed bottom-4 right-4 z-50 max-w-[calc(100vw-2rem)] focus:outline-none"
          aria-describedby="call-desc"
        >
          <Dialog.Description id="call-desc" className="sr-only">Talk or type with Justin's AI assistant.</Dialog.Description>
          {/* One surface that morphs between the full panel and a floating pill */}
          <motion.div
            layout
            transition={{ type: "spring", stiffness: 400, damping: 34 }}
            style={{ borderRadius: minimized ? 9999 : 16 }}
            className={`border border-rule/10 bg-raised shadow-2xl ${minimized ? "px-4 py-2.5" : "hud w-[min(24rem,calc(100vw-2rem))] p-4"}`}
          >
            {minimized ? (
              <div className="flex items-center gap-2.5">
                <span className={`h-2 w-2 shrink-0 rounded-full ${missionLine ? "animate-pulse bg-builder" : "bg-reviewer"}`} aria-hidden="true" />
                <Dialog.Title className="sr-only">{fallback ? "Chat with Justin's AI" : "Call Justin's AI"}</Dialog.Title>
                <p className="line-clamp-2 min-w-0 max-w-[16rem] text-xs leading-5 text-ink/80" aria-live="polite">
                  {missionLine ?? lastAi ?? "Say hello, or ask what the agents can do."}
                </p>
                {missionLine?.startsWith("✓") && (
                  <button
                    onClick={() => scrollToEl(document.getElementById("deliverable"), "center")}
                    className="rounded-full bg-reviewer px-2.5 py-1 text-[11px] font-semibold text-void hover:brightness-110"
                  >
                    View
                  </button>
                )}
                <button onClick={restore} aria-label="Expand panel" aria-expanded={false} className="rounded p-1 text-mute hover:text-ink">
                  <ChevronUp size={16} />
                </button>
                <Dialog.Close className="rounded p-1 text-mute hover:text-ink" aria-label="Close"><X size={16} /></Dialog.Close>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <Dialog.Title className="flex-1 font-mono text-sm font-bold uppercase tracking-widest text-researcher">
                    {fallback ? "Chat with Justin's AI" : "Call Justin's AI"}
                  </Dialog.Title>
                  <button onClick={minimize} aria-label="Minimize panel" aria-expanded={true} className="rounded p-1 text-mute hover:text-ink">
                    <ChevronDown size={18} />
                  </button>
                  <Dialog.Close className="rounded p-1 text-mute hover:text-ink" aria-label="Close"><X size={18} /></Dialog.Close>
                </div>
                <div className="mt-3">
                  {fallback ? (
                    <>
                      {status?.fallback && (
                        <InfoNote className="mb-3 text-xs">Live calls are paused for today. The text assistant is still here.</InfoNote>
                      )}
                      {limitHit && (
                        <InfoNote className="mb-3 text-xs">
                          You've used today's live calls. You can keep chatting by text, or <BookCallLink />.
                        </InfoNote>
                      )}
                      <ChatPanel />
                      {!status?.fallback && (
                        <button
                          onClick={() => {
                            setForceChat(false);
                            call.start("voice");
                          }}
                          className="mt-2 text-xs text-researcher underline"
                        >
                          Prefer to talk? Start a voice call
                        </button>
                      )}
                    </>
                  ) : idle ? (
                    <div className="space-y-4">
                      <p className="text-sm leading-6 text-ink/90">
                        You'll talk to Justin's <strong>AI assistant</strong> (not Justin himself). It answers questions about his work, opens sections for you, and can hand a task to its agents.
                      </p>
                      {call.phase === "error" && <p role="alert" className="text-sm text-alert">{call.error}</p>}
                      {call.phase === "ended" && call.messages.length > 0 && <p className="text-sm text-mute">Call ended. You can start another.</p>}
                      <LanguageSelect />
                      <div className="grid gap-2">
                        <button onClick={() => call.start("voice")} className="flex items-center justify-center gap-2 rounded-lg bg-researcher px-4 py-3 text-sm font-semibold text-void hover:brightness-110">
                          <Mic size={16} /> Start voice call
                        </button>
                        <button onClick={() => setForceChat(true)} className="flex items-center justify-center gap-2 rounded-lg border border-line px-4 py-3 text-sm font-semibold hover:border-researcher">
                          <MessageSquare size={16} /> Text only
                        </button>
                      </div>
                      {call.phase === "error" && (
                        <button onClick={() => setForceChat(true)} className="text-xs text-researcher underline">Use simple text chat instead</button>
                      )}
                      <p className="text-xs leading-5 text-mute">
                        <a href="/privacy/" className="text-researcher underline">Privacy</a>: your voice is turned into text and the audio is not kept. Calls last up to {Math.round((status?.limits.max_call_seconds ?? 180) / 60)} minutes
                        and are limited to {status?.limits.calls_per_day ?? 2} per day.
                        {status && !status.voice.stt && " Server voice isn't configured here, so your browser's own speech recognition is used when available."}
                      </p>
                    </div>
                  ) : (
                    <LiveCall call={call} />
                  )}
                </div>
              </>
            )}
          </motion.div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
