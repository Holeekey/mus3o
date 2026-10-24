import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
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
  license: "CC0" | "CC-BY";
  score: number;
  sourceUrl: string;
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

async function save(map: Map<string, ReviewEntry>) {
  await mkdir(assetDir(), { recursive: true });
  const tmp = `${file()}.tmp`;
  await writeFile(tmp, JSON.stringify([...map.values()], null, 2));
  await rename(tmp, file());
}

/** Solo para pruebas: olvida el estado en memoria para releer desde disco. */
export const resetReviewState = () => {
  entries = null;
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
  await save(map);
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
  await save(map);
  return e;
}
