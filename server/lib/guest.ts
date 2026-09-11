import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

import { getCookie, setCookie } from "h3";
import type { H3Event } from "h3";

/**
 * Shlawp is a public demo: no sign-up, but every browser still needs its own
 * identity so visitors don't share one chat history. The cookie carries a
 * random id signed with the deployment secret; the id becomes a guest email.
 */
export const GUEST_COOKIE = "shlawp_guest";
export const GUEST_EMAIL_DOMAIN = "guest.shlawp.invalid";
export const GUEST_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

function signingKey(): string {
  return (
    // guard:allow-env-credential — deploy-level auth secret, also used to sign guest cookies
    process.env.BETTER_AUTH_SECRET ||
    // Local dev without a secret still needs stable guest ids.
    "shlawp-development-guest-key"
  );
}

function sign(id: string): string {
  return createHmac("sha256", signingKey()).update(id).digest("base64url");
}

export function issueGuestCookieValue(): { id: string; cookie: string } {
  const id = randomUUID();
  return { id, cookie: `${id}.${sign(id)}` };
}

export function readGuestId(cookie: string | undefined): string | null {
  if (!cookie) return null;
  const separator = cookie.lastIndexOf(".");
  if (separator <= 0) return null;
  const id = cookie.slice(0, separator);
  const signature = cookie.slice(separator + 1);
  const expected = sign(id);
  if (signature.length !== expected.length) return null;
  if (
    !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  ) {
    return null;
  }
  return id;
}

export function guestEmail(id: string): string {
  return `guest-${id.toLowerCase()}@${GUEST_EMAIL_DOMAIN}`;
}

export function isGuestEmail(email: string | null | undefined): boolean {
  return !!email && email.toLowerCase().endsWith(`@${GUEST_EMAIL_DOMAIN}`);
}

/**
 * The one request allowed to mint a new guest. The client calls it before
 * anything else, so minting anywhere would hand a single visitor several
 * identities from the parallel requests on first load.
 */
export const GUEST_MINT_PATH = "/_agent-native/auth/session";

const MINTED_CONTEXT_KEY = "shlawpGuestId";

/**
 * Called from root middleware, where the full request path is still intact
 * (framework routes are mounted by prefix and see it stripped). Mints a guest
 * cookie on the session request when the visitor has none, and records the id
 * on the request context so `getSession` resolves it within this same request.
 */
export function mintGuestIfNeeded(event: H3Event, pathname: string): void {
  if (pathname !== GUEST_MINT_PATH) return;
  if (readGuestId(getCookie(event, GUEST_COOKIE))) return;
  const { id, cookie } = issueGuestCookieValue();
  setCookie(event, GUEST_COOKIE, cookie, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: GUEST_COOKIE_MAX_AGE,
  });
  event.context[MINTED_CONTEXT_KEY] = id;
}

/** The guest for this request: the signed cookie, or one minted just now. */
export function resolveGuestId(event: H3Event): string | null {
  const fromCookie = readGuestId(getCookie(event, GUEST_COOKIE));
  if (fromCookie) return fromCookie;
  const minted = event.context[MINTED_CONTEXT_KEY];
  return typeof minted === "string" ? minted : null;
}
