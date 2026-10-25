import express from "express";
import rateLimit from "express-rate-limit";
import { takeBudget } from "./budgetStore";
import { describeUpstreamError } from "./elevenlabs";

// Dictado en tiempo real con ElevenLabs Scribe. El audio NO pasa por este servidor: el navegador abre un websocket
// directo con ElevenLabs usando un token de un solo uso que se mintea aquí. La clave vive solo en el servidor y
// el audio no se guarda. Sin ELEVENLABS_API_KEY queda desactivado y el cliente usa el dictado del navegador.
const DEFAULT_MODEL = "scribe_v2_realtime";
const MODEL_RE = /^[a-z0-9_]{3,40}$/;
const TOKEN_URL = "https://api.elevenlabs.io/v1/single-use-token/realtime_scribe";

const MAX_DAILY_SESSIONS = () => Number(process.env.MAX_DAILY_STT_SESSIONS) || 300;

export const sttEnabled = () => Boolean(process.env.ELEVENLABS_API_KEY);

const modelId = () => {
  const m = process.env.ELEVENLABS_STT_MODEL ?? "";
  return MODEL_RE.test(m) ? m : DEFAULT_MODEL;
};

export const sttRouter = express.Router();

sttRouter.use(
  "/stt",
  rateLimit({ windowMs: 60_000, limit: 20, standardHeaders: true, legacyHeaders: false, message: { error: "Demasiadas solicitudes de dictado" } }),
);

sttRouter.get("/stt/status", (_req, res) => {
  res.json({ enabled: sttEnabled() });
});

sttRouter.post("/stt/token", async (_req, res) => {
  if (!sttEnabled()) {
    res.status(503).json({ error: "Dictado no configurado" });
    return;
  }
  if (!(await takeBudget("stt_sessions", 1, MAX_DAILY_SESSIONS()))) {
    res.status(429).json({ error: "Se alcanzó el tope diario de dictado", fallback: "browser" });
    return;
  }
  try {
    const upstream = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY as string },
      signal: AbortSignal.timeout(10_000),
    });
    if (!upstream.ok) {
      // Nunca se reenvía el cuerpo del proveedor (puede incluir datos de la cuenta).
      console.error(`stt token falló: ${await describeUpstreamError(upstream)}`);
      res.status(502).json({ error: "No se pudo iniciar el dictado", fallback: "browser" });
      return;
    }
    const { token } = (await upstream.json()) as { token?: unknown };
    if (typeof token !== "string" || !token) {
      console.error("stt token falló: respuesta sin token");
      res.status(502).json({ error: "No se pudo iniciar el dictado", fallback: "browser" });
      return;
    }
    res.setHeader("Cache-Control", "no-store");
    res.json({ token, modelId: modelId() });
  } catch (err) {
    console.error(`stt token falló: ${(err as Error).name}`);
    res.status(502).json({ error: "No se pudo iniciar el dictado", fallback: "browser" });
  }
});
