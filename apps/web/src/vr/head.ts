import { Euler, MathUtils, Quaternion, Vector3 } from 'three'
import { useVr } from './runtime'

// Orientaci√≥n de la cabeza para el modo cardboard: sensores del tel√©fono (DeviceOrientation) y,
// donde no los hay (escritorio con ?vr=cardboard), arrastrar con el rat√≥n.

const _euler = new Euler()
const _q1 = new Quaternion(-Math.SQRT1_2, 0, 0, Math.SQRT1_2) // -90¬∞ en X: de "tel√©fono plano" a "c√°mara mirando al frente"
const _zee = new Vector3(0, 0, 1)
const _qz = new Quaternion()

/**
 * Cuaterni√≥n de la cabeza a partir de los √°ngulos del sensor (misma f√≥rmula que DeviceOrientationControls de three).
 * `orientDeg` es el √°ngulo de la pantalla (0, 90, 180, 270). Con el tel√©fono vertical y sin girar, la c√°mara mira a -Z.
 */
export function deviceQuaternion(alphaDeg: number, betaDeg: number, gammaDeg: number, orientDeg: number, out = new Quaternion()): Quaternion {
  _euler.set(MathUtils.degToRad(betaDeg), MathUtils.degToRad(alphaDeg), -MathUtils.degToRad(gammaDeg), 'YXZ')
  out.setFromEuler(_euler)
  out.multiply(_q1)
  out.multiply(_qz.setFromAxisAngle(_zee, -MathUtils.degToRad(orientDeg)))
  return out
}

/** Giro (rad) alrededor de Y de un cuaterni√≥n. */
export function yawOf(q: Quaternion): number {
  return _euler.setFromQuaternion(q, 'YXZ').y
}

/** ¡ngulo de la pantalla en grados [0, 360): `screen.orientation.angle` (Safari 16.4+, Chrome) o `window.orientation` (iOS antiguo, -90 = 270). */
export function normAngle(a: number): number {
  return ((Math.round(a) % 360) + 360) % 360
}
export function screenAngle(): number {
  const so = typeof screen !== 'undefined' ? screen.orientation?.angle : undefined
  if (typeof so === 'number') return normAngle(so)
  const wo = typeof window !== 'undefined' ? (window as unknown as { orientation?: number }).orientation : undefined
  return typeof wo === 'number' ? normAngle(wo) : 0
}

const _dq = new Quaternion()
const _axis = new Vector3()

/**
 * Gira `q` (marco del dispositivo: se multiplica por la derecha) con una velocidad angular `w` en rad/s sobre los ejes del dispositivo.
 * Es la integraciÛn del giroscopio entre dos eventos de orientaciÛn: sin retraso, a diferencia de esperar al siguiente evento.
 */
export function integrateGyro(q: Quaternion, wx: number, wy: number, wz: number, dt: number): Quaternion {
  const mag = Math.hypot(wx, wy, wz)
  if (mag < 1e-6 || dt <= 0) return q
  _axis.set(wx / mag, wy / mag, wz / mag)
  return q.multiply(_dq.setFromAxisAngle(_axis, mag * dt))
}

/** Peso con que cada evento de orientaciÛn corrige la deriva del giroscopio integrado (0 = solo giroscopio, 1 = solo orientaciÛn). */
export const GYRO_CORRECT = 0.06
/** Segundos de predicciÛn: el ˙ltimo giro medido se extrapola hasta que el fotograma llega a la pantalla (~1 frame). */
export const PREDICT_S = 0.016
/** Mayor intervalo de integraciÛn creÌble (s): un evento retrasado no debe lanzar la cabeza. */
const MAX_GYRO_DT = 0.05

const _calib = new Quaternion()
const _drag = new Quaternion()
const _dragEuler = new Euler(0, 0, 0, 'YXZ')
const _raw = new Quaternion()

type Sample = { alpha: number; beta: number; gamma: number }

const DEG = Math.PI / 180
const _devQ = new Quaternion()
const _pred = new Quaternion()

export const head = {
  /** Orientaci√≥n actual de la cabeza (sin el giro del rig). Se actualiza con `update()`. */
  quat: new Quaternion(),
  source: 'none' as 'none' | 'sensor' | 'drag',
  sample: null as Sample | null,
  /** OrientaciÛn fusionada (giroscopio + DeviceOrientation) en el marco del dispositivo, sin el ·ngulo de pantalla. */
  fused: null as Quaternion | null,
  /** ⁄ltima velocidad angular (rad/s, ejes del dispositivo) y marca de tiempo; `gyroOn` si el telÈfono la da. */
  rate: new Vector3(),
  rateT: 0,
  gyroOn: false,
  calibrated: false,
  calYaw: 0,
  dragYaw: 0,
  dragPitch: 0,
  cleanup: null as null | (() => void),
  fallbackTimer: 0 as number,

  /** Empieza a escuchar. `sensorsGranted` viene del permiso pedido dentro del gesto de toque. */
  start(sensorsGranted: boolean) {
    this.stop()
    this.sample = null
    this.fused = null
    this.gyroOn = false
    this.rate.set(0, 0, 0)
    this.rateT = 0
    this.calibrated = false
    this.dragYaw = 0
    this.dragPitch = 0
    this.source = 'drag'
    useVr.setState({ sensors: sensorsGranted ? 'idle' : 'denied' })
    const onOrient = (e: DeviceOrientationEvent) => {
      if (e.beta === null || e.alpha === null || e.gamma === null) return // escritorio: dispara un evento vac√≠o
      this.sample = { alpha: e.alpha, beta: e.beta, gamma: e.gamma }
      // Se guarda el cuaterniÛn del dispositivo (sin pantalla) y se funde con el giroscopio. Sin suavizado: nada de filtro paso bajo.
      deviceQuaternion(e.alpha, e.beta, e.gamma, 0, _devQ)
      if (!this.fused || !this.gyroOn) this.fused = (this.fused ?? new Quaternion()).copy(_devQ)
      else this.fused.slerp(_devQ, GYRO_CORRECT)
      if (this.source !== 'sensor') {
        this.source = 'sensor'
        useVr.setState({ sensors: 'ok' })
      }
    }
    // El giroscopio (rotationRate, ∞/s) se integra entre eventos de orientaciÛn: menos retraso y sin escalones.
    const onMotion = (e: DeviceMotionEvent) => {
      const r = e.rotationRate
      if (!r || r.alpha === null || r.beta === null || r.gamma === null || !this.fused) return
      const now = performance.now()
      const dt = this.rateT ? Math.min(MAX_GYRO_DT, (now - this.rateT) / 1000) : 0
      this.rateT = now
      this.gyroOn = true
      // alpha gira en torno a Z, beta a X, gamma a Y del dispositivo.
      this.rate.set(r.beta * DEG, r.gamma * DEG, r.alpha * DEG)
      integrateGyro(this.fused, this.rate.x, this.rate.y, this.rate.z, dt)
    }
    // Arrastrar mira alrededor (rat√≥n en escritorio; en el tel√©fono sirve para recentrar el giro).
    let down: { x: number; y: number } | null = null
    const onDown = (e: PointerEvent) => {
      down = { x: e.clientX, y: e.clientY }
    }
    const onMove = (e: PointerEvent) => {
      if (!down) return
      const dx = e.clientX - down.x
      const dy = e.clientY - down.y
      down = { x: e.clientX, y: e.clientY }
      this.dragYaw -= dx * 0.005
      if (this.source !== 'sensor') this.dragPitch = MathUtils.clamp(this.dragPitch - dy * 0.005, -1.4, 1.4)
    }
    const onUp = () => {
      down = null
    }
    if (sensorsGranted) {
      window.addEventListener('deviceorientation', onOrient)
      window.addEventListener('devicemotion', onMotion)
    }
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    // Si en 1,5 s no lleg√≥ ning√∫n dato real, no hay sensores: queda el arrastre.
    this.fallbackTimer = window.setTimeout(() => {
      if (this.source !== 'sensor') useVr.setState({ sensors: sensorsGranted ? 'none' : 'denied' })
    }, 1500)
    this.cleanup = () => {
      window.removeEventListener('deviceorientation', onOrient)
      window.removeEventListener('devicemotion', onMotion)
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      window.clearTimeout(this.fallbackTimer)
    }
  },

  stop() {
    this.cleanup?.()
    this.cleanup = null
    this.sample = null
    this.fused = null
    this.source = 'none'
  },

  /** Vuelve a tomar el frente actual como "adelante". */
  recenter() {
    this.calibrated = false
    this.dragYaw = 0
  },

  /** Calcula `quat` para este frame. */
  update() {
    if (this.source === 'sensor' && this.fused) {
      // Se aplica la ˙ltima muestra en este mismo frame, con una predicciÛn corta con el giro medido.
      _pred.copy(this.fused)
      if (this.gyroOn) integrateGyro(_pred, this.rate.x, this.rate.y, this.rate.z, PREDICT_S)
      _raw.copy(_pred).multiply(_qz.setFromAxisAngle(_zee, -MathUtils.degToRad(screenAngle())))
      if (!this.calibrated) {
        this.calYaw = yawOf(_raw)
        this.calibrated = true
      }
      // Ry(dragYaw - calYaw) * raw: el frente al empezar es el "adelante" del rig; arrastrar suma giro.
      _calib.setFromAxisAngle(_yAxis, this.dragYaw - this.calYaw)
      this.quat.copy(_calib).multiply(_raw)
    } else {
      _dragEuler.set(this.dragPitch, this.dragYaw, 0, 'YXZ')
      this.quat.copy(_drag.setFromEuler(_dragEuler))
    }
    return this.quat
  },
}

const _yAxis = new Vector3(0, 1, 0)
