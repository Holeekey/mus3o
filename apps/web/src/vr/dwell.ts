// Máquina de estados de la mirada sostenida ("dwell"): sin botón, mirar ~1,5 s un objetivo lo activa.

export type DwellConfig = {
  /** Segundos de mirada continua para disparar. */
  duration: number
  /** Segundos que se tolera haber perdido el objetivo sin reiniciar (el pulso tiembla). */
  grace: number
  /** Metros que puede desplazarse el punto mirado (suelo) antes de contar como otro objetivo. */
  drift: number
}

export const DWELL_DEFAULTS: DwellConfig = { duration: 1.5, grace: 0.25, drift: 0.8 }

/** Lo que se está mirando: `key` identifica el objetivo; `point` es el punto de impacto (opcional). */
export type DwellTarget = { key: string; point?: readonly [number, number, number] }

export type DwellState = {
  key: string | null
  anchor: readonly [number, number, number] | null
  /** Segundos acumulados mirando el objetivo. */
  t: number
  /** Segundos seguidos sin ver el objetivo. */
  lost: number
  /** Ya disparó: no vuelve a hacerlo hasta soltar la mirada (evita encadenar teletransportes). */
  fired: boolean
}

export const dwellIdle = (): DwellState => ({ key: null, anchor: null, t: 0, lost: 0, fired: false })

export type DwellResult = {
  state: DwellState
  /** 0..1, para pintar el anillo. */
  progress: number
  /** true solo en el frame en que se completa. */
  fired: boolean
}

const dist = (a: readonly number[], b: readonly number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])

/** Avanza `dt` segundos. No muta el estado recibido. */
export function updateDwell(prev: DwellState, target: DwellTarget | null, dt: number, cfg: DwellConfig = DWELL_DEFAULTS): DwellResult {
  if (!target) {
    const lost = prev.lost + dt
    if (prev.key === null || lost > cfg.grace) return { state: dwellIdle(), progress: 0, fired: false }
    return { state: { ...prev, lost }, progress: prev.fired ? 1 : Math.min(1, prev.t / cfg.duration), fired: false }
  }
  const moved = !!(prev.anchor && target.point && dist(prev.anchor, target.point) > cfg.drift)
  if (prev.key !== target.key || (moved && !prev.fired)) {
    return { state: { key: target.key, anchor: target.point ?? null, t: dt, lost: 0, fired: false }, progress: Math.min(1, dt / cfg.duration), fired: false }
  }
  // Mismo objetivo. Una vez disparado, el ancla sigue al punto para no reiniciar al derivar.
  const anchor = prev.fired ? (target.point ?? prev.anchor) : prev.anchor
  if (prev.fired) return { state: { ...prev, anchor, lost: 0 }, progress: 1, fired: false }
  const t = prev.t + dt
  if (t >= cfg.duration) return { state: { ...prev, t: cfg.duration, lost: 0, fired: true }, progress: 1, fired: true }
  return { state: { ...prev, t, lost: 0 }, progress: t / cfg.duration, fired: false }
}

/** Pulsación instantánea (mando, toque, Enter): dispara ya si hay objetivo y aún no había disparado. */
export function forceDwellFire(prev: DwellState, target: DwellTarget | null): DwellResult {
  if (!target) return { state: prev, progress: 0, fired: false }
  if (prev.key === target.key && prev.fired) return { state: prev, progress: 1, fired: false }
  return { state: { key: target.key, anchor: target.point ?? null, t: Number.POSITIVE_INFINITY, lost: 0, fired: true }, progress: 1, fired: true }
}
