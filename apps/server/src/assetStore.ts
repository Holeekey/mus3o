import { mkdir, readFile, rm, rename, stat, unlink, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { randomBytes } from "node:crypto";

/** Caché en disco de binarios .glb descargados de Poly Pizza. */
export const MAX_ASSET_BYTES = 4 * 1024 * 1024;
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

export const assetDir = () => resolve(process.env.ASSET_CACHE_DIR || ".cache/assets");
const fileFor = (id: string) => join(assetDir(), `${id}.glb`);

export const isValidAssetId = (id: string) => ID_RE.test(id);

/** Solo se descarga de poly.pizza y sus subdominios, por HTTPS (evita SSRF si la API devuelve otra URL). */
export function isAllowedDownload(raw: string): boolean {
  try {
    const u = new URL(raw);
    return u.protocol === "https:" && (u.hostname === "poly.pizza" || u.hostname.endsWith(".poly.pizza"));
  } catch {
    return false;
  }
}

/** Un .glb válido empieza por la firma "glTF". */
export const isGlb = (buf: Buffer) => buf.length >= 12 && buf.subarray(0, 4).toString("latin1") === "glTF";

export async function readAsset(id: string): Promise<Buffer | null> {
  if (!isValidAssetId(id)) return null;
  try {
    return await readFile(fileFor(id));
  } catch {
    return null;
  }
}

async function exists(id: string) {
  try {
    return (await stat(fileFor(id))).isFile();
  } catch {
    return false;
  }
}

/** El host de descargas rechazó la petición (desafío anti-bots, límite de uso): reintentar enseguida solo gasta tiempo. */
export class DownloadBlockedError extends Error {}

/** Garantiza que el .glb esté en disco. false si no se pudo (red, tamaño, formato). */
export async function ensureAsset(id: string, downloadUrl: string, signal?: AbortSignal): Promise<boolean> {
  if (!isValidAssetId(id)) return false;
  if (await exists(id)) return true;
  if (!isAllowedDownload(downloadUrl)) return false;
  const res = await fetch(downloadUrl, { signal, redirect: "error" });
  if (res.status === 403 || res.status === 429 || res.status === 503) throw new DownloadBlockedError(`HTTP ${res.status}`);
  if (!res.ok || !res.body) return false;
  if ((res.headers.get("content-type") ?? "").includes("text/html")) throw new DownloadBlockedError("respuesta HTML");
  const declared = Number(res.headers.get("content-length"));
  if (declared > MAX_ASSET_BYTES) return false;
  // Se lee por trozos para cortar en cuanto se pasa del tope aunque no haya content-length.
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
    total += chunk.length;
    if (total > MAX_ASSET_BYTES) return false;
    chunks.push(Buffer.from(chunk));
  }
  const body = Buffer.concat(chunks);
  if (!isGlb(body)) return false;
  await mkdir(assetDir(), { recursive: true });
  const tmp = `${fileFor(id)}.${randomBytes(4).toString("hex")}.tmp`;
  try {
    await writeFile(tmp, body);
    await rename(tmp, fileFor(id));
  } catch (err) {
    await unlink(tmp).catch(() => {});
    throw err;
  }
  return true;
}

export async function removeAsset(id: string): Promise<void> {
  if (isValidAssetId(id)) await rm(fileFor(id), { force: true });
}
