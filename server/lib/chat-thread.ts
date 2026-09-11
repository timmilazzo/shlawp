import type { H3Event } from "h3";

/**
 * The agent-chat handler consumes the request body before prompt assembly, so
 * the prompt hook can't read the thread id itself. Root middleware parses a
 * copy of the body first and records it here. Durable background runs skip
 * that path, but the framework carries their verified body on the context.
 */
const THREAD_CONTEXT_KEY = "shlawpChatThreadId";
const BACKGROUND_BODY_KEY = "__agentChatBackgroundBody";

export function rememberChatThreadId(event: H3Event, threadId: unknown): void {
  if (typeof threadId === "string" && threadId.trim()) {
    event.context[THREAD_CONTEXT_KEY] = threadId.trim();
  }
}

export function chatThreadIdFromEvent(event: unknown): string | null {
  const context = (event as { context?: Record<string, unknown> } | null)
    ?.context;
  if (!context) return null;
  const remembered = context[THREAD_CONTEXT_KEY];
  if (typeof remembered === "string") return remembered;
  const background = context[BACKGROUND_BODY_KEY] as
    | { threadId?: unknown }
    | undefined;
  return typeof background?.threadId === "string" ? background.threadId : null;
}
