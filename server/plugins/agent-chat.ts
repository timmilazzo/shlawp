import { appStateGet } from "@agent-native/core/application-state";
import { getOrgContext } from "@agent-native/core/org";
import {
  createAgentChatPlugin,
  loadActionsFromStaticRegistry,
} from "@agent-native/core/server";

import actionsRegistry from "../../.generated/actions-registry.js";
import {
  SHLAWP_MODE_LAST_KEY,
  parseShlawpMode,
  shlawpModeKey,
  type ShlawpMode,
} from "../../shared/shlawp-mode.js";
import { chatThreadIdFromEvent } from "../lib/chat-thread.js";
import { SECOND_OPINION_SYSTEM_PROMPT } from "../prompts/second-opinion.js";
import { SHLAWP_SYSTEM_PROMPT } from "../prompts/shlawp.js";

/**
 * The persona lives in the per-request context below, not here, because the
 * mode is chosen per thread: the "I'd like a second opinion" toggle stores it
 * in application state and the same question can be re-answered either way.
 */
const BASE_SYSTEM_PROMPT = `You are one of two characters in a public web demo called Shlawp. The mode instructions that follow tell you which character you are for this reply. Follow them exactly and stay in that character for the whole reply.`;

const DEFAULT_MODE: ShlawpMode =
  // guard:allow-env-credential — default mode for threads without a stored choice, not a credential
  process.env.SHLAWP_MODE === "second-opinion" ? "second-opinion" : "shlawp";

async function resolveThreadMode(
  event: unknown,
  owner: string,
): Promise<ShlawpMode> {
  if (!owner) return DEFAULT_MODE;
  const threadId = chatThreadIdFromEvent(event);
  try {
    const forThread = threadId
      ? parseShlawpMode(await appStateGet(owner, shlawpModeKey(threadId)))
      : null;
    if (forThread) return forThread;
    const last = parseShlawpMode(await appStateGet(owner, SHLAWP_MODE_LAST_KEY));
    return last ?? DEFAULT_MODE;
  } catch (error) {
    console.warn("[shlawp] could not read thread mode", error);
    return DEFAULT_MODE;
  }
}

export default createAgentChatPlugin({
  appId: "shlawp",
  actions: loadActionsFromStaticRegistry(actionsRegistry),
  resolveOrgId: async (event) => (await getOrgContext(event)).orgId,
  systemPrompt: BASE_SYSTEM_PROMPT,
  extraContext: async (event, owner) =>
    (await resolveThreadMode(event, owner)) === "second-opinion"
      ? SECOND_OPINION_SYSTEM_PROMPT
      : SHLAWP_SYSTEM_PROMPT,

  // Shlawp talks and does nothing else. The guardrail in SHLAWP.md — "never
  // takes actions or claims to have taken them" — is enforced here rather than
  // left to the prompt: an empty allowlist means the model is offered no tools
  // at all, so a visitor cannot talk it into running SQL, creating extensions,
  // fetching URLs, or sending mail.
  resolveActionSurface: async () => ({ allowedActionNames: [] }),
  frameworkTools: "minimal",
  mcp: { enabled: false },
  a2aAgentDelegation: false,
  codeExecution: { production: "off" },
  // Skip the framework's generic preamble and resource loading: it costs
  // thousands of tokens per turn and works against a 35-word sycophant.
  leanPrompt: true,

  // The deployment pays for every visitor with its own ANTHROPIC_API_KEY, so
  // the engine and model are pinned here instead of being left to per-request
  // or per-user settings.
  engine: process.env.AGENT_ENGINE ?? "anthropic",
  model: process.env.AGENT_MODEL ?? "claude-haiku-4-5",
});
