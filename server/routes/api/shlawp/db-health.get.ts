import {
  getDbExec,
  getRuntimeDatabaseSource,
  getRuntimeDatabaseUrl,
  isProductionServerlessFunctionRuntime,
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
      AWS_LAMBDA_FUNCTION_NAME: Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME),
      NETLIFY_FUNCTION_NAME: Boolean(process.env.NETLIFY_FUNCTION_NAME),
      // Inlined into the bundle at build time; shows what the build baked in.
      AGENT_NATIVE_RELEASE_MIGRATIONS:
        process.env.AGENT_NATIVE_RELEASE_MIGRATIONS ?? null,
    },
    // The framework's own verdict. When false, every cold start re-probes the
    // whole schema instead of trusting the release migration — the first
    // condition it checks is NODE_ENV === "production".
    productionServerlessRuntime: isProductionServerlessFunctionRuntime(),
    alias: netlifyDatabaseAlias,
    source: getRuntimeDatabaseSource(),
    target: describeTarget(url),
    query,
  };
});
