import { Hono, type Context } from "hono";
import { bodyLimit } from "hono/body-limit";
import { MAX_WAV_BYTES, parseWav, WavError } from "../stt/wav";
import { SpeechUnavailableError, type Transcriber } from "../stt/transcriber";

const tooLarge = (c: Context) => c.json({ error: "payload_too_large" }, 413);

export function sttRoutes(transcriber: Transcriber): Hono {
  const routes = new Hono();
  routes.post(
    "/stt/transcribe",
    bodyLimit({ maxSize: MAX_WAV_BYTES, onError: tooLarge }),
    async (c) => {
      const body = new Uint8Array(await c.req.arrayBuffer());
      try {
        const samples = parseWav(body);
        const text = await transcriber.transcribe(samples);
        return c.json({ text });
      } catch (error) {
        if (error instanceof WavError) {
          return c.json({ error: "invalid_audio", fields: { audio: [error.message] } }, 400);
        }
        if (error instanceof SpeechUnavailableError) {
          return c.json({ error: "speech_unavailable", reason: error.reason }, 503);
        }
        throw error;
      }
    },
  );
  return routes;
}
