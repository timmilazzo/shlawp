import {
  AgentChatSurface,
  sendToAgentChat,
} from "@agent-native/core/client/agent-chat";
import { useT } from "@agent-native/core/client/i18n";
import { useLiveTranscription } from "@agent-native/core/client/transcription/use-live-transcription";
import { IconKeyboard, IconPlayerStopFilled } from "@tabler/icons-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";

import { PhoneFrame } from "@/components/shlawp/PhoneFrame";
import { ShlawpFooter } from "@/components/shlawp/ShlawpFooter";
import { ShlawpOrb, type ShlawpMood } from "@/components/shlawp/ShlawpOrb";
import {
  ShlawpThreadBridge,
  getShlawpThread,
  useShlawpThread,
} from "@/components/shlawp/thread-bridge";
import { useShlawpVoice } from "@/components/shlawp/use-shlawp-voice";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { APP_TITLE } from "@/lib/app-config";
import { TAB_ID } from "@/lib/tab-id";
import { cn } from "@/lib/utils";

const SEO_TITLE = `${APP_TITLE} - Absolutely.`;
const SEO_DESCRIPTION =
  "A tribute to Ryan George. Ask it anything. It agrees.";

export function meta() {
  return [
    { title: SEO_TITLE },
    { name: "description", content: SEO_DESCRIPTION },
    { property: "og:title", content: SEO_TITLE },
    { property: "og:description", content: SEO_DESCRIPTION },
    { name: "twitter:card", content: "summary" },
    { name: "twitter:title", content: SEO_TITLE },
    { name: "twitter:description", content: SEO_DESCRIPTION },
  ];
}

type Mode = "voice" | "text";
type Phase = "idle" | "listening" | "thinking" | "speaking";
type Caption = { from: "you" | "shlawp"; text: string } | null;

const MODE_STORAGE_KEY = "shlawp.mode";
// Silence after the last recognized word before the turn is sent.
const END_OF_TURN_MS = 1400;
// Give up on a listening session that never hears anything.
const NO_SPEECH_MS = 9000;
// A run that never produces a reply shouldn't leave the orb thinking forever.
const RUN_START_TIMEOUT_MS = 15_000;
const REPLY_TIMEOUT_MS = 60_000;

function chatThreadPath(threadId: string | null) {
  return threadId ? `/chat/${encodeURIComponent(threadId)}` : "/home";
}

function useMode(voiceSupported: boolean) {
  const [mode, setMode] = useState<Mode>("voice");

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(MODE_STORAGE_KEY);
      if (stored === "voice" || stored === "text") setMode(stored);
    } catch {
      // Storage can be blocked; voice stays the default.
    }
  }, []);

  useEffect(() => {
    if (!voiceSupported) setMode("text");
  }, [voiceSupported]);

  const update = useCallback((next: Mode) => {
    setMode(next);
    try {
      window.localStorage.setItem(MODE_STORAGE_KEY, next);
    } catch {
      // Ignore storage errors.
    }
  }, []);

  return [mode, update] as const;
}

export default function ShlawpRoute() {
  const { threadId } = useParams();
  const navigate = useNavigate();
  const t = useT();
  const {
    supported: voiceSupported,
    isActive: isHearing,
    transcript,
    interimText,
    start: startHearing,
    stop: stopHearing,
    stopAndWait,
    getIncompleteReason,
  } = useLiveTranscription();
  const { unlock, speak, stop: stopSpeaking, getLevel } = useShlawpVoice();
  const thread = useShlawpThread();
  const [mode, setMode] = useMode(voiceSupported);
  const [phase, setPhase] = useState<Phase>("idle");
  const [caption, setCaption] = useState<Caption>(null);

  // The assistant message id that was current when a turn was sent. A reply
  // is any newer assistant message once the run settles.
  const awaitingAfterRef = useRef<string | null | undefined>(undefined);
  const sawRunRef = useRef(false);

  const threadUrlSync = threadId
    ? { routeThreadId: threadId, getPath: chatThreadPath, navigate }
    : undefined;

  const heard = [transcript, interimText].join(" ").trim();

  const sendTurn = useCallback(
    (text: string) => {
      const current = getShlawpThread();
      // A thread whose last turn failed (rate limit, length cap, outage)
      // would keep failing, so the next turn starts a fresh conversation.
      const startFresh = current.assistantFailed;
      awaitingAfterRef.current = startFresh ? null : current.assistantId;
      sawRunRef.current = false;
      setCaption({ from: "you", text });
      setPhase("thinking");
      sendToAgentChat({
        message: text,
        submit: true,
        chatTarget: "local",
        openSidebar: false,
        newTab: startFresh,
      });
    },
    [],
  );

  const finishListening = useCallback(async () => {
    const text = (await stopAndWait(600)).trim();
    if (!text) {
      setPhase("idle");
      setCaption(null);
      return;
    }
    sendTurn(text);
  }, [stopAndWait, sendTurn]);

  const resetVoice = useCallback(() => {
    stopHearing();
    stopSpeaking();
    awaitingAfterRef.current = undefined;
    setPhase("idle");
    setCaption(null);
  }, [stopHearing, stopSpeaking]);

  function handleMicPress() {
    if (phase === "listening") {
      void finishListening();
      return;
    }
    if (phase === "speaking") {
      stopSpeaking();
      setPhase("idle");
      return;
    }
    if (phase === "thinking") return;
    unlock();
    setCaption(null);
    startHearing();
    setPhase("listening");
  }

  function switchMode(next: Mode) {
    resetVoice();
    setMode(next);
  }

  // End the turn after a pause, or abandon a session that hears nothing.
  useEffect(() => {
    if (phase !== "listening") return;
    const timer = window.setTimeout(
      () => {
        if (heard) void finishListening();
        else {
          stopHearing();
          setPhase("idle");
        }
      },
      heard ? END_OF_TURN_MS : NO_SPEECH_MS,
    );
    return () => window.clearTimeout(timer);
  }, [phase, heard, finishListening, stopHearing]);

  // Recognition can stop on its own (permission denied, device lost).
  useEffect(() => {
    if (phase === "listening" && !isHearing && getIncompleteReason()) {
      setPhase("idle");
    }
  }, [phase, isHearing, getIncompleteReason]);

  // Pick up the reply once the run settles, then say it.
  useEffect(() => {
    if (phase !== "thinking" || awaitingAfterRef.current === undefined) return;
    const isNewReply =
      thread.assistantId !== null &&
      thread.assistantId !== awaitingAfterRef.current;
    if (thread.isRunning) {
      sawRunRef.current = true;
      if (isNewReply && thread.assistantText && !thread.assistantFailed) {
        setCaption({ from: "shlawp", text: thread.assistantText });
      }
      return;
    }
    if (isNewReply && thread.assistantFailed) {
      // Never read an error message aloud in Shlawp's voice.
      awaitingAfterRef.current = undefined;
      setCaption({ from: "shlawp", text: t("shlawp.tryAgain") });
      setPhase("idle");
      return;
    }
    const hasReply = isNewReply && thread.assistantText;
    if (hasReply) {
      awaitingAfterRef.current = undefined;
      const reply = thread.assistantText;
      setCaption({ from: "shlawp", text: reply });
      setPhase("speaking");
      void speak(reply).finally(() => {
        setPhase((current) => (current === "speaking" ? "idle" : current));
      });
    } else if (sawRunRef.current) {
      awaitingAfterRef.current = undefined;
      setPhase("idle");
    }
  }, [phase, thread, speak, t]);

  useEffect(() => {
    if (phase !== "thinking") return;
    const giveUp = () => {
      awaitingAfterRef.current = undefined;
      setPhase("idle");
    };
    // A turn that never starts a run (e.g. no model connected) stops early.
    const startTimer = window.setTimeout(() => {
      if (!sawRunRef.current) giveUp();
    }, RUN_START_TIMEOUT_MS);
    const replyTimer = window.setTimeout(giveUp, REPLY_TIMEOUT_MS);
    return () => {
      window.clearTimeout(startTimer);
      window.clearTimeout(replyTimer);
    };
  }, [phase]);

  const isVoice = mode === "voice";
  const shownCaption: Caption =
    phase === "listening"
      ? heard
        ? { from: "you", text: heard }
        : null
      : caption;
  const mood: ShlawpMood = isVoice
    ? phase
    : thread.isRunning
      ? "thinking"
      : "idle";

  const suggestions = [
    t("shlawp.suggestionChips"),
    t("shlawp.suggestionVisionary"),
    t("shlawp.suggestionRightThing"),
    t("shlawp.suggestionPlan"),
    t("shlawp.suggestionAnalyst"),
  ];

  const micLabel =
    phase === "listening"
      ? t("shlawp.send")
      : phase === "speaking"
        ? t("shlawp.stop")
        : t("shlawp.talk");

  return (
    <PhoneFrame>
      <div className="shlawp-theme dark flex h-full flex-col bg-black text-foreground">
        <header
          className={cn(
            "flex shrink-0 items-center justify-center px-6",
            isVoice ? "shlawp-safe-top pb-2" : "shlawp-safe-top-compact pb-1",
          )}
        >
          <h1
            className={cn(
              "shlawp-wordmark",
              isVoice ? "text-2xl" : "text-base",
            )}
          >
            {APP_TITLE}
          </h1>
        </header>

        <div
          className={cn(
            "flex shrink-0 items-center justify-center",
            isVoice ? "min-h-0 flex-1" : "py-2",
          )}
        >
          <ShlawpOrb
            mood={mood}
            size={isVoice ? "hero" : "compact"}
            label={t("shlawp.orbLabel")}
            getLevel={getLevel}
          />
        </div>

        {isVoice ? (
          <p
            aria-live="polite"
            className={cn(
              "mx-auto min-h-[4.75rem] max-w-[20rem] shrink-0 px-6 text-center text-[15px] leading-6 text-balance",
              shownCaption?.from === "you" ? "text-white/60" : "text-white/90",
            )}
          >
            {shownCaption ? (
              shownCaption.text
            ) : phase === "idle" ? (
              <button
                type="button"
                onClick={() => {
                  unlock();
                  sendTurn(suggestions[0]);
                }}
                className="rounded-full px-3 py-1 text-white/45 transition-colors hover:text-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                “{suggestions[0]}”
              </button>
            ) : null}
          </p>
        ) : null}

        <div
          className={cn(
            "shlawp-chat min-h-0 flex-1",
            isVoice && "hidden",
          )}
        >
          <AgentChatSurface
            mode="page"
            className="h-full"
            defaultMode="chat"
            storageKey="chat"
            threadUrlSync={threadUrlSync}
            browserTabId={TAB_ID}
            showHeader={false}
            showTabBar={false}
            showPageNewChatButton={false}
            dynamicSuggestions={false}
            suggestions={suggestions}
            emptyStateText={t("shlawp.emptyState")}
            showModelSelector={false}
            plusMenuMode="hidden"
            composerPlaceholder={t("shlawp.composerPlaceholder")}
            composerSlot={<ShlawpThreadBridge />}
            composerExtraActionButton={
              voiceSupported ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={t("shlawp.switchToVoice")}
                      onClick={() => switchMode("voice")}
                      className="shlawp-talk-toggle"
                    >
                      <span className="shlawp-bars shlawp-bars-sm" aria-hidden>
                        <span />
                        <span />
                        <span />
                        <span />
                        <span />
                      </span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t("shlawp.switchToVoice")}</TooltipContent>
                </Tooltip>
              ) : undefined
            }
          />
        </div>

        {isVoice ? (
          <div className="grid shrink-0 grid-cols-[1fr_auto_1fr] items-center px-8 pt-4">
            <div className="flex justify-start">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={t("shlawp.switchToText")}
                    onClick={() => switchMode("text")}
                    className="size-11 rounded-full text-white/55 hover:bg-white/10 hover:text-white [&_svg]:size-5"
                  >
                    <IconKeyboard />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t("shlawp.switchToText")}</TooltipContent>
              </Tooltip>
            </div>
            <button
              type="button"
              onClick={handleMicPress}
              aria-label={micLabel}
              aria-pressed={phase === "listening"}
              disabled={phase === "thinking"}
              className={cn(
                "shlawp-mic",
                phase === "listening" && "shlawp-mic-listening",
              )}
            >
              {phase === "speaking" ? (
                <IconPlayerStopFilled className="size-6" />
              ) : (
                <span className="shlawp-bars" aria-hidden>
                  <span />
                  <span />
                  <span />
                  <span />
                  <span />
                </span>
              )}
            </button>
            <div />
          </div>
        ) : null}

        <footer
          className={cn(
            "shlawp-safe-bottom shrink-0",
            isVoice ? "pt-5" : "shlawp-footer-compact pt-1.5",
          )}
        >
          <ShlawpFooter />
        </footer>
      </div>
    </PhoneFrame>
  );
}
