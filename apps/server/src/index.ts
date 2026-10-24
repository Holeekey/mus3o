import "dotenv/config";
import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { createHash } from "node:crypto";
import { LIMITS } from "@mus3o/shared";
import { AiUnavailableError, generateMuseum, type GenerateInput } from "./claude";
import { getCached, setCached } from "./cache";

const app = express();
const PORT = Number(process.env.PORT) || 3001;
const WEB_ORIGIN = process.env.WEB_ORIGIN || "http://localhost:5173";

app.use(cors({ origin: WEB_ORIGIN }));
// Los apuntes pueden ocupar hasta LIMITS.maxNotesChars caracteres (UTF-8: hasta ~4 bytes c/u).
app.use(express.json({ limit: "100kb" }));
app.use("/api/", rateLimit({ windowMs: 60_000, limit: 10, standardHeaders: true, legacyHeaders: false, message: { error: "Demasiadas solicitudes, intenta en un minuto" } }));

const RequestSchema = z.union([
  z.object({ topic: z.string().trim().min(1).max(200) }).strict(),
  z.object({ notes: z.string().trim().min(1).max(LIMITS.maxNotesChars) }).strict(),
]);

// La clave de caché no guarda los apuntes en claro.
const cacheKey = (input: GenerateInput) =>
  "notes" in input ? "notes:" + createHash("sha256").update(input.notes).digest("hex") : input.topic;

app.post("/api/generate-museum", async (req, res) => {
  const parsed = RequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: `Envía "topic" (1-200 caracteres) o "notes" (hasta ${LIMITS.maxNotesChars} caracteres)` });
    return;
  }
  const input = parsed.data;
  const key = cacheKey(input);
  const started = Date.now();
  try {
    const cached = getCached(key);
    if (cached) {
      res.json(cached);
      return;
    }
    const museum = await generateMuseum(input);
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
});

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  res.status(400).json({ error: "Solicitud inválida" });
});

app.listen(PORT, () => console.log(`server escuchando en http://localhost:${PORT}`));
