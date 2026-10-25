import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import { PartSchema, type DynamicAsset, type Museum, type Piece } from "@mus3o/shared";
import { z } from "zod";
import { isGlb, isValidAssetId, MAX_ASSET_BYTES } from "./assetStore";

/**
 * Biblioteca propia de modelos: lo que tú creas (.glb o recetas de partes) y lo que la IA o el respaldo determinista
 * dibujaron y tú aprobaste. Se consulta ANTES que Poly Pizza y que cualquier respaldo, así cada museo nuevo reutiliza
 * lo mejor que ya existe por palabra clave.
 *
 * Ciclo: lo generado entra como "pending" → tú lo apruebas, corriges o rechazas → lo aprobado gana prioridad en las
 * siguientes generaciones. Lo rechazado queda registrado para no volver a proponerse.
 */
const here = dirname(fileURLToPath(import.meta.url));
export const libraryDir = () => (process.env.LIBRARY_DIR ? resolve(process.env.LIBRARY_DIR) : resolve(here, "../seed/library"));
const indexFile = () => join(libraryDir(), "index.json");
const glbFile = (id: string) => join(libraryDir(), `${id}.glb`);

export type LibraryKind = "recipe" | "glb";
export type LibraryOrigin = "manual" | "ai" | "deterministic";
export type LibraryStatus = "pending" | "approved" | "rejected";
type Part = z.infer<typeof PartSchema>;

export type LibraryEntry = {
  id: string;
  kind: LibraryKind;
  keywords: string[];
  title: string;
  /** Solo en recetas: el modelo como partes procedurales. Los .glb viven en `<id>.glb`. */
  parts?: Part[];
  origin: LibraryOrigin;
  status: LibraryStatus;
  uses: number;
  createdAt: string;
  updatedAt: string;
};

const PartsSchema = z.array(PartSchema).min(1).max(40);
const MAX_KEYWORDS = 12;
/** Tope de entradas sin revisar: cuando se pasa, se descartan las más antiguas (nunca las aprobadas ni las rechazadas). */
const MAX_PENDING = 400;

/** "Sword " → "sword": minúsculas, solo letras/dígitos/guion, espacios colapsados. "" si no queda nada. */
export function normalizeKeyword(raw: string | undefined): string {
  return (raw ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9 -]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 40);
}

const cleanKeywords = (list: string[]) => [...new Set(list.map(normalizeKeyword).filter(Boolean))].slice(0, MAX_KEYWORDS);

// --- Persistencia (un solo index.json, escritura atómica y en cola) ---

let entries: Map<string, LibraryEntry> | null = null;
let saving: Promise<void> = Promise.resolve();

async function load(): Promise<Map<string, LibraryEntry>> {
  if (entries) return entries;
  entries = new Map();
  try {
    const list = JSON.parse(await readFile(indexFile(), "utf8")) as LibraryEntry[];
    for (const e of list) if (isValidAssetId(e.id) && (e.kind === "glb" || PartsSchema.safeParse(e.parts).success)) entries.set(e.id, e);
  } catch {
    // Sin archivo (o dañado): biblioteca vacía.
  }
  return entries;
}

async function save(map: Map<string, LibraryEntry>): Promise<void> {
  await mkdir(libraryDir(), { recursive: true });
  const tmp = `${indexFile()}.${process.pid}.${randomBytes(4).toString("hex")}.tmp`;
  try {
    await writeFile(tmp, JSON.stringify([...map.values()], null, 2));
    await rename(tmp, indexFile());
  } catch (err) {
    await unlink(tmp).catch(() => {});
    throw err;
  }
}

const queueSave = (map: Map<string, LibraryEntry>) => {
  saving = saving.catch(() => {}).then(() => save(map));
  return saving;
};

/** Solo para pruebas: olvida el estado en memoria para releer desde disco. */
export const resetLibraryState = () => {
  entries = null;
  saving = Promise.resolve();
};

const newId = () => `lib-${Date.now().toString(36)}${randomBytes(3).toString("hex")}`;

// --- Búsqueda ---

const rank = (e: LibraryEntry, exact: boolean) =>
  (exact ? 1000 : 0) + (e.kind === "glb" ? 100 : 0) + (e.origin === "manual" ? 50 : e.origin === "ai" ? 10 : 0) + Math.min(e.uses, 9);

/**
 * La mejor entrada aprobada para una palabra clave: coincidencia exacta con alguna de sus palabras clave y, si no,
 * con la última palabra ("ancient sword" → "sword"). A igualdad: .glb antes que receta, lo tuyo antes que lo generado,
 * lo más usado antes.
 */
export async function findInLibrary(keyword: string | undefined): Promise<LibraryEntry | null> {
  const key = normalizeKeyword(keyword);
  if (!key) return null;
  const last = key.split(" ").pop() as string;
  let best: { e: LibraryEntry; score: number } | null = null;
  for (const e of (await load()).values()) {
    if (e.status !== "approved") continue;
    const exact = e.keywords.includes(key);
    if (!exact && !e.keywords.includes(last)) continue;
    const score = rank(e, exact);
    if (!best || score > best.score || (score === best.score && e.updatedAt > best.e.updatedAt)) best = { e, score };
  }
  return best?.e ?? null;
}

const sourceUrl = () => process.env.LIBRARY_SOURCE_URL || "https://github.com/platanus-hack/platanus-hack-26-ve-team-5";

const toAsset = (e: LibraryEntry): DynamicAsset => ({
  assetId: e.id,
  url: `/api/assets/${e.id}.glb`,
  title: e.title.slice(0, 120),
  author: "Biblioteca propia",
  license: "own",
  sourceUrl: sourceUrl(),
});

/**
 * Pone en cada pieza sin modelo la mejor entrada aprobada de la biblioteca. Devuelve también los ids de pieza resueltos
 * (para que ni Poly Pizza ni los respaldos las sobrescriban).
 */
export async function applyLibrary(museum: Museum): Promise<{ museum: Museum; resolved: Set<string> }> {
  const resolved = new Set<string>();
  const used = new Set<string>();
  const found = new Map<string, LibraryEntry>();
  for (const room of museum.rooms) {
    for (const p of room.pieces) {
      if (p.dynamicAsset || !p.searchKeyword || (p.model && p.model.type !== "glyph")) continue;
      const hit = await findInLibrary(p.searchKeyword);
      if (hit) {
        found.set(p.id, hit);
        resolved.add(p.id);
        used.add(hit.id);
      }
    }
  }
  if (found.size === 0) return { museum, resolved };
  const map = await load();
  for (const id of used) {
    const e = map.get(id);
    if (e) e.uses += [...found.values()].filter((f) => f.id === id).length;
  }
  void queueSave(map).catch((err) => console.error(`biblioteca: no se pudo guardar el uso (${(err as Error).name})`));
  const withLibrary = (p: Piece): Piece => {
    const hit = found.get(p.id);
    if (!hit) return p;
    return hit.kind === "glb" ? { ...p, dynamicAsset: toAsset(hit) } : { ...p, model: { type: "procedural", parts: hit.parts as Part[] } };
  };
  return { museum: { ...museum, rooms: museum.rooms.map((r) => ({ ...r, pieces: r.pieces.map(withLibrary) })) }, resolved };
}

// --- Registro de lo generado (cola de revisión) ---

/**
 * Registra como "pending" lo que la IA o el respaldo determinista dibujaron, una entrada por palabra clave y origen:
 * si ya existe (aprobada, pendiente o rechazada) no se duplica. Un fallo al escribir nunca debe romper la generación.
 */
export async function recordGenerated(items: { keyword: string | undefined; title: string; parts: Part[]; origin: "ai" | "deterministic" }[]): Promise<void> {
  try {
    const map = await load();
    let changed = false;
    for (const it of items) {
      const key = normalizeKeyword(it.keyword);
      if (!key || !PartsSchema.safeParse(it.parts).success) continue;
      const dup = [...map.values()].find((e) => e.kind === "recipe" && e.origin === it.origin && e.keywords.includes(key));
      if (dup) continue;
      const now = new Date().toISOString();
      const id = newId();
      map.set(id, { id, kind: "recipe", keywords: [key], title: it.title.slice(0, 120), parts: it.parts, origin: it.origin, status: "pending", uses: 0, createdAt: now, updatedAt: now });
      changed = true;
    }
    if (!changed) return;
    const pending = [...map.values()].filter((e) => e.status === "pending").sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    for (const old of pending.slice(0, Math.max(0, pending.length - MAX_PENDING))) map.delete(old.id);
    await queueSave(map);
  } catch (err) {
    console.error(`biblioteca: no se pudo registrar lo generado (${(err as Error).name})`);
  }
}

// --- Curaduría (rutas de depuración y script) ---

export async function listLibrary(status?: LibraryStatus): Promise<LibraryEntry[]> {
  const all = [...(await load()).values()];
  return (status ? all.filter((e) => e.status === status) : all).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getEntry(id: string): Promise<LibraryEntry | null> {
  return (await load()).get(id) ?? null;
}

export async function addRecipe(input: { keywords: string[]; title: string; parts: unknown }): Promise<LibraryEntry> {
  const parts = PartsSchema.parse(input.parts);
  const keywords = cleanKeywords(input.keywords);
  if (keywords.length === 0) throw new Error("Falta al menos una palabra clave");
  const map = await load();
  const now = new Date().toISOString();
  const entry: LibraryEntry = { id: newId(), kind: "recipe", keywords, title: input.title.trim().slice(0, 120) || keywords[0], parts, origin: "manual", status: "approved", uses: 0, createdAt: now, updatedAt: now };
  map.set(entry.id, entry);
  await queueSave(map);
  return entry;
}

/** Alta en lote de recetas ya revisadas (p. ej. dibujadas con un modelo fuerte): entran aprobadas con el origen indicado. */
export async function importRecipes(recipes: Record<string, unknown>, origin: LibraryOrigin = "ai"): Promise<{ added: string[]; skipped: string[] }> {
  const map = await load();
  const added: string[] = [];
  const skipped: string[] = [];
  const now = new Date().toISOString();
  for (const [raw, parts] of Object.entries(recipes)) {
    const key = normalizeKeyword(raw);
    const ok = PartsSchema.safeParse(parts);
    // Un mismo origen y palabra clave no se duplica (ni siquiera si estaba pendiente o rechazada).
    if (!key || !ok.success || [...map.values()].some((e) => e.kind === "recipe" && e.origin === origin && e.keywords.includes(key) && e.status !== "pending")) {
      skipped.push(raw);
      continue;
    }
    // Una pendiente del mismo origen se promueve en vez de duplicarse.
    const pending = [...map.values()].find((e) => e.kind === "recipe" && e.origin === origin && e.keywords.includes(key) && e.status === "pending");
    if (pending) {
      pending.parts = ok.data;
      pending.status = "approved";
      pending.updatedAt = now;
    } else {
      const id = newId();
      map.set(id, { id, kind: "recipe", keywords: [key], title: key, parts: ok.data, origin, status: "approved", uses: 0, createdAt: now, updatedAt: now });
    }
    added.push(key);
  }
  if (added.length > 0) await queueSave(map);
  return { added, skipped };
}

export async function addGlb(input: { keywords: string[]; title: string; data: Buffer }): Promise<LibraryEntry> {
  if (!isGlb(input.data)) throw new Error("El archivo no es un .glb válido");
  if (input.data.length > MAX_ASSET_BYTES) throw new Error(`El .glb supera ${MAX_ASSET_BYTES / 1024 / 1024} MB`);
  const keywords = cleanKeywords(input.keywords);
  if (keywords.length === 0) throw new Error("Falta al menos una palabra clave");
  const map = await load();
  const now = new Date().toISOString();
  const entry: LibraryEntry = { id: newId(), kind: "glb", keywords, title: input.title.trim().slice(0, 120) || keywords[0], origin: "manual", status: "approved", uses: 0, createdAt: now, updatedAt: now };
  await mkdir(libraryDir(), { recursive: true });
  await writeFile(glbFile(entry.id), input.data);
  map.set(entry.id, entry);
  await queueSave(map);
  return entry;
}

export async function updateEntry(id: string, patch: { keywords?: string[]; title?: string; parts?: unknown }): Promise<LibraryEntry | null> {
  const map = await load();
  const e = map.get(id);
  if (!e) return null;
  if (patch.keywords) {
    const keywords = cleanKeywords(patch.keywords);
    if (keywords.length === 0) throw new Error("Falta al menos una palabra clave");
    e.keywords = keywords;
  }
  if (patch.title !== undefined) e.title = patch.title.trim().slice(0, 120) || e.keywords[0];
  if (patch.parts !== undefined) {
    if (e.kind !== "recipe") throw new Error("Solo las recetas tienen partes");
    e.parts = PartsSchema.parse(patch.parts);
    // Corregida a mano: pasa a ser tuya y queda aprobada.
    e.origin = "manual";
    e.status = "approved";
  }
  e.updatedAt = new Date().toISOString();
  await queueSave(map);
  return e;
}

export async function setLibraryStatus(id: string, status: LibraryStatus): Promise<LibraryEntry | null> {
  const map = await load();
  const e = map.get(id);
  if (!e) return null;
  e.status = status;
  e.updatedAt = new Date().toISOString();
  await queueSave(map);
  return e;
}

export async function removeEntry(id: string): Promise<boolean> {
  const map = await load();
  const e = map.get(id);
  if (!e) return false;
  map.delete(id);
  if (e.kind === "glb") await unlink(glbFile(id)).catch(() => {});
  await queueSave(map);
  return true;
}

/** El .glb de una entrada aprobada (se sirve por `/api/assets/lib-….glb`). */
export async function readLibraryGlb(id: string): Promise<Buffer | null> {
  if (!id.startsWith("lib-") || !isValidAssetId(id)) return null;
  const e = (await load()).get(id);
  if (!e || e.kind !== "glb" || e.status === "rejected") return null;
  try {
    return await readFile(glbFile(id));
  } catch {
    return null;
  }
}
