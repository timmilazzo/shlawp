import { defineNitroPlugin } from "@agent-native/core";

/**
 * Netlify Database, the managed Postgres that replaced the Neon extension,
 * exposes its connection string as NETLIFY_DB_URL. This framework version only
 * reads DATABASE_URL or NETLIFY_DATABASE_URL, so the running site aliases it
 * before anything opens a connection. The build does the same in netlify.toml.
 * Runs at module load so it precedes every plugin and request.
 */
export const netlifyDatabaseAlias: string = (() => {
  if (process.env.DATABASE_URL) return "skipped: DATABASE_URL already set";
  if (process.env.NETLIFY_DATABASE_URL) {
    return "skipped: NETLIFY_DATABASE_URL already set";
  }
  if (!process.env.NETLIFY_DB_URL) return "skipped: NETLIFY_DB_URL missing";
  // guard:allow-env-mutation — deploy-level alias set once at boot, identical for every request
  process.env.DATABASE_URL = process.env.NETLIFY_DB_URL;
  return "applied";
})();

export default defineNitroPlugin(() => {});
