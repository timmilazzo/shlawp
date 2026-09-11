import { useAuiState } from "@assistant-ui/react";
import { useEffect, useSyncExternalStore } from "react";

/**
 * The orb lives outside the chat surface, but the thread runtime only exists
 * inside it. `ShlawpThreadBridge` is rendered into the surface's composer slot
 * and republishes the few facts the orb needs through a tiny external store.
 */
export type ShlawpThreadSnapshot = {
  /** The visible thread; reported by `ShlawpThreadIdReporter`. */
  threadId: string | null;
  isRunning: boolean;
  assistantId: string | null;
  assistantText: string;
  /** The last reply ended in an error rather than an answer. */
  assistantFailed: boolean;
  /** The last thing the person asked, for re-asking in the other mode. */
  lastUserText: string;
};

let snapshot: ShlawpThreadSnapshot = {
  threadId: null,
  isRunning: false,
  assistantId: null,
  assistantText: "",
  assistantFailed: false,
  lastUserText: "",
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

function lastOfRole(messages: readonly MessageLike[], role: string) {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === role) return messages[i];
  }
  return null;
}

function lastAssistant(messages: readonly MessageLike[]) {
  return lastOfRole(messages, "assistant");
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
  const lastUserText = useAuiState((s) =>
    textOf(lastOfRole(s.thread.messages, "user")),
  );

  useEffect(() => {
    publish({
      isRunning,
      assistantId,
      assistantText,
      assistantFailed,
      lastUserText,
    });
  }, [isRunning, assistantId, assistantText, assistantFailed, lastUserText]);

  return null;
}

/**
 * Rendered through the chat surface's thread footer slot, the only slot that
 * is told which thread it belongs to.
 */
export function ShlawpThreadIdReporter({
  threadId,
}: {
  threadId: string | null;
}) {
  useEffect(() => {
    if (threadId) publish({ threadId });
  }, [threadId]);
  return null;
}
