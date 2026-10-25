import { create } from 'zustand'
import type { VrKind } from './mode'

// Estado del modo VR. Dos capas, igual que el resto del proyecto:
// - `vrRuntime`: mutable, se lee y escribe cada frame sin pasar por React (y lo consultan escena y diorama).
// - `useVr`: zustand, solo lo que la interfaz necesita para pintarse.

export const vrRuntime = {
  /** Hay una sesión VR en marcha (WebXR o cardboard). */
  active: false,
  kind: null as VrKind | null,
  /** Velo negro propio (teletransporte), 0..1. */
  fade: 0,
  /** Pulsación instantánea pendiente (toque, Enter, mando): el frame siguiente la consume. */
  press: false,
  /** Movimiento virtual del mando/teclado en VR (lateral y frontal, -1..1). Lo lee `moveAxes`, así Player y el cuadro caminan igual. */
  move: { ax: 0, az: 0 },
  /** Se está empujando el stick (con una cola corta): el teletransporte al suelo por mirada se suprime. */
  moving: false,
}

export type Sensors = 'idle' | 'ok' | 'denied' | 'none'

type VrUi = {
  /** Qué camino ofrece este dispositivo (resuelto al montar el botón). */
  available: VrKind | 'none' | 'checking'
  /** Sesión activa. */
  kind: VrKind | null
  /** WebXR: el puente con la escena está montado y se puede pedir la sesión. */
  xrReady: boolean
  /** Estado de los sensores de movimiento (solo cardboard). */
  sensors: Sensors
  /** Último error al entrar (se muestra junto al botón). */
  error: string | null
  /** Concepto abierto en el panel 3D. */
  panelId: string | null
  /** Texto bajo la retícula (qué pasará al mantener la mirada). */
  hint: string | null
}

export const useVr = create<VrUi>(() => ({
  available: 'checking',
  kind: null,
  xrReady: false,
  sensors: 'idle',
  error: null,
  panelId: null,
  hint: null,
}))

export const vrActive = () => vrRuntime.active
