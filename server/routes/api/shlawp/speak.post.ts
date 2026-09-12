import { getSession } from "@agent-native/core/server";
import { defineEventHandler, HTTPError, readBody } from "h3";

/**
 * Shlawp's voice. Binary audio can't be modeled as a JSON action, so this is a
 * route-only endpoint: text in, ElevenLabs MP3 out. Replies are capped at a
 * few sentences by the prompt, so the length cap only stops misuse.
 */
const VOICE_ID = "aWSwMfJOK8iYZivczje6";
const MODEL_ID = "eleven_flash_v2_5";
const MAX_CHARS = 600;

async function describeUpstreamError(
  upstream: Response,
): Promise<{ slug: string; message: string }> {
  try {
    const body = (await upstream.json()) as {
      detail?: { status?: unknown; message?: unknown } | string;
    };
    if (typeof body.detail === "string") {
      return { slug: "error", message: body.detail.slice(0, 200) };
    }
    return {
      slug:
        typeof body.detail?.status === "string" ? body.detail.status : "error",
      message:
        typeof body.detail?.message === "string"
          ? body.detail.message.slice(0, 200)
          : "",
    };
  } catch {
    return { slug: "error", message: "" };
  }
}

export default defineEventHandler(async (event) => {
  const session = await getSession(event);
  if (!session?.email) {
    throw new HTTPError({ status: 401, message: "Sign in required" });
  }

  // guard:allow-env-credential — deploy-level key; the site pays for Shlawp's voice
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new HTTPError({ status: 409, message: "Voice not configured" });
  }

  const body = await readBody<{ text?: unknown }>(event);
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!text) {
    throw new HTTPError({ status: 400, message: "Nothing to say" });
  }
  if (text.length > MAX_CHARS) {
    throw new HTTPError({ status: 413, message: "Too long to say" });
  }

  const upstream = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "content-type": "application/json",
        accept: "audio/mpeg",
      },
      body: JSON.stringify({ text, model_id: MODEL_ID }),
    },
  );

  if (!upstream.ok || !upstream.body) {
    // ElevenLabs explains itself in `detail.status` (voice_not_found,
    // quota_exceeded, …). Surface that slug and the HTTP status so a failure
    // is diagnosable from the client; the full message stays in the log.
    const detail = await describeUpstreamError(upstream);
    console.error(
      `[shlawp/speak] ElevenLabs responded ${upstream.status}: ${detail.slug} ${detail.message}`,
    );
    throw new HTTPError({
      status: 502,
      message: "Voice unavailable",
      data: { upstreamStatus: upstream.status, reason: detail.slug },
    });
  }

  return new Response(upstream.body, {
    headers: {
      "content-type": "audio/mpeg",
      "cache-control": "no-store",
    },
  });
});
