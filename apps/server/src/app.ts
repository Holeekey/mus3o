import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import {
  DigestSourcesRequestSchema,
  GenerateMuseumRequestSchema,
  ImprovePromptRequestSchema,
  LIMITS,
  sanitizeUntrustedText,
  NDJSON_CONTENT_TYPE,
  sampleMuseum,
  type GenerateMuseumRequest,
  type Museum,
  type MuseumStreamEvent,
} from "@mus3o/shared";
import { AiUnavailableError, currentTextStreamer, digestSources, enrichMuseum, flowStreamable, generateFlowMuseum, generateMuseum, improvePrompt, type GenerateInput } from "./claude";
import { generateThenReplay, isFlowInput, replayMuseum, streamNewMuseum, type StreamInput } from "./stream";
import { imageRouter } from "./images";
import { infoRouter } from "./info";
import { ttsRouter } from "./tts";
import { assetRouter } from "./assetRoutes";
import { arisRouter } from "./arisHelp";
import { getCached, getCachedDigest, setCached, setCachedDigest } from "./cache";

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
// digest-sources recibe hasta LIMITS.maxDigestInputChars caracteres de texto ya extraído.
const digestJson = express.json({ limit: "1mb" });
const jsonParserFor = (path: string) =>
  path === "/api/generate-museum" || path === "/api/generate-museum/stream" ? generateJson : path === "/api/digest-sources" ? digestJson : smallJson;
app.use((req, res, next) => jsonParserFor(req.path)(req, res, next));
// Las imágenes se piden por decenas al entrar a un museo: límite aparte y más alto.
app.use(["/api/image", "/api/info"], rateLimit({ windowMs: 60_000, limit: 300, standardHeaders: true, legacyHeaders: false, message: { error: "Demasiadas solicitudes" } }));
app.use("/api", imageRouter);
app.use("/api", infoRouter);
app.use("/api", ttsRouter);
app.use("/api", assetRouter);
app.use("/api", arisRouter);
app.use("/api/", rateLimit({ skip: (req) => req.originalUrl.startsWith("/api/image") || req.originalUrl.startsWith("/api/info") || req.originalUrl.startsWith("/api/tts") || req.originalUrl.startsWith("/api/assets") || req.originalUrl.startsWith("/api/aris-help") || req.originalUrl.startsWith("/api/health"), windowMs: 60_000, limit: 10, standardHeaders: true, legacyHeaders: false, message: { error: "Demasiadas solicitudes, intenta en un minuto" } }));

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

// Pedidos idénticos simultáneos comparten UNA generación (y un solo cupo diario) en lugar de pagarla varias veces.
const inFlight = new Map<string, Promise<Museum>>();

async function respondWithMuseum(res: express.Response, key: string, generate: () => Promise<Museum>) {
  const started = Date.now();
  try {
    const cached = await getCached(key);
    if (cached) {
      res.json(cached);
      return;
    }
    let pending = inFlight.get(key);
    if (!pending) {
      if (!takeDailySlot()) {
        res.status(429).json({ error: "Se alcanzó el tope diario de generaciones", fallback: "placeholder" });
        return;
      }
      pending = generate()
        .then(async (m) => {
          await setCached(key, m);
          return m;
        })
        .finally(() => inFlight.delete(key));
      inFlight.set(key, pending);
    }
    res.json(await pending);
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

/**
 * Valida y limpia el cuerpo de una generación (tema, apuntes o flujo completo) y calcula su clave de caché.
 * Lo comparten `/api/generate-museum` y `/api/generate-museum/stream`: mismo pedido, misma clave, misma caché.
 */
function prepareGeneration(body: unknown): { input: GenerateInput | GenerateMuseumRequest; key: string } | null {
  const legacy = RequestSchema.safeParse(body);
  if (legacy.success) {
    const cleanInput: GenerateInput =
      "notes" in legacy.data
        ? { notes: sanitizeUntrustedText(legacy.data.notes, LIMITS.maxNotesChars) }
        : { topic: sanitizeUntrustedText(legacy.data.topic, 200) };
    return { input: cleanInput, key: cacheKey(cleanInput) };
  }
  const flow = GenerateMuseumRequestSchema.safeParse(body);
  if (!flow.success) return null;
  const cleanFlow = {
    ...flow.data,
    prompt: sanitizeUntrustedText(flow.data.prompt, LIMITS.maxNotesChars),
    sources: flow.data.sources.map((s) => ({
      ...s,
      text: sanitizeUntrustedText(s.text, LIMITS.maxNotesChars),
    })),
  };
  // La clave incluye modo, fuentes e imágenes, no solo el texto.
  // La clave ignora mayúsculas y espacios del pedido: "Roma  " y "roma" son el mismo museo (y el mismo gasto).
  const keyed = { ...cleanFlow, prompt: cleanFlow.prompt.replace(/\s+/g, " ").trim().toLowerCase() };
  return { input: cleanFlow, key: "flow:" + sha256(JSON.stringify(keyed)) };
}

const BAD_GENERATE_REQUEST = `Envía "topic" (1-200 caracteres) o "notes" (hasta ${LIMITS.maxNotesChars} caracteres)`;

app.post("/api/generate-museum", async (req, res) => {
  const prepared = prepareGeneration(req.body);
  if (!prepared) {
    res.status(400).json({ error: BAD_GENERATE_REQUEST });
    return;
  }
  const { input, key } = prepared;
  await respondWithMuseum(res, key, () => (isFlowInput(input) ? generateFlowMuseum(input) : generateMuseum(input)));
});

// Fuentes que superan LIMITS.maxNotesChars: un modelo barato las resume en un temario base.
app.post("/api/digest-sources", async (req, res) => {
  const parsed = DigestSourcesRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: `Envía "sources" (1-10 fuentes, hasta ${LIMITS.maxDigestInputChars} caracteres en total)` });
    return;
  }
  const sources = parsed.data.sources.map((s) => ({
    ...s,
    name: sanitizeUntrustedText(s.name, 120),
    text: sanitizeUntrustedText(s.text, LIMITS.maxDigestInputChars),
  }));
  // La clave no guarda las fuentes en claro.
  const key = "digest:" + sha256(JSON.stringify(sources));
  const started = Date.now();
  try {
    const cached = getCachedDigest(key);
    if (cached !== undefined) {
      res.json({ digest: cached });
      return;
    }
    if (!takeDailySlot()) {
      res.status(429).json({ error: "Se alcanzó el tope diario de generaciones" });
      return;
    }
    const { digest } = await digestSources(sources);
    setCachedDigest(key, digest);
    res.json({ digest });
  } catch (err) {
    if (err instanceof AiUnavailableError) {
      res.status(503).json({ error: "IA no configurada" });
      return;
    }
    // Solo el tipo de error y la latencia: nunca las fuentes ni la respuesta del modelo.
    console.error(`digest-sources falló tras ${Date.now() - started} ms: ${(err as Error).name}`);
    res.status(502).json({ error: "No se pudo resumir las fuentes" });
  }
});

// Pausa entre salas al reproducir un museo en caché por el stream (da el efecto de "se va construyendo").
const replayDelayMs = () => {
  const n = Number(process.env.STREAM_REPLAY_DELAY_MS);
  return Number.isFinite(n) && process.env.STREAM_REPLAY_DELAY_MS !== undefined && process.env.STREAM_REPLAY_DELAY_MS !== "" ? n : 450;
};

/**
 * Igual que /api/generate-museum (mismo cuerpo, validación, caché, tope diario y límite de solicitudes), pero
 * responde en NDJSON (`MuseumStreamEvent`, un evento por línea y vaciado en cada uno) para que el cliente
 * construya el palacio sala a sala mientras la IA escribe. Acepta tema, apuntes y el flujo completo (modo,
 * fuentes e imágenes).
 */
app.post("/api/generate-museum/stream", async (req, res) => {
  const prepared = prepareGeneration(req.body);
  if (!prepared) {
    res.status(400).json({ error: BAD_GENERATE_REQUEST });
    return;
  }
  const { input, key } = prepared;
  const controller = new AbortController();
  const hasKey = !!process.env.ANTHROPIC_API_KEY;
  const delayMs = replayDelayMs();

  let events: AsyncGenerator<MuseumStreamEvent>;
  let cacheResult = false;
  const cached = await getCached(key);
  if (cached) {
    events = replayMuseum(cached, { signal: controller.signal, delayMs });
  } else if (!hasKey && (isFlowInput(input) || "notes" in input)) {
    // Con apuntes o archivos un mock no sirve: el cliente cae a su parser local.
    res.status(503).json({ error: "IA no configurada" });
    return;
  } else if (!takeDailySlot()) {
    res.status(429).json({ error: "Se alcanzó el tope diario de generaciones", fallback: "placeholder" });
    return;
  } else if (!hasKey) {
    console.warn("ANTHROPIC_API_KEY no definida: devolviendo mus3o mock");
    events = replayMuseum(enrichMuseum({ ...sampleMuseum, title: (input as { topic: string }).topic }), { signal: controller.signal, delayMs });
  } else if (isFlowInput(input) && !flowStreamable()) {
    // FLOW_FORMAT=json no se puede leer por partes: se genera entero y se reproduce sala a sala.
    cacheResult = true;
    events = generateThenReplay(() => generateFlowMuseum(input), { signal: controller.signal, delayMs });
  } else {
    cacheResult = true;
    events = streamNewMuseum(input as StreamInput, { streamText: currentTextStreamer(), signal: controller.signal });
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
