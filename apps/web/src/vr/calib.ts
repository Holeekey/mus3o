// Calibración del visor (modo cardboard): FOV y separación de las lentes.
// Lógica pura (sin DOM salvo `loadStored`/`saveStored`/`clearStored`, que envuelven localStorage en try/catch) para poder probarla.
// La separación se aplica con proyección descentrada (off-axis) en stereo.ts: nunca se remuestrea la imagen.

export type Calib = {
  /** Campo de visión vertical por ojo (grados). */
  fov: number
  /** Separación de las cámaras virtuales (m). */
  ipd: number
  /** Distancia (mm) entre los centros de las dos lentes. null = "auto": cada ojo centrado en su mitad de pantalla (sin desplazamiento). */
  sep: number | null
  /** Milímetros por píxel CSS de la pantalla (para pasar mm a píxeles). */
  mmPerPx: number
}

export const DEFAULT_CALIB: Calib = { fov: 85, ipd: 0.064, sep: null, mmPerPx: 0.1655 }
export const FOV_RANGE = [60, 110] as const
export const SEP_RANGE = [50, 75] as const
export const FOV_STEP = 4
export const SEP_STEP = 1

/** Formato anterior (presets con k1/k2/lens): sus valores dejaban la imagen partida, se descartan. */
export const LEGACY_KEY = 'mus3o.vr.calib'
export const STORAGE_KEY = 'mus3o.vr.calib.v2'

/** Milímetros por píxel CSS: ~0,1655 en un iPhone de 6,1", ~0,159 en Android (1 dp = 1/160"). Se corrige con ?vrmm=. */
export function defaultMmPerPx(ua: string): number {
  return /iPhone|iPad|iPod/i.test(ua) ? 0.1655 : 0.159
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const num = (s: string | null): number | null => {
  if (s === null || s.trim() === '') return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

/** Limita todo a rangos sensatos: un parámetro absurdo no debe dejar la pantalla en negro. */
export function sanitizeCalib(c: Calib): Calib {
  return {
    fov: clamp(c.fov, FOV_RANGE[0], FOV_RANGE[1]),
    ipd: clamp(c.ipd, 0.04, 0.08),
    sep: c.sep === null ? null : clamp(c.sep, SEP_RANGE[0], SEP_RANGE[1]),
    mmPerPx: clamp(c.mmPerPx, 0.05, 0.4),
  }
}

/** Lo guardado (JSON de localStorage). Tolerante a basura. */
export type Stored = { fov?: number; sep?: number }

export function parseStored(raw: string | null): Stored {
  if (!raw) return {}
  try {
    const j = JSON.parse(raw) as Record<string, unknown>
    const out: Stored = {}
    if (typeof j.fov === 'number' && Number.isFinite(j.fov)) out.fov = j.fov
    if (typeof j.sep === 'number' && Number.isFinite(j.sep)) out.sep = j.sep
    return out
  } catch {
    return {}
  }
}

/** Calibración efectiva: valores por defecto → guardado → URL. URL (pruebas): ?vrfov= ?vripd= (m, o mm si >1) ?vrsep= (mm) ?vrmm= (mm por px CSS). */
export function resolveCalib(search: string, stored: Stored, ua = ''): Calib {
  const q = new URLSearchParams(search)
  const base: Calib = { ...DEFAULT_CALIB, mmPerPx: defaultMmPerPx(ua) }
  if (stored.fov !== undefined) base.fov = stored.fov
  if (stored.sep !== undefined) base.sep = stored.sep
  const fov = num(q.get('vrfov'))
  if (fov !== null) base.fov = fov
  const ipd = num(q.get('vripd'))
  if (ipd !== null) base.ipd = ipd > 1 ? ipd / 1000 : ipd
  const sep = num(q.get('vrsep'))
  if (sep !== null) base.sep = sep
  const mm = num(q.get('vrmm'))
  if (mm !== null) base.mmPerPx = mm
  return sanitizeCalib(base)
}

/** Borra el formato anterior. Recibe el almacenamiento para poder probarlo. */
export function dropLegacy(storage: Pick<Storage, 'removeItem'>): void {
  try {
    storage.removeItem(LEGACY_KEY)
  } catch {
    /* almacenamiento bloqueado */
  }
}

export function loadStored(): Stored {
  try {
    dropLegacy(localStorage)
    return parseStored(localStorage.getItem(STORAGE_KEY))
  } catch {
    return {}
  }
}

export function saveStored(s: Stored): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
  } catch {
    /* modo privado o almacenamiento bloqueado: la calibración vale solo esta sesión */
  }
}

export function clearStored(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* sin almacenamiento */
  }
}

/** Estado vivo (se lee cada frame, sin React). */
export const calibState: { calib: Calib } = { calib: resolveCalib('', {}) }

export function reloadCalib(): void {
  calibState.calib = resolveCalib(
    typeof window === 'undefined' ? '' : window.location.search,
    loadStored(),
    typeof navigator === 'undefined' ? '' : navigator.userAgent,
  )
}

/** Guarda valores sueltos (se aplican en vivo). */
export function saveValues(values: Stored): void {
  saveStored({ ...loadStored(), ...values })
  reloadCalib()
}

export function resetCalib(): void {
  clearStored()
  reloadCalib()
}

/** Separación "auto" (mm): la que equivale a centrar cada ojo en su mitad de pantalla (centros a un cuarto del ancho). */
export function autoSepMm(widthPx: number, mmPerPx: number): number {
  return (widthPx / 2) * mmPerPx
}

/**
 * Desplazamiento horizontal del punto principal de cada ojo, en NDC (-1..1 del ancho de su mitad), hacia el centro de la pantalla.
 * El ojo izquierdo usa +shift y el derecho -shift. auto (sep null) = 0. sep menor que la automática → las imágenes se acercan al centro.
 * offsetPx = (centro de la mitad − media separación de lentes) / mmPerPx;  ndc = 2·offsetPx / (ancho de la mitad).
 */
export function eyeShiftNdc(c: Calib, widthPx: number): number {
  if (c.sep === null || widthPx <= 0) return 0
  const halfCenterMm = (widthPx / 4) * c.mmPerPx
  const lensHalfMm = c.sep / 2
  const offsetPx = (halfCenterMm - lensHalfMm) / c.mmPerPx
  return clamp((2 * offsetPx) / (widthPx / 2), -0.6, 0.6)
}

/** Nueva separación (mm) tras pulsar −/+ (dir = -1 | 1). Si estaba en auto parte de la automática redondeada. */
export function stepSep(c: Calib, widthPx: number, dir: -1 | 1): number {
  const cur = c.sep ?? Math.round(autoSepMm(widthPx, c.mmPerPx))
  return clamp(Math.round(cur) + dir * SEP_STEP, SEP_RANGE[0], SEP_RANGE[1])
}

/** Nuevo FOV tras pulsar Zoom −/+ (dir = 1 acerca: menos FOV). */
export function stepFov(c: Calib, dir: -1 | 1): number {
  return clamp(c.fov - dir * FOV_STEP, FOV_RANGE[0], FOV_RANGE[1])
}

export function formatSep(c: Calib, widthPx: number): string {
  return c.sep === null ? `auto (≈ ${Math.round(autoSepMm(widthPx, c.mmPerPx))} mm)` : `${Math.round(c.sep)} mm`
}

export const formatFov = (c: Calib): string => `${Math.round(c.fov)}°`
