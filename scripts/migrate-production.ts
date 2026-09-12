import { closeDbExec, withMigrationRuntime } from "@agent-native/core/db";
import { runFrameworkReleaseMigrations } from "@agent-native/core/server";
import postgres from "postgres";

import { runShlawpMigrations } from "../server/plugins/db.js";

/** The variables the build command collapses into DATABASE_URL, in order. */
const URL_VARS = ["NETLIFY_DATABASE_URL", "DATABASE_URL", "NETLIFY_DB_URL"];

/**
 * The framework's schema probe reports "could not probe required schema" for
 * every cause — no connection string, wrong host, missing privileges, a
 * read-only replica — and swallows the Postgres error underneath. A deploy is
 * an expensive place to guess, so the release script says what it sees before
 * it hands over.
 */
function describeEnv(): string | undefined {
  for (const name of URL_VARS) {
    // guard:allow-env-credential — reporting presence, never the value
    const value = process.env[name];
    console.log(`[preflight] ${name}: ${value ? "set" : "not set"}`);
  }

  // Netlify's UI accepts any casing, but Linux env lookup is exact: a variable
  // named Database_URL is invisible to ${DATABASE_URL} and the build silently
  // migrates nothing.
  const nearMiss = Object.keys(process.env).filter(
    (key) => !URL_VARS.includes(key) && URL_VARS.some((v) => v.toLowerCase() === key.toLowerCase()),
  );
  if (nearMiss.length > 0) {
    console.log(
      `[preflight] variables differing only by case: ${nearMiss.join(", ")} — rename to upper case`,
    );
  }

  // guard:allow-env-credential — the build command already collapsed the chain
  return process.env.DATABASE_URL || undefined;
}

/** Host and role only. The password never reaches the build log. */
function describeTarget(url: string): void {
  try {
    const parsed = new URL(url);
    console.log(
      `[preflight] target: ${parsed.username}@${parsed.hostname}:${parsed.port || "5432"}${parsed.pathname}`,
    );
    console.log(`[preflight] password: ${parsed.password ? "present" : "MISSING"}`);
  } catch {
    console.log("[preflight] target: connection string is not a valid URL");
  }
}

/**
 * Connect the way the framework does and check the things its probe needs.
 * Any failure here is reported with the real Postgres code and detail, then
 * rethrown — this diagnoses, it never papers over.
 */
async function preflight(url: string): Promise<void> {
  describeTarget(url);
  const sql = postgres(url, { prepare: false, max: 1, idle_timeout: 5 });
  try {
    const [row] = await sql`
      select
        current_user as role,
        current_database() as db,
        pg_is_in_recovery() as read_replica,
        has_schema_privilege(current_user, 'public', 'CREATE') as can_create
    `;
    console.log(
      `[preflight] connected as ${row.role} to ${row.db}; ` +
        `read replica: ${row.read_replica}; can create in public: ${row.can_create}`,
    );
    if (row.read_replica) {
      throw new Error("connected to a read-only replica; migrations need the primary");
    }
    if (!row.can_create) {
      throw new Error(`role ${row.role} cannot CREATE in schema public`);
    }

    // The exact object the release step dies on.
    const [probe] = await sql`
      select to_regclass('public.integration_a2a_continuations') as tbl
    `;
    console.log(`[preflight] integration_a2a_continuations: ${probe.tbl ?? "absent (will be created)"}`);
  } catch (error) {
    const pg = error as { message?: string; code?: string; detail?: string; hint?: string };
    console.error(
      `[preflight] FAILED: ${pg.message}` +
        (pg.code ? ` (code ${pg.code})` : "") +
        (pg.detail ? ` — ${pg.detail}` : "") +
        (pg.hint ? ` hint: ${pg.hint}` : ""),
    );
    throw error;
  } finally {
    await sql.end({ timeout: 5 });
  }
}

/**
 * Release-time schema entrypoint.
 *
 * Every deploy runs this once, and request functions never touch schema. That
 * ordering is not an optimization: on serverless, "migrate on first use" means
 * migrate on EVERY cold start, and a production incident traced a multi-hour
 * outage to schema introspection running 4-6 times concurrently on the request
 * path.
 *
 * `withMigrationRuntime()` is load-bearing. The Netlify BUILD environment sets
 * NETLIFY=true, so this script looks like a serverless request to the guard in
 * `runMigrations` — it is allowed to migrate only because it claims duty here.
 * A release entrypoint that forgets the wrapper silently does nothing.
 *
 * Framework tables come first, then this app's own (the rate-limit counter).
 */
async function main(): Promise<void> {
  const url = describeEnv();
  if (!url) {
    throw new Error(
      `No database connection string. The build command reads ${URL_VARS.join(", ")} ` +
        `in that order; set one of them, spelled exactly, for the production deploy context.`,
    );
  }
  await preflight(url);

  await withMigrationRuntime(async () => {
    await runFrameworkReleaseMigrations(null);
    await runShlawpMigrations(null);
  });
}

/**
 * Exit explicitly. After the last statement applies, something in the runtime
 * keeps the event loop alive; the first complete run against Supabase sat
 * idle until Netlify's 18-minute limit killed the build with every migration
 * already committed. The framework's own CLI runner closes the pools and then
 * calls process.exit() on every path for the same reason.
 *
 * The pool close is bounded too: a pooler that never acknowledges the
 * disconnect must not turn a finished migration into a failed deploy.
 */
let failed = false;
try {
  await main();
} catch (error) {
  failed = true;
  console.error(error);
} finally {
  const closeDeadline = new Promise<void>((resolve) => {
    setTimeout(() => {
      console.warn("[db] pool did not close within 10s; exiting anyway");
      resolve();
    }, 10_000).unref();
  });
  await Promise.race([closeDbExec().catch(() => {}), closeDeadline]);
}
process.exit(failed ? 1 : 0);
