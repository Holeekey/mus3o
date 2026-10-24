import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import {
  GenerateMuseumRequestSchema,
  ImprovePromptRequestSchema,
  LIMITS,
  sanitizeUntrustedText,
  NDJSON_CONTENT_TYPE,
  sampleMuseum,
  type Museum,
  type MuseumStreamEvent,
} from "@mus3o/shared";
import { AiUnavailableError, currentTextStreamer, enrichMuseum, generateFlowMuseum, generateMuseum, improvePrompt, type GenerateInput } from "./claude";
import { replayMuseum, streamNewMuseum } from "./stream";
import { imageRouter } from "./images";
import { ttsRouter } from "./tts";
import { getCached, setCached } from "./cache";

export const app = express();
// Detrás del proxy de Render: la IP real viene en X-Forwarded-For. Sin esto todos los usuarios
// comparten un mismo límite de solicitudes.
app.set("trust proxy", 1);
const WEB_ORIGIN = process.env.WEB_ORIGIN;

app.disable("x-powered-by");
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  next();
});
// En producción el servidor sirve el frontend (mismo origen): sin WEB_ORIGIN no se abre CORS a terceros.
const IS_PROD = process.env.NODE_ENV === "production";
if (WEB_ORIGIN) app.use(cors({ origin: WEB_ORIGIN }));
else if (!IS_PROD) app.use(cors());

// Health check endpoint for Render and uptime monitoring
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", uptime: process.uptime(), timestamp: Date.now() });
});
// Los apuntes pueden ocupar hasta LIMITS.maxNotesChars caracteres (UTF-8: hasta ~4 bytes c/u).
const smallJson = express.json({ limit: "100kb" });
// generate-museum además recibe hasta LIMITS.maxImages imágenes en base64 (≤ 1024 px, en memoria).
const generateJson = express.json({ limit: "8mb" });
app.use((req, res, next) => (req.path === "/api/generate-museum" ? generateJson : smallJson)(req, res, next));
// Las imágenes se piden por decenas al entrar a un museo: límite aparte y más alto.
app.use("/api/image", rateLimit({ windowMs: 60_000, limit: 300, standardHeaders: true, legacyHeaders: false, message: { error: "Demasiadas solicitudes" } }));
app.use("/api", imageRouter);
app.use("/api", ttsRouter);
app.use("/api/", rateLimit({ skip: (req) => req.originalUrl.startsWith("/api/image") || req.originalUrl.startsWith("/api/tts"), windowMs: 60_000, limit: 10, standardHeaders: true, legacyHeaders: false, message: { error: "Demasiadas solicitudes, intenta en un minuto" } }));

const RequestSchema = z.union([
  z.object({ topic: z.string().trim().min(1).max(200) }).strict(),
  z.object({ notes: z.string().trim().min(1).max(LIMITS.maxNotesChars) }).strict(),
]);

// Tope diario de llamadas a Claude (solo fallos de caché) para cuidar el presupuesto de créditos.
const MAX_DAILY = Number(process.env.MAX_DAILY_GENERATIONS) || 200;
let budget = { day: "", used: 0 };
function takeDailySlot(): boolean {
  const day = new Date().toISOString().slice(0, 10);
  if (budget.day !== day) budget = { day, used: 0 };
  if (budget.used >= MAX_DAILY) return false;
  budget.used++;
  return true;
}

const sha256 = (text: string) => createHash("sha256").update(text).digest("hex");

// La clave de caché no guarda los apuntes en claro.
const cacheKey = (input: GenerateInput) => ("notes" in input ? "notes:" + sha256(input.notes) : input.topic);

async function respondWithMuseum(res: express.Response, key: string, generate: () => Promise<Museum>) {
  const started = Date.now();
  try {
    const cached = getCached(key);
    if (cached) {
      res.json(cached);
      return;
    }
    if (!takeDailySlot()) {
      res.status(429).json({ error: "Se alcanzó el tope diario de generaciones", fallback: "placeholder" });
      return;
    }
    const museum = await generate();
    setCached(key, museum);
    res.json(museum);
  } catch (err) {
    if (err instanceof AiUnavailableError) {
      res.status(503).json({ error: "IA no configurada" });
      return;
    }
    // Solo el tipo de error y la latencia: nunca los apuntes ni la respuesta del modelo.
    console.error(`generate-museum falló tras ${Date.now() - started} ms: ${(err as Error).name}`);
    res.status(502).json({ error: "No se pudo generar el mus3o" });
  }
}

app.post("/api/generate-museum", async (req, res) => {
  const legacy = RequestSchema.safeParse(req.body);
  if (legacy.success) {
    const cleanInput: GenerateInput =
      "notes" in legacy.data
        ? { notes: sanitizeUntrustedText(legacy.data.notes, LIMITS.maxNotesChars) }
        : { topic: sanitizeUntrustedText(legacy.data.topic, 200) };

    await respondWithMuseum(res, cacheKey(cleanInput), () => generateMuseum(cleanInput));
    return;
  }
  const flow = GenerateMuseumRequestSchema.safeParse(req.body);
  if (!flow.success) {
    res.status(400).json({ error: `Envía "topic" (1-200 caracteres) o "notes" (hasta ${LIMITS.maxNotesChars} caracteres)` });
    return;
  }
  const cleanFlow = {
    ...flow.data,
    prompt: sanitizeUntrustedText(flow.data.prompt, LIMITS.maxNotesChars),
    sources: flow.data.sources.map((s) => ({
      ...s,
      text: sanitizeUntrustedText(s.text, LIMITS.maxNotesChars),
    })),
  };
  // La clave incluye modo, fuentes e imágenes, no solo el texto.
  await respondWithMuseum(res, "flow:" + sha256(JSON.stringify(cleanFlow)), () => generateFlowMuseum(cleanFlow));
});

// Pausa entre salas al reproducir un museo en caché por el stream (da el efecto de "se va construyendo").
const replayDelayMs = () => {
  const n = Number(process.env.STREAM_REPLAY_DELAY_MS);
  return Number.isFinite(n) && process.env.STREAM_REPLAY_DELAY_MS !== undefined && process.env.STREAM_REPLAY_DELAY_MS !== "" ? n : 450;
};

/**
 * Igual que /api/generate-museum, pero responde en NDJSON (`MuseumStreamEvent`, un evento por línea y
 * vaciado en cada uno) para que el cliente construya el palacio sala a sala mientras la IA escribe.
 * Solo temas y apuntes; el flujo con imágenes sigue por el endpoint sin streaming.
 */
app.post("/api/generate-museum/stream", async (req, res) => {
  const parsed = RequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: `Envía "topic" (1-200 caracteres) o "notes" (hasta ${LIMITS.maxNotesChars} caracteres)` });
    return;
  }
  const input: GenerateInput =
    "notes" in parsed.data
      ? { notes: sanitizeUntrustedText(parsed.data.notes, LIMITS.maxNotesChars) }
      : { topic: sanitizeUntrustedText(parsed.data.topic, 200) };
  const key = cacheKey(input);
  const controller = new AbortController();
  const hasKey = !!process.env.ANTHROPIC_API_KEY;

  let events: AsyncGenerator<MuseumStreamEvent>;
  let cacheResult = false;
  const cached = getCached(key);
  if (cached) {
    events = replayMuseum(cached, { signal: controller.signal, delayMs: replayDelayMs() });
  } else if (!hasKey && "notes" in input) {
    res.status(503).json({ error: "IA no configurada" });
    return;
  } else if (!takeDailySlot()) {
    res.status(429).json({ error: "Se alcanzó el tope diario de generaciones", fallback: "placeholder" });
    return;
  } else if (!hasKey) {
    console.warn("ANTHROPIC_API_KEY no definida: devolviendo mus3o mock");
    events = replayMuseum(enrichMuseum({ ...sampleMuseum, title: (input as { topic: string }).topic }), {
      signal: controller.signal,
      delayMs: replayDelayMs(),
    });
  } else {
    cacheResult = true;
    events = streamNewMuseum(input, { streamText: currentTextStreamer(), signal: controller.signal });
  }

  // Si el cliente se va, se corta la conexión con el modelo para no seguir gastando tokens.
  res.on("close", () => {
    if (!res.writableFinished) controller.abort();
  });
  res.status(200);
  res.setHeader("Content-Type", `${NDJSON_CONTENT_TYPE}; charset=utf-8`);
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  try {
    for await (const event of events) {
      if (controller.signal.aborted || res.destroyed) break;
      if (event.type === "done" && cacheResult) setCached(key, event.museum);
      const flushed = res.write(JSON.stringify(event) + "\n");
      (res as unknown as { flush?: () => void }).flush?.();
      if (!flushed) await new Promise<void>((resolve) => {
        res.once("drain", resolve);
        res.once("close", resolve);
      });
    }
  } finally {
    // Cierra el generador (y con él la conexión con el modelo) si se salió antes de tiempo.
    await events.return(undefined).catch(() => undefined);
    if (!res.writableEnded) res.end();
  }
});

// Solo para depurar el flujo: sugiere mejoras al pedido antes de generar.
app.post("/api/improve-prompt", async (req, res) => {
  if (process.env.ENABLE_DEBUG_ROUTES !== "true") {
    res.status(404).json({ error: "No encontrado" });
    return;
  }
  const parsed = ImprovePromptRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Solicitud inválida" });
    return;
  }
  try {
    if (!takeDailySlot()) {
      res.status(429).json({ error: "Se alcanzó el tope diario de generaciones" });
      return;
    }
    res.json(await improvePrompt(parsed.data));
  } catch (err) {
    if (err instanceof AiUnavailableError) {
      res.status(503).json({ error: "IA no configurada" });
      return;
    }
    console.error(`improve-prompt falló: ${(err as Error).name}`);
    res.status(502).json({ error: "No se pudo mejorar el pedido" });
  }
});

// Serve frontend SPA in production if built
const appDir = path.dirname(fileURLToPath(import.meta.url));
const webDistCandidates = [
  path.resolve(process.cwd(), "apps/web/dist"),
  path.resolve(appDir, "../../web/dist"),
  path.resolve(appDir, "../web/dist"),
];
const webDistPath = webDistCandidates.find((dir) => fs.existsSync(dir));

if (webDistPath) {
  app.use(
    express.static(webDistPath, {
      maxAge: "1d",
      setHeaders: (res, filePath) => {
        // Hashed assets in assets/ can be safely cached for 1 year
        if (filePath.includes("/assets/")) {
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        } else if (filePath.endsWith("index.html")) {
          // El HTML apunta a los assets con hash: si se cachea, un redeploy sirve una versión vieja.
          res.setHeader("Cache-Control", "no-cache");
        }
      },
    }),
  );

  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api/")) {
      next();
      return;
    }
    res.setHeader("Cache-Control", "no-cache");
    res.sendFile(path.join(webDistPath, "index.html"));
  });
}

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  res.status(400).json({ error: "Solicitud inválida" });
});
