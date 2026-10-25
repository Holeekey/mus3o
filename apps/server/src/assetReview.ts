import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { assetDir, isValidAssetId, removeAsset } from "./assetStore";

/**
 * Registro de revisión de los modelos traídos: qué palabra clave los pidió, con qué puntaje y su estado.
 * Un modelo rechazado entra en una lista negra persistente: no se vuelve a asignar y su .glb se borra.
 */
export type ReviewStatus = "pending" | "approved" | "rejected";

export type ReviewEntry = {
  assetId: string;
  keywords: string[];
  title: string;
  author: string;
  license: "CC0" | "CC-BY" | "own";
  score: number;
  sourceUrl: string;
  /** URL de descarga registrada al asignar el modelo: la ruta de assets lo baja la primera vez que alguien lo pide. */
  downloadUrl?: string;
  status: ReviewStatus;
  uses: number;
  updatedAt: string;
};

let entries: Map<string, ReviewEntry> | null = null;
const file = () => join(assetDir(), "review.json");

async function load(): Promise<Map<string, ReviewEntry>> {
  if (entries) return entries;
  entries = new Map();
  try {
    const list = JSON.parse(await readFile(file(), "utf8")) as ReviewEntry[];
    for (const e of list) if (isValidAssetId(e.assetId)) entries.set(e.assetId, e);
  } catch {
    // Sin archivo (o dañado): se empieza vacío.
  }
  return entries;
}

let saving: Promise<void> = Promise.resolve();

async function save(map: Map<string, ReviewEntry>): Promise<void> {
  await mkdir(assetDir(), { recursive: true });
  const tmp = `${file()}.${process.pid}.${randomBytes(4).toString("hex")}.tmp`;
  try {
    await writeFile(tmp, JSON.stringify([...map.values()], null, 2));
    await rename(tmp, file());
  } catch (err) {
    await unlink(tmp).catch(() => {});
    throw err;
  }
}

function queueSave(map: Map<string, ReviewEntry>): Promise<void> {
  saving = saving.catch(() => {}).then(() => save(map));
  return saving;
}

/** Solo para pruebas: olvida el estado en memoria para releer desde disco. */
export const resetReviewState = () => {
  entries = null;
  saving = Promise.resolve();
};

export async function isRejected(assetId: string): Promise<boolean> {
  return (await load()).get(assetId)?.status === "rejected";
}

export async function recordAssignment(a: Omit<ReviewEntry, "status" | "uses" | "updatedAt" | "keywords"> & { keyword: string }) {
  const map = await load();
  const prev = map.get(a.assetId);
  const { keyword, ...rest } = a;
  map.set(a.assetId, {
    ...rest,
    keywords: [...new Set([...(prev?.keywords ?? []), keyword])].slice(0, 20),
    status: prev?.status ?? "pending",
    uses: (prev?.uses ?? 0) + 1,
    updatedAt: new Date().toISOString(),
  });
  await queueSave(map);
}

/** URL de descarga registrada para un modelo asignado (undefined si no se conoce). */
export async function downloadUrlOf(assetId: string): Promise<string | undefined> {
  return (await load()).get(assetId)?.downloadUrl;
}

export async function listReview(status?: ReviewStatus): Promise<ReviewEntry[]> {
  const all = [...(await load()).values()];
  return (status ? all.filter((e) => e.status === status) : all).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/** Cambia el estado. Rechazar borra el .glb; aprobar/pendiente lo deja. null si el id no está registrado. */
export async function setStatus(assetId: string, status: ReviewStatus): Promise<ReviewEntry | null> {
  const map = await load();
  const e = map.get(assetId);
  if (!e) return null;
  e.status = status;
  e.updatedAt = new Date().toISOString();
  if (status === "rejected") await removeAsset(assetId);
  await queueSave(map);
  return e;
}
