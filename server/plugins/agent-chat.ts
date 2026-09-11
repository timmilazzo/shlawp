import { getOrgContext } from "@agent-native/core/org";
import {
  createAgentChatPlugin,
  loadActionsFromStaticRegistry,
} from "@agent-native/core/server";

import actionsRegistry from "../../.generated/actions-registry.js";
import { SECOND_OPINION_SYSTEM_PROMPT } from "../prompts/second-opinion.js";
import { SHLAWP_SYSTEM_PROMPT } from "../prompts/shlawp.js";

const INITIAL_TOOL_NAMES = ["view-screen", "navigate", "hello"];

export default createAgentChatPlugin({
  appId: "shlawp",
  actions: loadActionsFromStaticRegistry(actionsRegistry),
  initialToolNames: INITIAL_TOOL_NAMES,
  resolveOrgId: async (event) => (await getOrgContext(event)).orgId,
  // Shlawp mode is the default. SHLAWP_MODE=second-opinion flips the server
  // to the honest agent. The per-thread toggle in the UI is the next step —
  // see SHLAWP.md ("The turn").
  systemPrompt:
    // guard:allow-env-credential — prompt mode switch, not a credential
    process.env.SHLAWP_MODE === "second-opinion"
      ? SECOND_OPINION_SYSTEM_PROMPT
      : SHLAWP_SYSTEM_PROMPT,
});
