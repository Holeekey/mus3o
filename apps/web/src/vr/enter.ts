import { useStore } from '../store'
import { reloadCalib } from './calib'
import { parseVrFlag, selectVrMode, type VrKind } from './mode'
import { useVr, vrRuntime } from './runtime'

// Entrada y salida del modo VR. `enterVr` debe llamarse directamente desde un clic/toque:
// los permisos (sensores en iOS, pantalla completa, bloqueo de orientación) exigen un gesto del usuario.

/** ¿El navegador ofrece WebXR immersive-vr? */
async function xrSupported(): Promise<boolean> {
  try {
    return !!navigator.xr && (await navigator.xr.isSessionSupported('immersive-vr'))
  } catch {
    return false
  }
}

/** Resuelve qué camino ofrece este dispositivo y lo guarda en el estado de la interfaz. */
export async function detectVr(): Promise<VrKind | 'none'> {
  const force = parseVrFlag(window.location.search)
  const touch = !!window.matchMedia?.('(pointer: coarse)').matches
  const mode = selectVrMode({ force, xrSupported: force ? false : await xrSupported(), touch })
  useVr.setState({ available: mode })
  return mode
}

// ---------- cardboard ----------

type MotionEventCtor = { requestPermission?: () => Promise<'granted' | 'denied'> }

function requestSensors(): Promise<boolean> {
  const ctor = (window as unknown as { DeviceOrientationEvent?: MotionEventCtor }).DeviceOrientationEvent
  if (!ctor) return Promise.resolve(false)
  if (typeof ctor.requestPermission === 'function') {
    // iOS 13+: hay que pedirlo aquí, síncrono respecto al gesto.
    return ctor.requestPermission().then((r) => r === 'granted', () => false)
  }
  return Promise.resolve(true)
}

let wakeLock: WakeLockSentinel | null = null
async function holdScreenAwake() {
  try {
    wakeLock = (await navigator.wakeLock?.request('screen')) ?? null
  } catch {
    wakeLock = null // no disponible o sin permiso: el teléfono puede apagar la pantalla
  }
}
const reacquireWakeLock = () => {
  if (vrRuntime.active && document.visibilityState === 'visible') void holdScreenAwake()
}

async function goFullscreen() {
  try {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen?.({ navigationUI: 'hide' })
  } catch {
    /* iOS Safari en iPhone no lo permite: se sigue sin pantalla completa */
  }
  try {
    await (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }).lock?.('landscape')
  } catch {
    /* solo funciona en pantalla completa y en Android */
  }
}

function markActive(kind: VrKind) {
  vrRuntime.active = true
  vrRuntime.kind = kind
  vrRuntime.fade = 1 // entra desde negro y se aclara
  document.documentElement.classList.add('vr-on')
  const s = useStore.getState()
  // Sin teclado no se puede contestar un examen: la VR es para recorrer y leer.
  if (s.mode === 'exam') s.setMode('explore')
  s.set({ locked: true, openId: null, arisPromptOpen: false })
  useVr.setState({ kind, error: null, panelId: null, hint: null })
}

function markInactive() {
  vrRuntime.active = false
  vrRuntime.kind = null
  vrRuntime.fade = 0
  vrRuntime.press = false
  document.documentElement.classList.remove('vr-on')
  useStore.getState().set({ locked: false })
  useVr.setState({ kind: null, panelId: null, hint: null })
}

// En iPhone apaisado la página debe extenderse bajo el notch y el indicador de inicio (viewport-fit=cover) o el lienzo queda más estrecho que la pantalla.
let savedViewport: string | null = null
function coverViewport() {
  const meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]')
  if (!meta || savedViewport !== null) return
  savedViewport = meta.content
  if (!/viewport-fit/.test(meta.content)) meta.content = `${meta.content}, viewport-fit=cover`
}
function restoreViewport() {
  const meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]')
  if (meta && savedViewport !== null) meta.content = savedViewport
  savedViewport = null
}

async function startCardboard() {
  // Todo lo que exige gesto se dispara antes de cualquier await.
  const sensorsP = requestSensors()
  const fullscreenP = goFullscreen()
  const granted = await sensorsP
  // head.ts usa three: se carga aquí y no al abrir la página (el módulo ya está en caché si la escena VR se montó).
  const { head } = await import('./head')
  reloadCalib()
  coverViewport()
  head.start(granted)
  markActive('cardboard')
  document.addEventListener('visibilitychange', reacquireWakeLock)
  void holdScreenAwake()
  await fullscreenP
}

function stopCardboard() {
  restoreViewport()
  void import('./head').then((m) => m.head.stop())
  document.removeEventListener('visibilitychange', reacquireWakeLock)
  void wakeLock?.release().catch(() => {})
  wakeLock = null
  if (document.fullscreenElement) void document.exitFullscreen().catch(() => {})
  try {
    ;(screen.orientation as ScreenOrientation & { unlock?: () => void }).unlock?.()
  } catch {
    /* sin bloqueo previo */
  }
}

// ---------- WebXR ----------

/** El módulo de WebXR (@react-three/xr) es pesado: se descarga solo si hace falta. */
export const loadXr = () => import('./xrStore')

async function startXr() {
  const { xrStore } = await loadXr()
  await xrStore.enterVR() // el puente (XrBridge) marca la sesión activa al arrancar
}

// ---------- API ----------

/** WebXR ya falló en esta visita: los siguientes intentos van directo al modo visor. */
let xrFailed = false

export async function enterVr(requested: VrKind): Promise<void> {
  if (vrRuntime.active) return
  const kind: VrKind = requested === 'xr' && xrFailed ? 'cardboard' : requested
  try {
    if (kind === 'cardboard') await startCardboard()
    else {
      try {
        await startXr()
      } catch (err) {
        // Muchos Android anuncian WebXR pero no abren la sesión (sin servicios de VR, función no soportada...):
        // en vez de quedarse en el error, se entra al modo visor, que solo necesita la pantalla y los sensores.
        console.warn('[vr] WebXR no arrancó; se usa el modo visor', err)
        xrFailed = true
        await startCardboard()
      }
    }
  } catch (err) {
    console.warn('[vr] no se pudo entrar', err)
    if (kind === 'cardboard') stopCardboard()
    markInactive()
    useVr.setState({ error: kind === 'xr' ? 'No se pudo iniciar la sesión de realidad virtual.' : 'No se pudo iniciar el modo VR.' })
  }
}

export function exitVr(): void {
  if (!vrRuntime.active) return
  if (vrRuntime.kind === 'cardboard') stopCardboard()
  else void import('./xrStore').then(({ xrStore }) => xrStore.getState().session?.end())
  markInactive()
}

/** Para el puente de WebXR: la sesión empezó o terminó por su cuenta. */
export const xrSessionStarted = () => markActive('xr')
export const xrSessionEnded = () => {
  if (vrRuntime.active) markInactive()
}
