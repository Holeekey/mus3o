// Mando en VR (joystick de un mando Bluetooth o del control del visor): matemática pura, sin three ni DOM,
// para poder probarla sin dispositivo. El cableado con el frame vive en VrRuntime.tsx.
//
// Dos esquemas de giro:
// - Un solo stick (el mando típico de "VR Box"): vertical = caminar, horizontal = giro por pasos (snap turn).
// - Dos sticks (gamepad normal): el primero camina y se desplaza de lado, el segundo gira por pasos.

/** Zona muerta del stick (los sticks baratos no vuelven exactamente a 0). */
export const DEADZONE = 0.25
/** Ángulo de cada giro por pasos. */
export const SNAP_DEG = 30
/** Empuje horizontal (crudo) que cuenta como "golpe" de giro. */
export const SNAP_THRESHOLD = 0.6
/** Segundos mínimos entre dos giros. */
export const SNAP_COOLDOWN = 0.3
/** Fracción de la velocidad de escritorio al caminar en VR (ir a 4,5 m/s con el visor puesto marea). */
export const VR_WALK_SCALE = 0.75
/** Segundos que se sigue contando "caminando" tras soltar el stick (el teletransporte no salta al detenerse). */
export const MOVE_HOLD = 0.4
/** Segundos mínimos entre dos acciones de botón (un mando puede emitir varios botones o rebotar con una pulsación). */
export const BUTTON_DEBOUNCE_MS = 250

export type Scheme = 'one' | 'two'

/** Zona muerta radial: dentro de ella 0; fuera se reescala para que el borde de la zona sea 0 y el tope 1. */
export function applyDeadzone(x: number, y: number, dz = DEADZONE): [number, number] {
  const m = Math.hypot(x, y)
  if (!Number.isFinite(m) || m <= dz) return [0, 0]
  const k = Math.min(1, (m - dz) / (1 - dz)) / m
  return [x * k, y * k]
}

export type SchemeState = {
  /** Se ha movido alguna vez el primer stick (ejes 0/1). */
  first: boolean
  /** Se ha movido alguna vez un segundo stick distinto (ejes 2/3). */
  second: boolean
}

export const schemeIdle = (): SchemeState => ({ first: false, second: false })

const axis = (a: readonly number[], i: number) => (Number.isFinite(a[i]) ? a[i] : 0)

/**
 * Esquema según lo que se ha visto mover. Se pasa a "dos sticks" solo cuando hay 4+ ejes y se usaron los dos
 * (y no son el mismo stick repetido: algunos mandos duplican los ejes). Hasta entonces, un stick.
 */
export function updateScheme(prev: SchemeState, axes: readonly number[]): { state: SchemeState; scheme: Scheme } {
  const s = { ...prev }
  if (axes.length >= 2 && Math.hypot(axis(axes, 0), axis(axes, 1)) > DEADZONE) s.first = true
  if (axes.length >= 4) {
    const b = Math.hypot(axis(axes, 2), axis(axes, 3))
    const mirror = Math.hypot(axis(axes, 0) - axis(axes, 2), axis(axes, 1) - axis(axes, 3)) < 0.05
    if (b > DEADZONE && !(mirror && Math.hypot(axis(axes, 0), axis(axes, 1)) > DEADZONE)) s.second = true
  }
  return { state: s, scheme: s.first && s.second ? 'two' : 'one' }
}

export type AxesMap = {
  /** Lateral (+ derecha) y frontal (+ adelante), ya con zona muerta y escala de VR; es lo que lee `moveAxes`. */
  ax: number
  az: number
  /** Horizontal crudo del stick que gira (para el giro por pasos). */
  turn: number
  scheme: Scheme
}

/** Eje vertical → avance (sin -0). */
const fwd = (y: number) => (y === 0 ? 0 : -y * VR_WALK_SCALE)

/**
 * Ejes de un gamepad → movimiento y giro. Un solo stick: el que esté activo (el primero, si no el segundo).
 * "Adelante" es el eje vertical negativo (convención del Gamepad API: arriba = -1).
 */
export function mapAxes(axes: readonly number[], scheme: Scheme): AxesMap {
  if (axes.length < 2) return { ax: 0, az: 0, turn: 0, scheme }
  const l = [axis(axes, 0), axis(axes, 1)] as const
  const r = axes.length >= 4 ? ([axis(axes, 2), axis(axes, 3)] as const) : null
  if (scheme === 'two' && r) {
    const [mx, my] = applyDeadzone(l[0], l[1])
    return { ax: mx * VR_WALK_SCALE, az: fwd(my), turn: r[0], scheme }
  }
  // Un solo stick: el primero; si está quieto y hay un segundo con movimiento, ese (algunos mandos lo exponen en 2/3).
  let sx = l[0]
  let sy = l[1]
  if (r && Math.hypot(sx, sy) <= DEADZONE && Math.hypot(r[0], r[1]) > DEADZONE) {
    sx = r[0]
    sy = r[1]
  }
  // Horizontal = giro. Solo cuenta si domina sobre el vertical (empujar adelante en diagonal no debe girar).
  const turn = Math.abs(sx) > Math.abs(sy) ? sx : 0
  const [, my] = applyDeadzone(0, sy)
  return { ax: 0, az: fwd(my), turn, scheme }
}

// ---------- giro por pasos ----------

export type SnapState = {
  /** Listo para girar: el stick pasó por el centro desde el último giro. */
  armed: boolean
  /** Segundos que faltan para poder girar de nuevo. */
  cooldown: number
}

export const snapIdle = (): SnapState => ({ armed: true, cooldown: 0 })

/**
 * Avanza `dt`. `x` es el horizontal crudo (-1..1). Gira (+1 derecha, -1 izquierda) en un golpe fuerte,
 * y no vuelve a hacerlo hasta que pase el enfriamiento Y el stick regrese al centro.
 */
export function stepSnap(prev: SnapState, x: number, dt: number): { state: SnapState; dir: -1 | 0 | 1 } {
  const cooldown = Math.max(0, prev.cooldown - dt)
  let armed = prev.armed
  if (Math.abs(x) <= DEADZONE) armed = true
  if (armed && cooldown <= 0 && Math.abs(x) >= SNAP_THRESHOLD) {
    return { state: { armed: false, cooldown: SNAP_COOLDOWN }, dir: x > 0 ? 1 : -1 }
  }
  return { state: { armed, cooldown }, dir: 0 }
}

/** Cambio de yaw (rad) de un giro por pasos. Girar a la derecha resta yaw (el yaw positivo gira a la izquierda). */
export const snapYawDelta = (dir: -1 | 0 | 1) => (dir === 0 ? 0 : -dir * ((SNAP_DEG * Math.PI) / 180))

/** Vector (x, z) hacia donde mira un yaw (la cámara de three mira hacia -Z con yaw 0). */
export function forwardFromYaw(yaw: number): [number, number] {
  return [-Math.sin(yaw), -Math.cos(yaw)]
}

// ---------- teclado de mandos en modo teclado ----------

export type KeyAxes = { forward: number; turn: number }

const FWD = ['ArrowUp', 'KeyW']
const BACK = ['ArrowDown', 'KeyS']
const LEFT = ['ArrowLeft', 'KeyA']
const RIGHT = ['ArrowRight', 'KeyD']

/** Teclas sostenidas → avance (+1/-1) y giro (+1 derecha). */
export function keyAxes(held: ReadonlySet<string>): KeyAxes {
  const any = (codes: string[]) => codes.some((c) => held.has(c))
  return { forward: (any(FWD) ? 1 : 0) - (any(BACK) ? 1 : 0), turn: (any(RIGHT) ? 1 : 0) - (any(LEFT) ? 1 : 0) }
}

export const isNavKey = (code: string) => [...FWD, ...BACK, ...LEFT, ...RIGHT].includes(code)

// ---------- botones ----------

export type ButtonAction = 'select' | 'repeat'

export type ButtonState = {
  prev: boolean[]
  /** Marca de tiempo (ms) de la última acción. */
  lastAt: number
}

export const buttonsIdle = (): ButtonState => ({ prev: [], lastAt: Number.NEGATIVE_INFINITY })

/** Botón 0 = seleccionar, 1 = repetir a Aris, cualquier otro = seleccionar. */
export const actionForButton = (i: number): ButtonAction => (i === 1 ? 'repeat' : 'select')

/**
 * Pulsaciones nuevas (flanco de subida) de un frame → a lo sumo UNA acción, con debounce.
 * `pressed[i]` ya fusiona todos los mandos. El primer botón que sube manda (el de menor índice).
 */
export function stepButtons(prev: ButtonState, pressed: readonly boolean[], nowMs: number): { state: ButtonState; action: ButtonAction | null } {
  const next = pressed.map(Boolean)
  let rising = -1
  for (let i = 0; i < next.length; i++) {
    if (next[i] && !prev.prev[i]) {
      rising = i
      break
    }
  }
  if (rising < 0 || nowMs - prev.lastAt < BUTTON_DEBOUNCE_MS) return { state: { prev: next, lastAt: prev.lastAt }, action: null }
  return { state: { prev: next, lastAt: nowMs }, action: actionForButton(rising) }
}

// ---------- "caminando" para suprimir el teletransporte ----------

export type MovingState = { left: number }

export const movingIdle = (): MovingState => ({ left: 0 })

/** `active` = hay empuje de stick/teclas este frame. Sigue "caminando" `MOVE_HOLD` s tras soltar. */
export function stepMoving(prev: MovingState, active: boolean, dt: number): { state: MovingState; moving: boolean } {
  const left = active ? MOVE_HOLD : Math.max(0, prev.left - dt)
  return { state: { left }, moving: left > 0 }
}

/** El teletransporte al suelo por mirada se suprime mientras se camina (el resto de objetivos sigue igual). */
export const suppressGazeTarget = (kind: string | null | undefined, moving: boolean) => moving && kind === 'floor'
