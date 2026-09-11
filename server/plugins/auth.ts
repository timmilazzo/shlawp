import { createAuthPlugin } from "@agent-native/core/server";
import { getCookie, setCookie } from "h3";
import type { H3Event } from "h3";

import {
  GUEST_COOKIE,
  GUEST_COOKIE_MAX_AGE,
  guestEmail,
  issueGuestCookieValue,
  readGuestId,
} from "../lib/guest.js";

const rawAppTitle = "Shlawp";
const appTitle = rawAppTitle === "{" + "{APP_TITLE}}" ? "Chat" : rawAppTitle;

/**
 * The one request allowed to mint a new guest. The client calls it before
 * anything else, so minting anywhere would hand a single visitor several
 * identities from the parallel requests on first load.
 */
const MINT_PATH = "/_agent-native/auth/session";

export default createAuthPlugin({
  workspaceAppPublicPaths: ["/"],
  /**
   * Guest sessions: each browser gets its own identity from a signed cookie,
   * with no sign-up. Internal calls arrive without one and must resolve to
   * null rather than mint an identity.
   */
  getSession: async (event: H3Event) => {
    const existing = readGuestId(getCookie(event, GUEST_COOKIE));
    if (existing) {
      return { email: guestEmail(existing), name: "Guest" };
    }

    if (event.url.pathname !== MINT_PATH) return null;

    const { id, cookie } = issueGuestCookieValue();
    setCookie(event, GUEST_COOKIE, cookie, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: GUEST_COOKIE_MAX_AGE,
    });
    return { email: guestEmail(id), name: "Guest" };
  },
  marketing: {
    appName: appTitle,
    screenshotPath: "/auth-marketing/chat.webp",
    screenshotWidth: 914,
    screenshotHeight: 818,
    learnMoreUrl: "https://agent-native.com/apps/chat",
    tagline: "A tribute to Ryan George. Ask it anything. It agrees.",
    features: [
      "Ask Shlawp anything out loud",
      "It agrees, every time",
      "Built on Agent-Native",
    ],
  },
});
