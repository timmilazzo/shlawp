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
};

let snapshot: ShlawpThreadSnapshot = {
  isRunning: false,
  assistantId: null,
  assistantText: "",
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
    next.assistantText === snapshot.assistantText
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
};

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

  useEffect(() => {
    publish({ isRunning, assistantId, assistantText });
  }, [isRunning, assistantId, assistantText]);

  return null;
}
