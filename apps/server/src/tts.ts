import express from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { sanitizeDisplayText } from "@mus3o/shared";
import { takeBudget } from "./budgetStore";

// Soporte opcional de ElevenLabs. Sin ELEVENLABS_API_KEY queda desactivado y el cliente
// usa la síntesis del navegador. La clave vive solo aquí: el navegador nunca la ve.
const MAX_CHARS = 500;
const DEFAULT_VOICE = "EXAVITQu4vr4xnSDxMaL";
const VOICE_ID_RE = /^[A-Za-z0-9]{10,40}$/;

const MAX_DAILY_CHARS = () => Number(process.env.MAX_DAILY_TTS_CHARS) || 30_000;
async function takeChars(n: number): Promise<boolean> {
  return takeBudget("tts_chars", n, MAX_DAILY_CHARS());
}

export const ttsEnabled = () => Boolean(process.env.ELEVENLABS_API_KEY);

const voiceId = () => {
  const v = process.env.ELEVENLABS_VOICE_ID ?? "";
  return VOICE_ID_RE.test(v) ? v : DEFAULT_VOICE;
};

const BodySchema = z.object({ text: z.string().trim().min(1).max(MAX_CHARS) }).strict();

export const ttsRouter = express.Router();

ttsRouter.use(
  "/tts",
  rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: true, legacyHeaders: false, message: { error: "Demasiadas solicitudes de voz" } }),
);

ttsRouter.get("/tts/status", (_req, res) => {
  res.json({ enabled: ttsEnabled() });
});

ttsRouter.post("/tts", async (req, res) => {
  if (!ttsEnabled()) {
    res.status(503).json({ error: "Voz no configurada" });
    return;
  }
  const parsed = BodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: `Envía "text" (1-${MAX_CHARS} caracteres)` });
    return;
  }
  const text = sanitizeDisplayText(parsed.data.text, MAX_CHARS);
  if (!text) {
    res.status(400).json({ error: "Texto vacío" });
    return;
  }
  if (!(await takeChars(text.length))) {
    res.status(429).json({ error: "Se alcanzó el tope diario de voz", fallback: "browser" });
    return;
  }
  try {
    const upstream = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId()}?output_format=mp3_44100_64`, {
      method: "POST",
      headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY as string, "content-type": "application/json", accept: "audio/mpeg" },
      body: JSON.stringify({ text, model_id: process.env.ELEVENLABS_MODEL || "eleven_multilingual_v2" }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!upstream.ok) {
      // Nunca se reenvía el cuerpo del proveedor (puede incluir datos de la cuenta).
      console.error(`tts falló: HTTP ${upstream.status}`);
      res.status(502).json({ error: "No se pudo generar la voz", fallback: "browser" });
      return;
    }
    const audio = Buffer.from(await upstream.arrayBuffer());
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "no-store");
    res.send(audio);
  } catch (err) {
    console.error(`tts falló: ${(err as Error).name}`);
    res.status(502).json({ error: "No se pudo generar la voz", fallback: "browser" });
  }
});
