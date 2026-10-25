import { Euler, MathUtils, Quaternion, Vector3 } from 'three'
import { useVr } from './runtime'

// Orientación de la cabeza para el modo cardboard: sensores del teléfono (DeviceOrientation) y,
// donde no los hay (escritorio con ?vr=cardboard), arrastrar con el ratón.

const _euler = new Euler()
const _q1 = new Quaternion(-Math.SQRT1_2, 0, 0, Math.SQRT1_2) // -90° en X: de "teléfono plano" a "cámara mirando al frente"
const _zee = new Vector3(0, 0, 1)
const _qz = new Quaternion()

/**
 * Cuaternión de la cabeza a partir de los ángulos del sensor (misma fórmula que DeviceOrientationControls de three).
 * `orientDeg` es el ángulo de la pantalla (0, 90, 180, 270). Con el teléfono vertical y sin girar, la cámara mira a -Z.
 */
export function deviceQuaternion(alphaDeg: number, betaDeg: number, gammaDeg: number, orientDeg: number, out = new Quaternion()): Quaternion {
  _euler.set(MathUtils.degToRad(betaDeg), MathUtils.degToRad(alphaDeg), -MathUtils.degToRad(gammaDeg), 'YXZ')
  out.setFromEuler(_euler)
  out.multiply(_q1)
  out.multiply(_qz.setFromAxisAngle(_zee, -MathUtils.degToRad(orientDeg)))
  return out
}

/** Giro (rad) alrededor de Y de un cuaternión. */
export function yawOf(q: Quaternion): number {
  return _euler.setFromQuaternion(q, 'YXZ').y
}

const _calib = new Quaternion()
const _drag = new Quaternion()
const _dragEuler = new Euler(0, 0, 0, 'YXZ')
const _raw = new Quaternion()

type Sample = { alpha: number; beta: number; gamma: number }

export const head = {
  /** Orientación actual de la cabeza (sin el giro del rig). Se actualiza con `update()`. */
  quat: new Quaternion(),
  source: 'none' as 'none' | 'sensor' | 'drag',
  sample: null as Sample | null,
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
    this.calibrated = false
    this.dragYaw = 0
    this.dragPitch = 0
    this.source = 'drag'
    useVr.setState({ sensors: sensorsGranted ? 'idle' : 'denied' })
    const onOrient = (e: DeviceOrientationEvent) => {
      if (e.beta === null || e.alpha === null || e.gamma === null) return // escritorio: dispara un evento vacío
      this.sample = { alpha: e.alpha, beta: e.beta, gamma: e.gamma }
      if (this.source !== 'sensor') {
        this.source = 'sensor'
        useVr.setState({ sensors: 'ok' })
      }
    }
    // Arrastrar mira alrededor (ratón en escritorio; en el teléfono sirve para recentrar el giro).
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
    if (sensorsGranted) window.addEventListener('deviceorientation', onOrient)
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    // Si en 1,5 s no llegó ningún dato real, no hay sensores: queda el arrastre.
    this.fallbackTimer = window.setTimeout(() => {
      if (this.source !== 'sensor') useVr.setState({ sensors: sensorsGranted ? 'none' : 'denied' })
    }, 1500)
    this.cleanup = () => {
      window.removeEventListener('deviceorientation', onOrient)
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
    this.source = 'none'
  },

  /** Vuelve a tomar el frente actual como "adelante". */
  recenter() {
    this.calibrated = false
    this.dragYaw = 0
  },

  /** Calcula `quat` para este frame. */
  update() {
    if (this.source === 'sensor' && this.sample) {
      const angle = (typeof screen !== 'undefined' && screen.orientation?.angle) || (window.orientation as number | undefined) || 0
      deviceQuaternion(this.sample.alpha, this.sample.beta, this.sample.gamma, angle, _raw)
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
