import express from "express";
import rateLimit from "express-rate-limit";
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
