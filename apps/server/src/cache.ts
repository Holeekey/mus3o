import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { MuseumSchema, type Museum } from "@mus3o/shared";

const MAX_ENTRIES = 100;
const store = new Map<string, Museum>();

const key = (topic: string) => topic.trim().toLowerCase();

// Capa en disco: un reinicio del servidor (Render duerme los planes gratuitos) no debe volver a pagar los museos ya generados.
const museumDir = () => {
  const dir = process.env.MUSEUM_CACHE_DIR;
  return resolve(dir && dir !== "undefined" ? dir : ".cache/museums");
};
const fileFor = (k: string) => join(museumDir(), `${createHash("sha256").update(k).digest("hex")}.json`);

async function readDisk(k: string): Promise<Museum | undefined> {
  try {
    // Se revalida: un archivo viejo, dañado o de otra versión del esquema se ignora.
    const raw = await readFile(fileFor(k), "utf8");
    const parsed = MuseumSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

async function writeDisk(k: string, museum: Museum): Promise<void> {
  const dir = museumDir();
  const target = fileFor(k);
  const tmp = `${target}.${process.pid}.${randomBytes(4).toString("hex")}.tmp`;
  try {
    await mkdir(dir, { recursive: true });
    await writeFile(tmp, JSON.stringify(museum));
    await rename(tmp, target);
  } catch {
    await unlink(tmp).catch(() => {});
    // La caché en disco es opcional (p. ej. disco de solo lectura).
  }
}

function remember(k: string, museum: Museum) {
  store.delete(k);
  if (store.size >= MAX_ENTRIES) {
    const oldest = store.keys().next().value;
    if (oldest !== undefined) store.delete(oldest);
  }
  store.set(k, museum);
}

/** LRU: un acierto vuelve a poner la entrada al final, así se expulsa lo que nadie volvió a pedir. */
export async function getCached(topic: string): Promise<Museum | undefined> {
  const k = key(topic);
  const hit = store.get(k) ?? (await readDisk(k));
  if (hit) remember(k, hit);
  return hit;
}

export async function setCached(topic: string, museum: Museum): Promise<void> {
  const k = key(topic);
  remember(k, museum);
  await writeDisk(k, museum);
}

/** Temarios base de /api/digest-sources: LRU aparte para no mezclar tipos con los museos. */
const digests = new Map<string, string>();

export function getCachedDigest(k: string) {
  const hit = digests.get(k);
  if (hit !== undefined) {
    digests.delete(k);
    digests.set(k, hit);
  }
  return hit;
}

export function setCachedDigest(k: string, digest: string) {
  digests.delete(k);
  if (digests.size >= MAX_ENTRIES) {
    const oldest = digests.keys().next().value;
    if (oldest !== undefined) digests.delete(oldest);
  }
  digests.set(k, digest);
}
