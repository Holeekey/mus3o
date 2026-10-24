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
  Category?: string;
  Tags?: string[];
  Creator?: { Username?: string };
};

export type PolyCandidate = { id: string; title: string; author: string; license: "CC0" | "CC-BY"; downloadUrl: string; score: number };

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

export const polyEnabled = () => Boolean(process.env.POLY_PIZZA_API_KEY);

function licenseOf(raw: string | undefined): "CC0" | "CC-BY" | null {
  const l = (raw ?? "").toLowerCase();
  if (l.includes("cc0") || l.includes("public domain")) return "CC0";
  // CC-BY puro: se excluyen variantes NC/ND/SA que no podemos cumplir con un simple crédito.
  if (/^cc[- ]by([- ]\d|$|\s)/.test(l) && !/-(nc|nd|sa)/.test(l)) return "CC-BY";
  return null;
}

const tokens = (text: string) =>
  text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    // Singular tosco: "shields" también coincide con "shield".
    .map((t) => (t.length > 3 && t.endsWith("s") ? t.slice(0, -1) : t));

/**
 * Relevancia de un resultado frente a la palabra clave buscada:
 * título igual (6) > título contiene todas las palabras (4) > alguna palabra en el título (2) > en etiquetas/categoría (1).
 */
export function relevance(keyword: string, r: PolyResult): number {
  const want = tokens(keyword);
  if (want.length === 0) return 0;
  const title = tokens(r.Title ?? "");
  const other = new Set(tokens([...(r.Tags ?? []), r.Category ?? ""].join(" ")));
  if (title.length > 0 && want.length === title.length && want.every((w) => title.includes(w))) return 6;
  if (want.every((w) => title.includes(w))) return 4;
  if (want.some((w) => title.includes(w))) return 2;
  if (want.some((w) => other.has(w))) return 1;
  return 0;
}

/**
 * Candidatos ordenados por coincidencia con la palabra clave (luego CC0 antes que CC-BY).
 * Un modelo sin ninguna coincidencia se descarta: mejor el glifo procedural que un objeto equivocado.
 */
export function rankCandidates(keyword: string, results: PolyResult[]): PolyCandidate[] {
  const usable: PolyCandidate[] = [];
  for (const r of results) {
    const license = licenseOf(r.Licence);
    if (!license || !r.ID || !ID_RE.test(r.ID) || !r.Download) continue;
    const score = relevance(keyword, r);
    if (score === 0) continue;
    usable.push({ id: r.ID, title: (r.Title ?? "").slice(0, 120), author: (r.Creator?.Username ?? "").slice(0, 120), license, downloadUrl: r.Download, score });
  }
  return usable.sort((a, b) => b.score - a.score || (a.license === b.license ? 0 : a.license === "CC0" ? -1 : 1));
}

export const pickCandidate = (keyword: string, results: PolyResult[]) => rankCandidates(keyword, results)[0] ?? null;

export async function searchPoly(keyword: string, signal: AbortSignal): Promise<PolyCandidate[]> {
  const res = await fetch(`${API}/search/${encodeURIComponent(keyword)}?Limit=24`, {
    headers: { "x-auth-token": process.env.POLY_PIZZA_API_KEY as string, accept: "application/json" },
    signal,
  });
  if (!res.ok) {
    console.error(`poly.pizza búsqueda falló: HTTP ${res.status}`);
    return [];
  }
  const data = (await res.json()) as { results?: PolyResult[] };
  return rankCandidates(keyword, Array.isArray(data.results) ? data.results : []);
}

/** Palabras clave a probar, de más a menos específica: "ancient shield" → "ancient shield", "shield". */
export function keywordVariants(keyword: string): string[] {
  const words = keyword.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return [...new Set([words.join(" "), words[words.length - 1]].filter(Boolean))];
}

const found = new Map<string, PolyCandidate[]>();

/** Candidatos ordenados para una palabra clave (con respaldo a su última palabra). [] ante fallo o timeout. */
export async function findCandidates(keyword: string, timeoutMs = POLY_TIMEOUT_MS): Promise<PolyCandidate[]> {
  const key = keyword.trim().toLowerCase();
  const hit = found.get(key);
  if (hit) return hit;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    for (const variant of keywordVariants(key)) {
      const list = await searchPoly(variant, ctrl.signal);
      if (list.length > 0) {
        found.set(key, list);
        return list;
      }
    }
    found.set(key, []);
    return [];
  } catch (err) {
    // Los fallos transitorios (timeout, red) no se recuerdan: la próxima generación reintenta.
    console.error(`poly.pizza falló: ${(err as Error).name}`);
    return [];
  } finally {
    clearTimeout(timer);
  }
}

const toAsset = (c: PolyCandidate): DynamicAsset => ({
  assetId: c.id,
  url: `/api/assets/${c.id}.glb`,
  title: c.title,
  author: c.author,
  license: c.license,
  sourceUrl: `https://poly.pizza/m/${c.id}`,
});

/** Descarga el primer candidato que se pueda guardar. null si ninguno sirve o se agota el tiempo. */
export async function downloadFirst(candidates: PolyCandidate[], timeoutMs = POLY_TIMEOUT_MS): Promise<DynamicAsset | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    for (const c of candidates.slice(0, 3)) {
      try {
        if (await ensureAsset(c.id, c.downloadUrl, ctrl.signal)) return toAsset(c);
      } catch (err) {
        console.error(`poly.pizza descarga falló: ${(err as Error).name}`);
        if (ctrl.signal.aborted) break;
      }
    }
    return null;
  } finally {
    clearTimeout(timer);
  }
}

type Finder = (keyword: string) => Promise<PolyCandidate[]>;
type Downloader = (candidates: PolyCandidate[]) => Promise<DynamicAsset | null>;

/**
 * Post-hidratación: cada pieza con `searchKeyword` recibe el modelo que mejor coincide.
 * 1) busca en paralelo; 2) reparte evitando repetir el mismo modelo en el museo (si solo hay uno, se repite);
 * 3) descarga en paralelo. Una pieza sin coincidencia o con fallo conserva su glifo procedural.
 */
export async function hydrateMuseumAssets(
  museum: Museum,
  find: Finder = findCandidates,
  download: Downloader = downloadFirst,
): Promise<Museum> {
  if (!polyEnabled() && find === findCandidates) return museum;
  const targets: Piece[] = [];
  for (const room of museum.rooms) {
    for (const piece of room.pieces) {
      if (piece.searchKeyword && targets.length < MAX_HYDRATED) targets.push(piece);
    }
  }
  if (targets.length === 0) return museum;

  const keywords = [...new Set(targets.map((p) => (p.searchKeyword as string).trim().toLowerCase()))];
  const lists = new Map<string, PolyCandidate[]>();
  (await Promise.allSettled(keywords.map((k) => find(k)))).forEach((r, i) => lists.set(keywords[i], r.status === "fulfilled" ? r.value : []));

  const used = new Set<string>();
  const plan = targets.map((p) => {
    const list = lists.get((p.searchKeyword as string).trim().toLowerCase()) ?? [];
    const ordered = [...list.filter((c) => !used.has(c.id)), ...list.filter((c) => used.has(c.id))];
    if (ordered[0]) used.add(ordered[0].id);
    return ordered;
  });

  const settled = await Promise.allSettled(plan.map((c) => (c.length > 0 ? download(c) : Promise.resolve(null))));
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
