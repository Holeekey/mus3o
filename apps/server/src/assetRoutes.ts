import express from "express";
import rateLimit from "express-rate-limit";
import { listReview, setStatus, type ReviewStatus } from "./assetReview";
import { isValidAssetId, readAsset } from "./assetStore";

export const assetRouter = express.Router();

assetRouter.use(
  "/assets",
  rateLimit({ windowMs: 60_000, limit: 300, standardHeaders: true, legacyHeaders: false, message: { error: "Demasiadas solicitudes" } }),
);

assetRouter.get("/assets/:file", async (req, res) => {
  const m = /^([A-Za-z0-9_-]{1,64})\.glb$/.exec(req.params.file);
  if (!m || !isValidAssetId(m[1])) {
    res.status(400).json({ error: "Modelo inválido" });
    return;
  }
  const body = await readAsset(m[1]);
  if (!body) {
    res.status(404).json({ error: "Modelo no encontrado" });
    return;
  }
  res.setHeader("Content-Type", "model/gltf-binary");
  res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  res.send(body);
});

// Revisión de modelos traídos. Solo depuración/curaduría: 404 salvo ENABLE_DEBUG_ROUTES=true.
const debugOnly: express.RequestHandler = (_req, res, next) => {
  if (process.env.ENABLE_DEBUG_ROUTES !== "true") {
    res.status(404).json({ error: "No encontrado" });
    return;
  }
  next();
};
const STATUSES = ["pending", "approved", "rejected"] as const;

assetRouter.get("/assets-review", debugOnly, async (req, res) => {
  const status = STATUSES.find((s) => s === req.query.status);
  res.json({ assets: await listReview(status) });
});

assetRouter.post("/assets-review/:id/:action", debugOnly, async (req, res) => {
  const status: ReviewStatus | undefined = { approve: "approved", reject: "rejected", reset: "pending" }[req.params.action] as ReviewStatus | undefined;
  if (!status || !isValidAssetId(req.params.id)) {
    res.status(400).json({ error: "Acción o id inválido (approve | reject | reset)" });
    return;
  }
  const entry = await setStatus(req.params.id, status);
  if (!entry) {
    res.status(404).json({ error: "Modelo no registrado" });
    return;
  }
  res.json(entry);
});
