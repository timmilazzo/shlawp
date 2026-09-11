import { getSession } from "@agent-native/core/server";
import { defineEventHandler, HTTPError, readBody } from "h3";

/**
 * Shlawp's voice. Binary audio can't be modeled as a JSON action, so this is a
 * route-only endpoint: text in, ElevenLabs MP3 out. Replies are capped at a
 * few sentences by the prompt, so the length cap only stops misuse.
 */
const VOICE_ID = "duHr6zuf2C3ZG9scTB9q";
const MODEL_ID = "eleven_flash_v2_5";
const MAX_CHARS = 600;

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
    console.error(`[shlawp/speak] ElevenLabs responded ${upstream.status}`);
    throw new HTTPError({ status: 502, message: "Voice unavailable" });
  }

  return new Response(upstream.body, {
    headers: {
      "content-type": "audio/mpeg",
      "cache-control": "no-store",
    },
  });
});
