import { createAuthPlugin } from "@agent-native/core/server";
import type { H3Event } from "h3";

import { guestEmail, resolveGuestId } from "../lib/guest.js";

/**
 * There is no sign-in: every visitor is a guest. The framework still serves a
 * login page when a session can't be established (and at /sign-in), so it
 * points back at the demo instead of describing auth configuration. It links
 * rather than redirects so a session outage can't become a redirect loop.
 */
const NO_SIGN_IN_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Shlawp</title>
<style>
  html, body { margin: 0; height: 100%; background: #000; color: rgba(255,255,255,.85);
    font-family: "Inter Variable", Inter, system-ui, sans-serif; }
  main { min-height: 100%; display: flex; flex-direction: column; align-items: center;
    justify-content: center; gap: 1.25rem; padding: 2rem; text-align: center; }
  h1 { margin: 0; font-weight: 300; letter-spacing: .55em; margin-right: -.55em;
    text-transform: uppercase; font-size: 1.5rem; }
  p { margin: 0; color: rgba(255,255,255,.55); max-width: 20rem; line-height: 1.5; }
  a { color: #fff; border: 1px solid rgba(255,255,255,.7); border-radius: 999px;
    padding: .6rem 1.4rem; text-decoration: none; }
  a:focus-visible { outline: 2px solid hsl(248 90% 76%); outline-offset: 3px; }
</style>
</head>
<body>
<main>
  <h1>Shlawp</h1>
  <p>No account needed. Shlawp agrees with everyone.</p>
  <a href="/home">Talk to Shlawp</a>
</main>
</body>
</html>`;

export default createAuthPlugin({
  workspaceAppPublicPaths: ["/"],
  loginHtml: NO_SIGN_IN_HTML,
  // With a custom login page the framework would otherwise serve it at "/".
  rootAuth: false,
  /**
   * Guest sessions: each browser gets its own identity from a signed cookie,
   * with no sign-up. The cookie is minted by `server/middleware/00-guest-guard`.
   * Internal calls arrive without one and resolve to null.
   */
  getSession: async (event: H3Event) => {
    const id = resolveGuestId(event);
    return id ? { email: guestEmail(id), name: "Guest" } : null;
  },
});
