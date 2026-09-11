import {
  getDbExec,
  getRuntimeDatabaseSource,
  getRuntimeDatabaseUrl,
} from "@agent-native/core/db";
import { defineEventHandler } from "h3";

import { netlifyDatabaseAlias } from "../../../plugins/00-netlify-database-url.js";

/**
 * Temporary deploy diagnostic: says whether the running site can reach a
 * database and which variable it resolved, without returning any credential.
 * Remove once the deployment is healthy.
 */
function describeTarget(url: string): string {
  if (!url) return "none";
  if (url.toLowerCase().startsWith("pglite:")) return "pglite (local only)";
  try {
    const parsed = new URL(url);
    // Host only, first label masked: enough to identify the provider.
    const host = parsed.hostname.replace(/^[^.]+/, "*");
    return `${parsed.protocol}//${host}`;
  } catch {
    return "unparseable";
  }
}

/** Never let a connection string or password reach the response. */
function sanitize(message: string): string {
  return message
    .replace(/postgres(?:ql)?:\/\/\S+/gi, "<url>")
    .replace(/password[^\s,;]*/gi, "<redacted>")
    .slice(0, 300);
}

export default defineEventHandler(async () => {
  const url = getRuntimeDatabaseUrl();
  let query: { ok: boolean; code?: string; message?: string };
  try {
    await getDbExec().execute({ sql: "select 1 as ok", timeoutMs: 5_000 });
    query = { ok: true };
  } catch (error) {
    query = {
      ok: false,
      code: String((error as { code?: unknown })?.code ?? ""),
      message: sanitize(
        error instanceof Error ? error.message : String(error),
      ),
    };
  }

  return {
    env: {
      DATABASE_URL: Boolean(process.env.DATABASE_URL),
      NETLIFY_DATABASE_URL: Boolean(process.env.NETLIFY_DATABASE_URL),
      NETLIFY_DB_URL: Boolean(process.env.NETLIFY_DB_URL),
      NETLIFY_DATABASE_URL_UNPOOLED: Boolean(
        process.env.NETLIFY_DATABASE_URL_UNPOOLED,
      ),
      // Presence only — do these deploy variables reach the functions at all?
      BETTER_AUTH_SECRET: Boolean(process.env.BETTER_AUTH_SECRET),
      // guard:allow-env-credential — presence check only, the value is never read
      ANTHROPIC_API_KEY: Boolean(process.env.ANTHROPIC_API_KEY),
      // guard:allow-env-credential — presence check only, the value is never read
      ELEVENLABS_API_KEY: Boolean(process.env.ELEVENLABS_API_KEY),
      AUTO_CREATE_DEFAULT_ORG:
        // guard:allow-env-credential — deploy-level org flag, not a credential
        process.env.AUTO_CREATE_DEFAULT_ORG ?? null,
      NETLIFY: process.env.NETLIFY ?? null,
      NODE_ENV: process.env.NODE_ENV ?? null,
    },
    alias: netlifyDatabaseAlias,
    source: getRuntimeDatabaseSource(),
    target: describeTarget(url),
    query,
  };
});
