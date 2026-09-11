import { getOrgContext } from "@agent-native/core/org";
import {
  createAgentChatPlugin,
  loadActionsFromStaticRegistry,
} from "@agent-native/core/server";

import actionsRegistry from "../../.generated/actions-registry.js";
import { SECOND_OPINION_SYSTEM_PROMPT } from "../prompts/second-opinion.js";
import { SHLAWP_SYSTEM_PROMPT } from "../prompts/shlawp.js";

export default createAgentChatPlugin({
  appId: "shlawp",
  actions: loadActionsFromStaticRegistry(actionsRegistry),
  resolveOrgId: async (event) => (await getOrgContext(event)).orgId,
  // Shlawp mode is the default. SHLAWP_MODE=second-opinion flips the server
  // to the honest agent. The per-thread toggle in the UI is the next step —
  // see SHLAWP.md ("The turn").
  systemPrompt:
    // guard:allow-env-credential — prompt mode switch, not a credential
    process.env.SHLAWP_MODE === "second-opinion"
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

  // The deployment pays for every visitor, so the engine and model are pinned
  // here instead of being left to per-request or per-user settings.
  engine: process.env.AGENT_ENGINE ?? "builder",
  model: process.env.AGENT_MODEL ?? "claude-haiku-4-5",
});
