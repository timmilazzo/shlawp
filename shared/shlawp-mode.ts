/**
 * Which agent answers a thread: Shlawp, who agrees with everyone, or the
 * second opinion, who is allowed to disagree. Stored per thread in application
 * state so a thread can be re-answered in the other mode without a reload.
 */
export type ShlawpMode = "shlawp" | "second-opinion";

export type ShlawpModeState = { mode: ShlawpMode };

export function shlawpModeKey(threadId: string): string {
  return `shlawp-mode:${threadId}`;
}

/**
 * The visitor's most recent choice. A brand-new thread has no stored mode until
 * the client knows its id, which can be after its first run starts; the server
 * falls back to this so that first reply still matches the toggle.
 */
export const SHLAWP_MODE_LAST_KEY = "shlawp-mode:last";

export function parseShlawpMode(value: unknown): ShlawpMode | null {
  const mode = (value as Partial<ShlawpModeState> | null)?.mode;
  return mode === "shlawp" || mode === "second-opinion" ? mode : null;
}
