import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useRef, type ReactNode } from 'react'
import type { Group } from 'three'
import { introState } from './store'
import { revealProgress } from './timeline'

/**
 * Cómo aparece un elemento durante "El palacio se levanta":
 * - rise: crece desde el suelo (escala Y)
 * - sink: sale del suelo (pedestales)
 * - drop: cae y se posa (objetos)
 * - pop: crece desde su centro (suelos, cuadros, rótulos)
 */
export type RevealMode = 'rise' | 'sink' | 'drop' | 'pop'

const DROP_HEIGHT = 2.5
const SINK_DEPTH = 1.3
const MIN = 0.001

/** Avance 0..1 del elemento en este instante; 1 si no hay intro. Sin estado de React. */
export function currentReveal(id: string): number {
  return introState.active || introState.popin ? revealProgress(introState.timeline, id, introState.t) : 1
}

/** Oculta a sus hijos mientras vuela la intro (p. ej. Aris, que sigue a la cámara). */
export function HideDuringIntro({ children }: { children: ReactNode }) {
  const ref = useRef<Group>(null)
  useFrame(() => {
    if (ref.current) ref.current.visible = !introState.active
  })
  return (
    <group ref={ref} visible={!introState.active}>
      {children}
    </group>
  )
}

/**
 * Envuelve visuales (nunca colliders): el efecto se pinta moviendo/escalando un grupo por frame.
 * `origin` es el punto (en coordenadas del padre) alrededor del que crece o cae.
 */
export function Reveal({
  id,
  mode,
  origin = [0, 0, 0],
  children,
}: {
  id: string
  mode: RevealMode
  origin?: [number, number, number]
  children: ReactNode
}) {
  const outer = useRef<Group>(null)
  const last = useRef(-1)

  const apply = () => {
    const g = outer.current
    if (!g) return
    const p = currentReveal(id)
    if (p === last.current) return
    last.current = p
    g.visible = p > 0
    g.scale.set(1, 1, 1)
    g.position.set(origin[0], origin[1], origin[2])
    if (p >= 1) return
    const k = Math.max(MIN, p)
    if (mode === 'rise') g.scale.y = k
    else if (mode === 'pop') g.scale.setScalar(k)
    else if (mode === 'sink') g.position.y = origin[1] - (1 - p) * SINK_DEPTH
    else g.position.y = origin[1] + (1 - p) * DROP_HEIGHT
  }

  useLayoutEffect(() => {
    last.current = -1 // tras cada render React pudo reaplicar props: se vuelve a pintar
    apply()
  })
  useFrame(apply)

  return (
    <group ref={outer} position={origin} visible={currentReveal(id) > 0}>
      <group position={[-origin[0], -origin[1], -origin[2]]}>{children}</group>
    </group>
  )
}
