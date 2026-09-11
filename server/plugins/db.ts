import { runMigrations } from "@agent-native/core/db";

import { RATE_LIMIT_TABLE } from "../lib/rate-limit.js";

/**
 * App-owned schema. The framework owns its own tables; this is only the
 * counter behind the public demo's rate limits.
 */
export const runShlawpMigrations = runMigrations(
  [
    {
      version: 1,
      name: "shlawp-rate-limit",
      sql: `CREATE TABLE IF NOT EXISTS ${RATE_LIMIT_TABLE} (
              key TEXT PRIMARY KEY,
              bucket BIGINT NOT NULL,
              hits INTEGER NOT NULL DEFAULT 0
            )`,
    },
  ],
  { table: "shlawp_migrations" },
);

export default runShlawpMigrations;
