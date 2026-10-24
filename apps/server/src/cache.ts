import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { MuseumSchema, type Museum } from "@mus3o/shared";

const MAX_ENTRIES = 100;
const store = new Map<string, Museum>();

const key = (topic: string) => topic.trim().toLowerCase();

// Capa en disco: un reinicio del servidor (Render duerme los planes gratuitos) no debe volver a pagar los museos ya generados.
const museumDir = () => resolve(process.env.MUSEUM_CACHE_DIR || ".cache/museums");
const fileFor = (k: string) => join(museumDir(), `${createHash("sha256").update(k).digest("hex")}.json`);

function readDisk(k: string): Museum | undefined {
  try {
    // Se revalida: un archivo viejo, dañado o de otra versión del esquema se ignora.
    const parsed = MuseumSchema.safeParse(JSON.parse(readFileSync(fileFor(k), "utf8")));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

function writeDisk(k: string, museum: Museum) {
  try {
    mkdirSync(museumDir(), { recursive: true });
    writeFileSync(fileFor(k), JSON.stringify(museum));
  } catch {
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
export function getCached(topic: string) {
  const k = key(topic);
  const hit = store.get(k) ?? readDisk(k);
  if (hit) remember(k, hit);
  return hit;
}

export function setCached(topic: string, museum: Museum) {
  const k = key(topic);
  remember(k, museum);
  writeDisk(k, museum);
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
