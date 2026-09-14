import { useAuiState } from "@assistant-ui/react";
import { useEffect, useSyncExternalStore } from "react";

/**
 * The orb lives outside the chat surface, but the thread runtime only exists
 * inside it. `ShlawpThreadBridge` is rendered into the surface's composer slot
 * and republishes the few facts the orb needs through a tiny external store.
 */
export type ShlawpThreadSnapshot = {
  isRunning: boolean;
  assistantId: string | null;
  assistantText: string;
  /** The last reply ended in an error rather than an answer. */
  assistantFailed: boolean;
  /** assistant-ui message status: "running" while streaming, "complete" after. */
  assistantStatus: string | null;
};

let snapshot: ShlawpThreadSnapshot = {
  isRunning: false,
  assistantId: null,
  assistantText: "",
  assistantFailed: false,
  assistantStatus: null,
};
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function publish(patch: Partial<ShlawpThreadSnapshot>) {
  const next = { ...snapshot, ...patch };
  const changed = (Object.keys(next) as (keyof ShlawpThreadSnapshot)[]).some(
    (key) => next[key] !== snapshot[key],
  );
  if (!changed) return;
  snapshot = next;
  // Debug surface for tracing turn sequencing in a deployed build.
  if (typeof window !== "undefined") {
    (
      window as unknown as { __shlawpThread?: ShlawpThreadSnapshot }
    ).__shlawpThread = snapshot;
  }
  for (const listener of listeners) listener();
}

export function getShlawpThread(): ShlawpThreadSnapshot {
  return snapshot;
}

export function useShlawpThread(): ShlawpThreadSnapshot {
  return useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => snapshot,
  );
}

type MessageLike = {
  id: string;
  role: string;
  content: readonly { type: string; text?: string }[];
  status?: { type: string };
};

function failed(message: MessageLike | null): boolean {
  if (!message) return false;
  if (message.status?.type === "incomplete") return true;
  // Transport failures are surfaced by the chat surface as an "Error: …" reply.
  return textOf(message).startsWith("Error:");
}

function lastAssistant(messages: readonly MessageLike[]) {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "assistant") return messages[i];
  }
  return null;
}

function textOf(message: MessageLike | null): string {
  if (!message) return "";
  return message.content
    .filter((part) => part.type === "text" && part.text)
    .map((part) => part.text)
    .join(" ")
    .trim();
}

export function ShlawpThreadBridge() {
  const isRunning = useAuiState((s) => s.thread.isRunning);
  const assistantId = useAuiState(
    (s) => lastAssistant(s.thread.messages)?.id ?? null,
  );
  const assistantText = useAuiState((s) =>
    textOf(lastAssistant(s.thread.messages)),
  );
  const assistantFailed = useAuiState((s) =>
    failed(lastAssistant(s.thread.messages)),
  );
  const assistantStatus = useAuiState(
    (s) => lastAssistant(s.thread.messages)?.status?.type ?? null,
  );

  useEffect(() => {
    publish({
      isRunning,
      assistantId,
      assistantText,
      assistantFailed,
      assistantStatus,
    });
  }, [isRunning, assistantId, assistantText, assistantFailed, assistantStatus]);

  return null;
}
