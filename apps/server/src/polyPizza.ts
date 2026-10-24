import type { DynamicAsset, Museum, Piece } from "@mus3o/shared";
import { ensureAsset } from "./assetStore";

/**
 * Cliente de Poly Pizza (modelos low-poly CC0 / CC-BY). Sin POLY_PIZZA_API_KEY queda desactivado
 * y el cliente dibuja el glifo procedural de siempre. La clave vive solo aquí.
 */
const API = "https://api.poly.pizza/v1.1";
export const POLY_TIMEOUT_MS = 2500;
/** Tope de piezas que se hidratan por museo (cada una es una búsqueda + una descarga). */
const MAX_HYDRATED = 24;

export type PolyResult = {
  ID?: string;
  Title?: string;
  Download?: string;
  Licence?: string;
  Creator?: { Username?: string };
};

export type PolyCandidate = { id: string; title: string; author: string; license: "CC0" | "CC-BY"; downloadUrl: string };

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

export const polyEnabled = () => Boolean(process.env.POLY_PIZZA_API_KEY);

function licenseOf(raw: string | undefined): "CC0" | "CC-BY" | null {
  const l = (raw ?? "").toLowerCase();
  if (l.includes("cc0") || l.includes("public domain")) return "CC0";
  // CC-BY puro: se excluyen variantes NC/ND/SA que no podemos cumplir con un simple crédito.
  if (/^cc[- ]by([- ]\d|$|\s)/.test(l) && !/-(nc|nd|sa)/.test(l)) return "CC-BY";
  return null;
}

/** Elige el mejor resultado: CC0 primero y, si no hay, CC-BY. Descarta todo lo demás. */
export function pickCandidate(results: PolyResult[]): PolyCandidate | null {
  const usable: PolyCandidate[] = [];
  for (const r of results) {
    const license = licenseOf(r.Licence);
    if (!license || !r.ID || !ID_RE.test(r.ID) || !r.Download) continue;
    usable.push({ id: r.ID, title: (r.Title ?? "").slice(0, 120), author: (r.Creator?.Username ?? "").slice(0, 120), license, downloadUrl: r.Download });
  }
  return usable.find((c) => c.license === "CC0") ?? usable[0] ?? null;
}

export async function searchPoly(keyword: string, signal: AbortSignal): Promise<PolyCandidate | null> {
  const res = await fetch(`${API}/search/${encodeURIComponent(keyword)}?Limit=12`, {
    headers: { "x-auth-token": process.env.POLY_PIZZA_API_KEY as string, accept: "application/json" },
    signal,
  });
  if (!res.ok) {
    console.error(`poly.pizza búsqueda falló: HTTP ${res.status}`);
    return null;
  }
  const data = (await res.json()) as { results?: PolyResult[] };
  return pickCandidate(Array.isArray(data.results) ? data.results : []);
}

const resolved = new Map<string, DynamicAsset | null>();

/** Busca y descarga el modelo de una palabra clave. Devuelve null ante cualquier fallo o timeout. */
export async function resolveAsset(keyword: string, timeoutMs = POLY_TIMEOUT_MS): Promise<DynamicAsset | null> {
  const key = keyword.toLowerCase();
  if (resolved.has(key)) return resolved.get(key) ?? null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const found = await searchPoly(keyword, ctrl.signal);
    if (!found) {
      resolved.set(key, null);
      return null;
    }
    if (!(await ensureAsset(found.id, found.downloadUrl, ctrl.signal))) return null;
    const asset: DynamicAsset = {
      assetId: found.id,
      url: `/api/assets/${found.id}.glb`,
      title: found.title,
      author: found.author,
      license: found.license,
      sourceUrl: `https://poly.pizza/m/${found.id}`,
    };
    resolved.set(key, asset);
    return asset;
  } catch (err) {
    // Los fallos transitorios (timeout, red) no se recuerdan: la próxima generación reintenta.
    console.error(`poly.pizza falló: ${(err as Error).name}`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Post-hidratación en paralelo: una pieza sin modelo (o con fallo) conserva su glifo procedural. */
export async function hydrateMuseumAssets(museum: Museum, resolve: (k: string) => Promise<DynamicAsset | null> = resolveAsset): Promise<Museum> {
  if (!polyEnabled() && resolve === resolveAsset) return museum;
  const targets: Piece[] = [];
  for (const room of museum.rooms) {
    for (const piece of room.pieces) {
      if (piece.searchKeyword && targets.length < MAX_HYDRATED) targets.push(piece);
    }
  }
  if (targets.length === 0) return museum;
  const settled = await Promise.allSettled(targets.map((p) => resolve(p.searchKeyword as string)));
  const byId = new Map<string, DynamicAsset>();
  settled.forEach((r, i) => {
    if (r.status === "fulfilled" && r.value) byId.set(targets[i].id, r.value);
  });
  if (byId.size === 0) return museum;
  return {
    ...museum,
    rooms: museum.rooms.map((room) => ({
      ...room,
      pieces: room.pieces.map((p) => (byId.has(p.id) ? { ...p, dynamicAsset: byId.get(p.id) } : p)),
    })),
  };
}
