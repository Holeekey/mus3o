import express from "express";
import type { Router } from "express";
import type { ResolvedImage } from "@mus3o/shared";

const UA = "mus3o/0.1 (hackathon project)";
const TIMEOUT_MS = 8_000;
const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED_HOSTS = new Set(["upload.wikimedia.org", "thumb.wikimedia.org"]);

const upstream = (url: string) =>
  fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" }, signal: AbortSignal.timeout(TIMEOUT_MS) });

async function getJson(url: string): Promise<any | null> {
  try {
    const res = await upstream(url);
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

const normalize = (s: string) =>
  s.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ");

const stripTags = (html: unknown) =>
  String(html ?? "")
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export function classify(mime: string, name: string, description: string, dateOriginal: string): ResolvedImage["kind"] {
  const text = `${name} ${description}`.toLowerCase();
  if (mime.includes("svg") || /diagram|esquema/.test(text)) return "diagram";
  const year = /\b(\d{4})\b/.exec(dateOriginal)?.[1];
  if ((year && Number(year) < 1930) || /painting|pintura|óleo|oleo/.test(text)) return "painting";
  return "photo";
}

type CommonsPage = { title?: string; index?: number; imageinfo?: any[] };

function toResolved(page: CommonsPage, displayTitle?: string): ResolvedImage | null {
  const info = page.imageinfo?.[0];
  const mime: string = info?.mime ?? "";
  if (!info || !mime.startsWith("image/")) return null;
  const url: string = info.thumburl || info.url;
  if (!url) return null;
  const meta = info.extmetadata ?? {};
  const fileName = (page.title ?? "").replace(/^File:/, "").replace(/\.[a-z0-9]+$/i, "").replace(/_/g, " ");
  const description = stripTags(meta.ImageDescription?.value);
  const date = stripTags(meta.DateTimeOriginal?.value);
  const artist = stripTags(meta.Artist?.value).slice(0, 80);
  const year = /\b(\d{4})\b/.exec(date)?.[1];
  return {
    src: `/api/image/file?u=${encodeURIComponent(url)}`,
    width: info.thumbwidth || info.width || 960,
    height: info.thumbheight || info.height || 640,
    title: (displayTitle || fileName).slice(0, 120),
    artist: [artist, year].filter(Boolean).join(", "),
    license: stripTags(meta.LicenseShortName?.value) || "Ver fuente",
    licenseUrl: meta.LicenseUrl?.value ? String(meta.LicenseUrl.value) : undefined,
    sourceUrl: info.descriptionurl || "https://commons.wikimedia.org",
    kind: classify(mime, fileName, description, date),
  };
}

const COMMONS = "https://commons.wikimedia.org/w/api.php";
const IIPROP = "prop=imageinfo&iiprop=url%7Cextmetadata%7Cmime%7Csize&iiurlwidth=960";

async function fromWikipedia(title: string, lang: string): Promise<ResolvedImage | null> {
  const slug = encodeURIComponent(title.trim().replace(/\s+/g, "_"));
  const summary = await getJson(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${slug}`);
  if (!summary || summary.type === "disambiguation") return null;
  const original = summary.originalimage?.source as string | undefined;
  const thumb = summary.thumbnail?.source as string | undefined;
  if (!original && !thumb) return null;

  const file = original ? decodeURIComponent(original.split("/").pop() ?? "") : "";
  if (file) {
    const data = await getJson(
      `${COMMONS}?action=query&format=json&titles=${encodeURIComponent("File:" + file)}&${IIPROP}`,
    );
    const page = Object.values<CommonsPage>(data?.query?.pages ?? {})[0];
    const resolved = page ? toResolved(page, summary.title) : null;
    if (resolved) return resolved;
  }
  // El archivo no está en Commons (p. ej. subido localmente): usa la miniatura del resumen.
  const url = (thumb ?? original)!;
  const img = summary.thumbnail ?? summary.originalimage;
  return {
    src: `/api/image/file?u=${encodeURIComponent(url)}`,
    width: img.width || 320,
    height: img.height || 240,
    title: String(summary.title ?? title).slice(0, 120),
    artist: "",
    license: "Ver fuente",
    sourceUrl: summary.content_urls?.desktop?.page ?? `https://${lang}.wikipedia.org`,
    kind: "photo",
  };
}

async function fromCommons(query: string): Promise<ResolvedImage | null> {
  const data = await getJson(
    `${COMMONS}?action=query&format=json&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent(query)}&gsrlimit=5&${IIPROP}`,
  );
  const pages = Object.values<CommonsPage>(data?.query?.pages ?? {}).sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  for (const page of pages) {
    const resolved = toResolved(page);
    if (resolved) return resolved;
  }
  return null;
}

const resolveCache = new Map<string, ResolvedImage | null>();
const MAX_RESOLVE_ENTRIES = 500;

export async function resolveImage(q: { wiki?: string; commons?: string; lang?: string }): Promise<ResolvedImage | null> {
  const lang = q.lang && /^[a-z]{2}$/.test(q.lang) ? q.lang : "es";
  const wiki = q.wiki?.trim().slice(0, 120) ?? "";
  const commons = q.commons?.trim().slice(0, 120) ?? "";
  if (!wiki && !commons) return null;
  const key = `${lang}|${normalize(wiki)}|${normalize(commons)}`;
  if (resolveCache.has(key)) return resolveCache.get(key)!;

  const result = (wiki && (await fromWikipedia(wiki, lang))) || (commons && (await fromCommons(commons))) || null;
  if (resolveCache.size >= MAX_RESOLVE_ENTRIES) resolveCache.delete(resolveCache.keys().next().value!);
  resolveCache.set(key, result);
  return result;
}

// LRU de archivos: 60 entradas / 40 MB.
type FileEntry = { body: Buffer; type: string };
const files = new Map<string, FileEntry>();
let fileBytes = 0;
const MAX_FILES = 60;
const MAX_FILE_BYTES = 40 * 1024 * 1024;

export const clearImageCaches = () => {
  resolveCache.clear();
  files.clear();
  fileBytes = 0;
};

function remember(url: string, entry: FileEntry) {
  files.set(url, entry);
  fileBytes += entry.body.length;
  while (files.size > MAX_FILES || fileBytes > MAX_FILE_BYTES) {
    const oldest = files.keys().next().value!;
    fileBytes -= files.get(oldest)!.body.length;
    files.delete(oldest);
  }
}

/** Único control de seguridad del proxy: solo hosts de Wikimedia, sin proxy abierto. */
export function parseAllowedUrl(raw: unknown): URL | null {
  if (typeof raw !== "string" || raw.length > 2048) return null;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && ALLOWED_HOSTS.has(url.hostname) ? url : null;
  } catch {
    return null;
  }
}

async function readCapped(res: Response): Promise<Buffer | null> {
  const declared = Number(res.headers.get("content-length"));
  if (declared > MAX_BYTES || !res.body) return null;
  const chunks: Uint8Array[] = [];
  let total = 0;
  const reader = res.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > MAX_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

export const imageRouter: Router = express.Router();

imageRouter.get("/image", async (req, res) => {
  const str = (v: unknown) => (typeof v === "string" ? v : undefined);
  const image = await resolveImage({ wiki: str(req.query.wiki), commons: str(req.query.commons), lang: str(req.query.lang) });
  if (!image) {
    res.status(404).json({ error: "Sin imagen" });
    return;
  }
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.json(image);
});

imageRouter.get("/image/file", async (req, res) => {
  const url = parseAllowedUrl(req.query.u);
  if (!url) {
    res.status(400).json({ error: "URL no permitida" });
    return;
  }
  const key = url.toString();
  let entry = files.get(key);
  if (entry) {
    files.delete(key); // refresca el orden LRU
    files.set(key, entry);
  } else {
    try {
      const up = await fetch(key, {
        headers: { "User-Agent": UA },
        redirect: "manual",
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      const type = up.headers.get("content-type") ?? "";
      if (!up.ok || !type.startsWith("image/")) {
        res.status(502).json({ error: "Imagen no disponible" });
        return;
      }
      const body = await readCapped(up);
      if (!body) {
        res.status(413).json({ error: "Imagen demasiado grande" });
        return;
      }
      entry = { body, type };
      remember(key, entry);
    } catch {
      res.status(502).json({ error: "Imagen no disponible" });
      return;
    }
  }
  res.setHeader("Content-Type", entry.type);
  res.setHeader("Cache-Control", "public, max-age=86400");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.send(entry.body);
});
