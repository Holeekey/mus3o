import "dotenv/config";
import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { generateMuseum } from "./claude";
import { getCached, setCached } from "./cache";

const app = express();
const PORT = Number(process.env.PORT) || 3001;
const WEB_ORIGIN = process.env.WEB_ORIGIN || "http://localhost:5173";

app.use(cors({ origin: WEB_ORIGIN }));
app.use(express.json({ limit: "10kb" }));
app.use("/api/", rateLimit({ windowMs: 60_000, limit: 10, standardHeaders: true, legacyHeaders: false, message: { error: "Demasiadas solicitudes, intenta en un minuto" } }));

const RequestSchema = z.object({ topic: z.string().trim().min(1).max(200) });

app.post("/api/generate-museum", async (req, res) => {
  const parsed = RequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "topic es requerido (1-200 caracteres)" });
    return;
  }
  const { topic } = parsed.data;
  try {
    const cached = getCached(topic);
    if (cached) {
      res.json(cached);
      return;
    }
    const museum = await generateMuseum(topic);
    setCached(topic, museum);
    res.json(museum);
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: "No se pudo generar el mus3o" });
  }
});

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  res.status(400).json({ error: "Solicitud inválida" });
});

app.listen(PORT, () => console.log(`server escuchando en http://localhost:${PORT}`));
