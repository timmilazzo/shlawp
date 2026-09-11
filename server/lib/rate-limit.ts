import { getDbExec } from "@agent-native/core/db";

/**
 * A viral free chatbot is a bill (SHLAWP.md). Counters live in SQL rather than
 * in process memory because serverless functions scale out: an in-memory limit
 * would reset on every cold start and be enforced per instance.
 */
export const RATE_LIMIT_TABLE = "shlawp_rate_limit";

export type RateLimitWindow = {
  /** Distinct name per limit, e.g. "chat-minute". */
  name: string;
  windowMs: number;
  max: number;
};

export type RateLimitVerdict = {
  allowed: boolean;
  retryAfterSeconds: number;
};

/**
 * Count one hit against every window and report whether the caller is over any
 * of them. Fails open: if the counter table is unreachable the demo keeps
 * working rather than refusing everyone.
 */
export async function consumeRateLimit(
  subject: string,
  windows: readonly RateLimitWindow[],
): Promise<RateLimitVerdict> {
  const now = Date.now();
  try {
    const exec = getDbExec();
    for (const window of windows) {
      const bucket = Math.floor(now / window.windowMs);
      const key = `${window.name}:${subject}`;
      const result = await exec.execute({
        sql: `INSERT INTO ${RATE_LIMIT_TABLE} (key, bucket, hits)
              VALUES ($1, $2, 1)
              ON CONFLICT (key) DO UPDATE SET
                hits = CASE
                  WHEN ${RATE_LIMIT_TABLE}.bucket = $2
                  THEN ${RATE_LIMIT_TABLE}.hits + 1
                  ELSE 1
                END,
                bucket = $2
              RETURNING hits`,
        args: [key, bucket],
        timeoutMs: 2_000,
      });
      const hits = Number(result.rows[0]?.hits ?? 0);
      if (hits > window.max) {
        const nextWindow = (bucket + 1) * window.windowMs;
        return {
          allowed: false,
          retryAfterSeconds: Math.max(
            1,
            Math.ceil((nextWindow - now) / 1000),
          ),
        };
      }
    }
  } catch (error) {
    console.warn("[shlawp] rate limit check failed, allowing request", error);
  }
  return { allowed: true, retryAfterSeconds: 0 };
}

/** Turns sent to the model. */
export const CHAT_LIMITS: RateLimitWindow[] = [
  { name: "chat-minute", windowMs: 60_000, max: 8 },
  { name: "chat-hour", windowMs: 60 * 60_000, max: 60 },
];

/** ElevenLabs calls, which bill per character. */
export const SPEAK_LIMITS: RateLimitWindow[] = [
  { name: "speak-minute", windowMs: 60_000, max: 12 },
  { name: "speak-hour", windowMs: 60 * 60_000, max: 90 },
];
