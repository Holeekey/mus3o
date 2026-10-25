// Calibración del visor (modo cardboard): FOV, separación de ojos, distorsión de lente y centro de cada lente.
// Lógica pura (sin DOM salvo `loadCalib`/`saveCalib`, que envuelven localStorage en try/catch) para poder probarla.

export type Calib = {
  /** Campo de visión vertical por ojo (grados). */
  fov: number
  /** Separación de las cámaras virtuales (m). */
  ipd: number
  /** Coeficientes de la distorsión de barril que compensa la lente (0 = sin corrección). */
  k1: number
  k2: number
  /** Distancia (mm) del centro de la pantalla al centro de cada lente. 0 = centro de cada mitad de pantalla (sin ajuste). */
  lens: number
  /** Milímetros por píxel CSS de la pantalla (para pasar `lens` a píxeles). */
  mmPerPx: number
}

export type PresetId = 'vrbox' | 'cardboard' | 'none'

export const PRESETS: Record<PresetId, { label: string; calib: Omit<Calib, 'mmPerPx'> }> = {
  // Por defecto, sin corrección: los valores de VR Box y Cardboard son estimados y en un iPhone real marearon más.
  none: { label: 'Sin corrección', calib: { fov: 85, ipd: 0.064, k1: 0, k2: 0, lens: 0 } },
  vrbox: { label: 'VR Box', calib: { fov: 92, ipd: 0.064, k1: 0.22, k2: 0.06, lens: 32 } },
  cardboard: { label: 'Google Cardboard', calib: { fov: 90, ipd: 0.064, k1: 0.34, k2: 0.15, lens: 30 } },
}
export const PRESET_ORDER: PresetId[] = ['none', 'vrbox', 'cardboard']
export const DEFAULT_PRESET: PresetId = 'none'
export const STORAGE_KEY = 'mus3o.vr.calib'

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
    fov: clamp(c.fov, 60, 130),
    ipd: clamp(c.ipd, 0.04, 0.08),
    k1: clamp(c.k1, -0.2, 0.8),
    k2: clamp(c.k2, -0.2, 0.8),
    lens: clamp(c.lens, 0, 60),
    mmPerPx: clamp(c.mmPerPx, 0.05, 0.4),
  }
}

export function isPreset(v: unknown): v is PresetId {
  return v === 'vrbox' || v === 'cardboard' || v === 'none'
}

/** Lo guardado (JSON de localStorage): preset y/o valores sueltos. Tolerante a basura. */
export type Stored = { preset?: PresetId; values?: Partial<Omit<Calib, 'mmPerPx'>> }

export function parseStored(raw: string | null): Stored {
  if (!raw) return {}
  try {
    const j = JSON.parse(raw) as { preset?: unknown; values?: Record<string, unknown> }
    const out: Stored = {}
    if (isPreset(j.preset)) out.preset = j.preset
    if (j.values && typeof j.values === 'object') {
      const v: Partial<Omit<Calib, 'mmPerPx'>> = {}
      for (const key of ['fov', 'ipd', 'k1', 'k2', 'lens'] as const) {
        const n = j.values[key]
        if (typeof n === 'number' && Number.isFinite(n)) v[key] = n
      }
      out.values = v
    }
    return out
  } catch {
    return {}
  }
}

/**
 * Calibración efectiva. Orden: preset (URL > guardado > VR Box) → valores sueltos guardados → parámetros de URL.
 * URL: ?vrpreset=vrbox|cardboard|none ?vrfov= ?vripd= (m, o mm si >1) ?vrk1= ?vrk2= ?vrlens= (mm) ?vrmm= (mm por px CSS).
 */
export function resolveCalib(search: string, stored: Stored, ua = ''): { calib: Calib; preset: PresetId | 'custom' } {
  const q = new URLSearchParams(search)
  const urlPreset = q.get('vrpreset')
  const preset: PresetId = isPreset(urlPreset) ? urlPreset : (stored.preset ?? DEFAULT_PRESET)
  const base: Calib = { ...PRESETS[preset].calib, mmPerPx: defaultMmPerPx(ua) }
  // Los valores sueltos guardados solo cuentan si no se eligió otro preset por URL.
  if (!isPreset(urlPreset) && stored.values) Object.assign(base, stored.values)
  let custom = !isPreset(urlPreset) && !!stored.values && Object.keys(stored.values).length > 0
  const set = (key: keyof Calib, v: number | null, map: (n: number) => number = (n) => n) => {
    if (v === null) return
    base[key] = map(v)
    custom = true
  }
  set('fov', num(q.get('vrfov')))
  set('ipd', num(q.get('vripd')), (n) => (n > 1 ? n / 1000 : n))
  set('k1', num(q.get('vrk1')))
  set('k2', num(q.get('vrk2')))
  set('lens', num(q.get('vrlens')))
  set('mmPerPx', num(q.get('vrmm')))
  return { calib: sanitizeCalib(base), preset: custom ? 'custom' : preset }
}

export function loadStored(): Stored {
  try {
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

/** Estado vivo (se lee cada frame, sin React). */
export const calibState = { ...resolveCalib('', {}), }

export function reloadCalib(): void {
  const r = resolveCalib(typeof window === 'undefined' ? '' : window.location.search, loadStored(), typeof navigator === 'undefined' ? '' : navigator.userAgent)
  calibState.calib = r.calib
  calibState.preset = r.preset
}

/** Elige un preset y lo guarda (descarta los valores sueltos). */
export function selectPreset(id: PresetId): void {
  saveStored({ preset: id })
  reloadCalib()
}

/** Guarda valores sueltos sobre el preset actual. */
export function saveValues(values: Partial<Omit<Calib, 'mmPerPx'>>): void {
  const prev = loadStored()
  saveStored({ preset: prev.preset ?? DEFAULT_PRESET, values: { ...(prev.values ?? {}), ...values } })
  reloadCalib()
}

/** Siguiente preset en el orden (para el botón de cambio rápido). */
export function nextPreset(cur: PresetId | 'custom'): PresetId {
  const i = cur === 'custom' ? -1 : PRESET_ORDER.indexOf(cur)
  return PRESET_ORDER[(i + 1) % PRESET_ORDER.length]
}

/**
 * Desplazamiento (fracción del ancho de una mitad de pantalla, 0..1) del centro de cada imagen hacia el centro de la pantalla,
 * para que caiga sobre su lente. `widthPx`: ancho CSS de la pantalla. Con lens = 0 no hay ajuste.
 */
export function lensShift(c: Calib, widthPx: number): number {
  if (c.lens <= 0 || widthPx <= 0) return 0
  const lensPx = c.lens / c.mmPerPx
  const halfCenter = widthPx / 4 // centro de cada mitad, medido desde el borde exterior
  const lensFromEdge = widthPx / 2 - lensPx
  return clamp((halfCenter * -1 + lensFromEdge) / (widthPx / 2), -0.5, 0.5)
}

export const usesDistortion = (c: Calib) => c.k1 !== 0 || c.k2 !== 0 || c.lens > 0
