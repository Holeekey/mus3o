// Comodidad al caminar en VR: velocidad baja y viñeta (bordes oscuros) mientras hay movimiento o giro.
// Lógica pura salvo `comfortOn`, que lee la URL y localStorage.

/** Velocidad de marcha en VR respecto a la de escritorio: 4,5 m/s · 0,75 · 0,42 ≈ 1,4 m/s (en el cuadro, 5 m/s ≈ 1,6). */
export const COMFORT_SCALE = 0.42
export const VIGNETTE_MAX = 0.85
const RISE = 6 // por segundo
const FALL = 1.6
/** Segundos que se mantiene la viñeta tras un giro por pasos. */
export const TURN_PULSE = 0.45
export const COMFORT_KEY = 'mus3o.vr.comfort'

export const comfortView = { vignette: 0, pulse: 0, on: true }

/** Modo cómodo: ?vrcomfort=0|1 manda; si no, lo guardado; por defecto activo. */
export function parseComfort(search: string, stored: string | null): boolean {
  const q = new URLSearchParams(search).get('vrcomfort')
  if (q === '0' || q === 'off') return false
  if (q === '1' || q === 'on') return true
  if (stored === '0') return false
  return true
}

export function reloadComfort(): boolean {
  let stored: string | null = null
  try {
    stored = localStorage.getItem(COMFORT_KEY)
  } catch {
    /* sin almacenamiento */
  }
  comfortView.on = parseComfort(typeof window === 'undefined' ? '' : window.location.search, stored)
  return comfortView.on
}

export function saveComfort(on: boolean): void {
  try {
    localStorage.setItem(COMFORT_KEY, on ? '1' : '0')
  } catch {
    /* sin almacenamiento */
  }
  comfortView.on = on
}

export const comfortFactor = () => (comfortView.on ? COMFORT_SCALE : 1)

/** Avanza la intensidad de la viñeta: sube rápido al moverse y baja despacio al parar (nunca de golpe). */
export function stepVignette(cur: number, active: boolean, dt: number): number {
  const target = active ? VIGNETTE_MAX : 0
  return target > cur ? Math.min(target, cur + RISE * dt) : Math.max(target, cur - FALL * dt)
}

export function pulseVignette(): void {
  comfortView.pulse = TURN_PULSE
}
