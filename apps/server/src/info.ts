import express from "express";
import type { Router } from "express";
import type { WikiInfo } from "@mus3o/shared";

import { UpstreamError, genericKind, getJson, normalize, searchTitles, words } from "./images";
import { readCacheInfo, readSeedInfo, writeCacheInfo } from "./imageStore";

/**
 * Información ampliada de un concepto: el resumen de su artículo de Wikipedia (texto recuperado, nunca generado).
 * Usa el mismo cliente cortés, la misma desambiguación (título exacto → búsqueda con contexto) y las mismas
 * cachés (memoria → semilla → disco) que las imágenes. Los "sin artículo" se guardan; los errores transitorios no.
 */

const MAX_CHARS = 700;
const MIN_CUT = 120;

/** Quita etiquetas HTML y espacios sobrantes: la salida es siempre texto plano. */
export function plainText(raw: unknown): string {
  return String(raw ?? "")
    .replace(/<[^>]*>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

const NOT_AN_END = /^(?:[A-ZÁÉÍÓÚÑ]|aprox|etc|fig|vol|núm|dr|sr|sra|ca|c|s|a|d)$/i;

/** Recorta en el último fin de oración antes de `max`; si no hay uno razonable, en una palabra con "…". */
export function capAtSentence(text: string, max = MAX_CHARS): string {
  if (text.length <= max) return text;
  const head = text.slice(0, max);
  let cut = -1;
  const re = /[.!?](?=\s)/g;
  for (let m = re.exec(head); m; m = re.exec(head)) {
    // "J. A. Páez" o "s. XIX" no terminan una oración.
    const before = head.slice(0, m.index).split(/\s+/).pop() ?? "";
    if (NOT_AN_END.test(before)) continue;
    cut = m.index + 1;
  }
  if (cut >= MIN_CUT) return head.slice(0, cut).trim();
  const word = head.lastIndexOf(" ");
  return `${head.slice(0, word > MIN_CUT ? word : max).trim().replace(/[,;:]$/, "")}…`;
}

function toInfo(summary: any, lang: string): WikiInfo | null {
  if (!summary || summary.type === "disambiguation") return null;
  const extract = capAtSentence(plainText(summary.extract));
  const title = plainText(summary.title).slice(0, 120);
  if (!extract || !title) return null;
  let url = `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title.replace(/\s+/g, "_"))}`;
  const page = summary.content_urls?.desktop?.page;
  if (typeof page === "string") {
    try {
      const u = new URL(page);
      if (u.protocol === "https:" && /(^|\.)wikipedia\.org$/.test(u.hostname)) url = u.toString();
    } catch {
      // se usa la URL derivada del título
    }
  }
  return { title, extract, url, license: "CC BY-SA 4.0", source: "Wikipedia" };
}

async function summaryOf(title: string, lang: string): Promise<WikiInfo | null> {
  const slug = encodeURIComponent(title.trim().replace(/\s+/g, "_"));
  return toInfo(await getJson(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${slug}`), lang);
}

async function retrieve(wiki: string, context: string, lang: string): Promise<WikiInfo | null> {
  const generic = genericKind(wiki);
  if (generic === "strict") return null; // "Fecha", "Consecuencia"...: mejor sin ficha que una ficha cualquiera
  if (generic !== "weak") {
    const exact = await summaryOf(wiki, lang);
    if (exact) return exact;
  }
  if (context || generic === "weak") {
    const own = new Set(words(wiki));
    for (const hit of await searchTitles(wiki, context, lang)) {
      if (generic === "weak" && !words(hit).some((w) => own.has(w))) continue;
      const found = await summaryOf(hit, lang);
      if (found) return found;
    }
  }
  return null;
}

type InfoQuery = { wiki?: string; lang?: string; context?: string };

function parse(q: InfoQuery) {
  const lang = q.lang && /^[a-z]{2}$/.test(q.lang) ? q.lang : "es";
  const wiki = q.wiki?.trim().slice(0, 120) ?? "";
  const context = q.context?.trim().slice(0, 120) ?? "";
  return { lang, wiki, context, key: `${lang}|${normalize(wiki)}|${normalize(context)}` };
}

/** Clave canónica de una consulta (caché, semilla y script de precarga). */
export const infoKey = (q: InfoQuery) => parse(q).key;

const memory = new Map<string, WikiInfo | null>();
const MAX_ENTRIES = 500;
const resolving = new Map<string, Promise<WikiInfo | null>>();

export const clearInfoCaches = () => {
  memory.clear();
  resolving.clear();
};

/** Orden: memoria → semilla (repo) → caché en disco → Wikipedia. Lanza UpstreamError si es transitorio. */
export async function resolveInfo(q: InfoQuery): Promise<WikiInfo | null> {
  const { lang, wiki, context, key } = parse(q);
  if (!wiki) return null;
  if (memory.has(key)) return memory.get(key)!;
  const pending = resolving.get(key);
  if (pending) return pending;
  const task = (async () => {
    let result = await readSeedInfo(key);
    if (result === undefined) result = await readCacheInfo(key);
    if (result === undefined) {
      result = await retrieve(wiki, context, lang);
      await writeCacheInfo(key, result);
    }
    if (memory.size >= MAX_ENTRIES) memory.delete(memory.keys().next().value!);
    memory.set(key, result);
    return result;
  })();
  resolving.set(key, task);
  try {
    return await task;
  } finally {
    resolving.delete(key);
  }
}

export const infoRouter: Router = express.Router();

infoRouter.get("/info", async (req, res) => {
  const str = (v: unknown) => (typeof v === "string" ? v : undefined);
  let info: WikiInfo | null;
  try {
    info = await resolveInfo({ wiki: str(req.query.wiki), lang: str(req.query.lang), context: str(req.query.context) });
  } catch (err) {
    if (!(err instanceof UpstreamError)) throw err;
    res.status(502).json({ error: "Wikipedia no disponible" });
    return;
  }
  if (!info) {
    res.status(404).json({ error: "Sin información" });
    return;
  }
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.json(info);
});
