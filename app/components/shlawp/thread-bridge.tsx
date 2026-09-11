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
};

let snapshot: ShlawpThreadSnapshot = {
  isRunning: false,
  assistantId: null,
  assistantText: "",
  assistantFailed: false,
};
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function publish(next: ShlawpThreadSnapshot) {
  if (
    next.isRunning === snapshot.isRunning &&
    next.assistantId === snapshot.assistantId &&
    next.assistantText === snapshot.assistantText &&
    next.assistantFailed === snapshot.assistantFailed
  ) {
    return;
  }
  snapshot = next;
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

  useEffect(() => {
    publish({ isRunning, assistantId, assistantText, assistantFailed });
  }, [isRunning, assistantId, assistantText, assistantFailed]);

  return null;
}
