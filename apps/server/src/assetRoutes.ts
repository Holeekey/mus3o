import express from "express";
import rateLimit from "express-rate-limit";
import { listReview, setStatus, type ReviewStatus } from "./assetReview";
import { downloadUrlOf } from "./assetReview";
import { DownloadBlockedError, ensureAsset, isValidAssetId, MAX_ASSET_BYTES, readAsset } from "./assetStore";
import { markPolyBlocked, polyBlocked } from "./polyPizza";
import { addGlb, addRecipe, listLibrary, readLibraryGlb, removeEntry, setLibraryStatus, updateEntry, type LibraryStatus } from "./library";

export const assetRouter = express.Router();

/**
 * Descarga bajo demanda: el museo asigna el modelo sin bajarlo y el .glb se trae la primera vez que alguien lo pide.
 * Peticiones simultáneas del mismo modelo comparten una descarga y se limitan las descargas a la vez.
 */
const ON_DEMAND_TIMEOUT_MS = 20_000;
const MAX_CONCURRENT_DOWNLOADS = 6;
const inFlight = new Map<string, Promise<Buffer | null>>();
let active = 0;
const waiting: (() => void)[] = [];
const acquire = () => (active < MAX_CONCURRENT_DOWNLOADS ? (active++, Promise.resolve()) : new Promise<void>((r) => waiting.push(r)));
const release = () => {
  const next = waiting.shift();
  if (next) next();
  else active--;
};

async function fetchOnDemand(id: string): Promise<Buffer | null> {
  if (polyBlocked()) return null;
  const running = inFlight.get(id);
  if (running) return running;
  const job = (async () => {
    const url = await downloadUrlOf(id);
    if (!url) return null;
    await acquire();
    try {
      if (polyBlocked()) return null;
      await ensureAsset(id, url, AbortSignal.timeout(ON_DEMAND_TIMEOUT_MS));
      return await readAsset(id);
    } catch (err) {
      if (err instanceof DownloadBlockedError) markPolyBlocked();
      return null;
    } finally {
      release();
    }
  })().finally(() => inFlight.delete(id));
  inFlight.set(id, job);
  return job;
}

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
  const body = m[1].startsWith("lib-") ? await readLibraryGlb(m[1]) : (await readAsset(m[1])) ?? (await fetchOnDemand(m[1]));
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

// Biblioteca propia (curaduría). Mismo candado que la revisión: 404 salvo ENABLE_DEBUG_ROUTES=true.
const library = express.Router();
assetRouter.use("/library", debugOnly, library);

const keywordsOf = (raw: unknown): string[] =>
  Array.isArray(raw) ? raw.map(String) : typeof raw === "string" ? raw.split(",") : [];
const fail = (res: express.Response, err: unknown) => res.status(400).json({ error: err instanceof Error ? err.message.slice(0, 300) : "Solicitud inválida" });

library.get("/", async (req, res) => {
  const status = STATUSES.find((s) => s === req.query.status);
  res.json({ entries: await listLibrary(status) });
});

// Receta de partes: { keywords: string[] | "a,b", title, parts: Part[] }. Entra aprobada y con prioridad.
library.post("/recipe", async (req, res) => {
  try {
    res.status(201).json(await addRecipe({ keywords: keywordsOf(req.body?.keywords), title: String(req.body?.title ?? ""), parts: req.body?.parts }));
  } catch (err) {
    fail(res, err);
  }
});

// .glb propio: cuerpo binario (Content-Type model/gltf-binary u octet-stream) y ?keywords=a,b&title=Nombre.
library.post("/glb", express.raw({ type: ["model/gltf-binary", "application/octet-stream"], limit: MAX_ASSET_BYTES }), async (req, res) => {
  try {
    if (!Buffer.isBuffer(req.body)) throw new Error("Envía el .glb como cuerpo binario (Content-Type: model/gltf-binary)");
    res.status(201).json(await addGlb({ keywords: keywordsOf(req.query.keywords), title: String(req.query.title ?? ""), data: req.body }));
  } catch (err) {
    fail(res, err);
  }
});

library.patch("/:id", async (req, res) => {
  if (!isValidAssetId(req.params.id)) return void res.status(400).json({ error: "Id inválido" });
  try {
    const patch = { keywords: req.body?.keywords === undefined ? undefined : keywordsOf(req.body.keywords), title: req.body?.title === undefined ? undefined : String(req.body.title), parts: req.body?.parts };
    const entry = await updateEntry(req.params.id, patch);
    entry ? res.json(entry) : res.status(404).json({ error: "Entrada no encontrada" });
  } catch (err) {
    fail(res, err);
  }
});

library.post("/:id/:action", async (req, res) => {
  const status = ({ approve: "approved", reject: "rejected", reset: "pending" } as Record<string, LibraryStatus>)[req.params.action];
  if (!status || !isValidAssetId(req.params.id)) return void res.status(400).json({ error: "Acción o id inválido (approve | reject | reset)" });
  const entry = await setLibraryStatus(req.params.id, status);
  entry ? res.json(entry) : res.status(404).json({ error: "Entrada no encontrada" });
});

library.delete("/:id", async (req, res) => {
  if (!isValidAssetId(req.params.id)) return void res.status(400).json({ error: "Id inválido" });
  (await removeEntry(req.params.id)) ? res.status(204).end() : res.status(404).json({ error: "Entrada no encontrada" });
});
