import { getSession } from "@agent-native/core/server";
import { defineEventHandler, setResponseStatus } from "h3";
import type { H3Event } from "h3";

import { isGuestEmail, mintGuestIfNeeded } from "../lib/guest.js";
import { CHAT_LIMITS, SPEAK_LIMITS, consumeRateLimit } from "../lib/rate-limit.js";

/**
 * Shlawp is open to the internet with no sign-up, so every visitor is a guest
 * and the framework's full surface is not theirs to use. This guard runs ahead
 * of the framework routes and allows only what the demo needs.
 *
 * Set SHLAWP_UNLOCKED=true locally to bypass it (e.g. to connect a provider in
 * the settings UI while developing).
 */
const ALLOWED_PREFIXES = [
  "/_agent-native/auth/session",
  "/_agent-native/application-state",
  "/_agent-native/settings/",
  "/_agent-native/poll",
  "/_agent-native/ping",
  "/_agent-native/health",
  "/_agent-native/og-image.png",
  "/_agent-native/speculation-rules.json",
  "/_agent-native/agent-chat/runs/",
  "/_agent-native/agent-chat/threads",
  "/_agent-native/agent-chat/stream-token",
];

const ALLOWED_EXACT = new Set([
  "/_agent-native/agent-chat",
  "/_agent-native/agent-chat-stream",
  "/_agent-native/agent-engine/status",
  "/_agent-native/voice-providers/status",
]);

/** Read-only calls the chat UI makes on load; refusing them only adds noise. */
const ALLOWED_GET_PREFIXES = [
  "/_agent-native/agent-chat/mode",
  "/_agent-native/agent-chat/checkpoints",
  "/_agent-native/connection-status/",
  "/_agent-native/actions/get-localization-preference",
];

/** Cost or exposure inside an otherwise allowed prefix. */
const BLOCKED_SUFFIXES = ["/share", "/generate-title"];

/** Requests to the model. The deployment pays for these. */
const CHAT_PATHS = new Set([
  "/_agent-native/agent-chat",
  "/_agent-native/agent-chat-stream",
]);

const SPEAK_PATH = "/api/shlawp/speak";

/** The engine and model are pinned server-side; a request may not choose. */
const ALLOWED_MODELS = new Set([
  "auto",
  "claude-haiku-4-5",
  "claude-haiku-4-5-20251001",
]);

/**
 * The stock client echoes the resolved engine back on every turn, so the
 * pinned engine is allowed and any other is refused. Mirrors the default in
 * server/plugins/agent-chat.ts.
 */
const ALLOWED_ENGINE = process.env.AGENT_ENGINE ?? "anthropic";

/**
 * The stock client resends the conversation with every turn, so input tokens
 * grow with thread length. Capping it bounds the cost of any single turn; the
 * client starts a fresh thread once a turn is refused.
 */
const MAX_HISTORY_ENTRIES = 30;
const MAX_CHAT_BODY_CHARS = 60_000;

function isUnlocked(): boolean {
  // guard:allow-env-credential — local development switch, not a credential
  const value = process.env.SHLAWP_UNLOCKED?.trim().toLowerCase();
  return value === "1" || value === "true";
}

function deny(event: H3Event, status: number, message: string, retryAfter?: number) {
  setResponseStatus(event, status);
  if (retryAfter) {
    event.res.headers.set("retry-after", String(retryAfter));
  }
  return { error: message };
}

function guestMayCall(method: string, pathname: string): boolean {
  if (BLOCKED_SUFFIXES.some((suffix) => pathname.endsWith(suffix))) return false;
  if (ALLOWED_EXACT.has(pathname)) return true;
  if (
    method === "GET" &&
    ALLOWED_GET_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  ) {
    return true;
  }
  return ALLOWED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

type ChatCheck = "ok" | "forbidden" | "too-long";

/**
 * A chat request can carry fields that would let a visitor spend more than the
 * demo intends: a different model or engine, the hosted harness, extra
 * instructions, references that call out to other agents, or an unbounded
 * conversation. History itself is legitimate — the client resends it each turn.
 */
type ChatBody = { raw: string; body: Record<string, unknown> };

/** A copy of the chat body; the framework handler still reads the original. */
async function readChatBody(event: H3Event): Promise<ChatBody | null> {
  try {
    const raw = await event.req.clone().text();
    return { raw, body: JSON.parse(raw) as Record<string, unknown> };
  } catch {
    // Unparseable bodies are the framework's problem, not this guard's.
    return null;
  }
}

function checkChatRequest({ raw, body }: ChatBody): ChatCheck {
  const refuse = (field: string, verdict: ChatCheck): ChatCheck => {
    // Field names only; request content never reaches the log.
    console.warn(`[shlawp] refused chat request (${verdict}): ${field}`);
    return verdict;
  };
  if (typeof body.model === "string" && !ALLOWED_MODELS.has(body.model)) {
    return refuse("model", "forbidden");
  }
  if (
    body.engine !== undefined &&
    body.engine !== null &&
    body.engine !== ALLOWED_ENGINE
  ) {
    return refuse("engine", "forbidden");
  }
  // `effort` is sent by the stock client on every turn and is harmless once
  // the model is pinned, so it is not on this list.
  for (const field of ["harness", "instructions"]) {
    if (body[field] !== undefined && body[field] !== null) {
      return refuse(field, "forbidden");
    }
  }
  if (Array.isArray(body.references) && body.references.length > 0) {
    return refuse("references", "forbidden");
  }
  for (const field of ["history", "structuredHistory"]) {
    const value = body[field];
    if (Array.isArray(value) && value.length > MAX_HISTORY_ENTRIES) {
      return refuse(field, "too-long");
    }
  }
  if (raw.length > MAX_CHAT_BODY_CHARS) return refuse("body", "too-long");
  return "ok";
}

export default defineEventHandler(async (event) => {
  // Root middleware sees the full path; prefix-mounted routes do not.
  const pathname = event.url.pathname;
  const isFrameworkPath = pathname.startsWith("/_agent-native/");
  const isSpeak = pathname === SPEAK_PATH;
  if (!isFrameworkPath && !isSpeak) return;

  // Every visitor needs a guest identity, locked or not.
  mintGuestIfNeeded(event, pathname);

  const isChatPost =
    CHAT_PATHS.has(pathname) && event.req.method === "POST";
  const chatBody = isChatPost ? await readChatBody(event) : null;

  if (isUnlocked()) return;

  const session = await getSession(event);
  if (!isGuestEmail(session?.email)) return;

  if (isFrameworkPath && !guestMayCall(event.req.method, pathname)) {
    return deny(event, 403, "Not available on the Shlawp demo");
  }

  if (event.req.method !== "POST") return;

  if (isChatPost) {
    const check = chatBody ? checkChatRequest(chatBody) : "ok";
    if (check === "forbidden") {
      return deny(event, 403, "Not available on the Shlawp demo");
    }
    if (check === "too-long") {
      return deny(event, 413, "This conversation is long enough. Start a new one.");
    }
    const verdict = await consumeRateLimit(session!.email, CHAT_LIMITS);
    if (!verdict.allowed) {
      return deny(
        event,
        429,
        "Shlawp needs a moment. Try again shortly.",
        verdict.retryAfterSeconds,
      );
    }
  }

  if (isSpeak) {
    const verdict = await consumeRateLimit(session!.email, SPEAK_LIMITS);
    if (!verdict.allowed) {
      return deny(
        event,
        429,
        "Shlawp is talked out. Try again shortly.",
        verdict.retryAfterSeconds,
      );
    }
  }
});
