import { Billboard } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { Suspense, useLayoutEffect, useMemo, useRef } from 'react'
import { Vector3, type Fog, type Group } from 'three'
import type { PalaceLayout } from '../palace/layout'
import { LabelPlate } from '../scene/LabelPlate'
import { DEFAULT_THEME } from '../theme'
import { finishIntro, introState, useIntro } from './store'
import { titleKey } from './timeline'

const EYE = 1.7
const FONT_DISPLAY = '/fonts/Gloock.ttf'

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
const smootherstep = (x: number) => {
  const t = clamp01(x)
  return t * t * t * (t * (t * 6 - 15) + 10)
}
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

export type CameraPose = { pos: [number, number, number]; target: [number, number, number] }

/** Cámara aérea (isométrica, deriva lenta) → curva suave hasta el punto de entrada. Pura y determinista. */
export function introPose(layout: PalaceLayout, t: number, descentStart: number, total: number, aspect = 16 / 9): CameraPose {
  const { minX, maxX, minZ, maxZ } = layout.bounds
  const cx = (minX + maxX) / 2
  const cz = (minZ + maxZ) / 2
  const R = Math.hypot(maxX - minX, maxZ - minZ) / 2
  const D = (R * 1.1 + 5) * Math.max(1, 1.2 / aspect)
  const elev = 0.95
  const aerial = (tt: number): [number, number, number] => {
    const k = clamp01(tt / descentStart)
    const az = 0.62 - 0.28 * k
    const d = D * (1 - 0.1 * k)
    return [cx + d * Math.cos(elev) * Math.sin(az), d * Math.sin(elev), cz + d * Math.cos(elev) * Math.cos(az)]
  }
  if (t <= descentStart) return { pos: aerial(t), target: [cx, 0, cz] }

  const u = clamp01((t - descentStart) / (total - descentStart))
  const e = smootherstep(u)
  const p0 = aerial(descentStart)
  const { x: sx, z: sz, yaw } = layout.spawn
  // Control: sobre el punto medio, a media altura, para que la caída sea una curva y no una recta.
  const c: [number, number, number] = [lerp(p0[0], sx, 0.55), p0[1] * 0.5, lerp(p0[2], sz, 0.55)]
  const b = (i: 0 | 1 | 2, p2: number) => (1 - e) * (1 - e) * p0[i] + 2 * (1 - e) * e * c[i] + e * e * p2
  const pos: [number, number, number] = [b(0, sx), b(1, EYE), b(2, sz)]
  const ahead: [number, number, number] = [sx - Math.sin(yaw) * 8, EYE, sz - Math.cos(yaw) * 8]
  const k = e * e
  return {
    pos,
    target: [lerp(cx, ahead[0], k), lerp(0, ahead[1], k), lerp(cz, ahead[2], k)],
  }
}

/** Conduce la cámara durante la intro y le devuelve el control al jugador al terminar. */
export function IntroCamera({ layout }: { layout: PalaceLayout }) {
  const camera = useThree((s) => s.camera)
  const scene = useThree((s) => s.scene)
  const gl = useThree((s) => s.gl)
  const size = useThree((s) => s.size)
  const baseFog = useRef<{ near: number; far: number } | null>(null)
  const tmp = useMemo(() => new Vector3(), [])

  const place = () => {
    const tl = introState.timeline
    if (!tl) return
    const fog = scene.fog as Fog | null
    if (fog && !baseFog.current) baseFog.current = { near: fog.near, far: fog.far }
    const { pos, target } = introPose(layout, introState.t, tl.descentStart, tl.total, size.width / Math.max(1, size.height))
    camera.position.set(pos[0], pos[1], pos[2])
    camera.lookAt(tmp.set(target[0], target[1], target[2]))
    if (fog && baseFog.current) {
      // Desde arriba la niebla de sala taparía el palacio: se retira y vuelve durante el descenso.
      const f = clamp01((introState.t - tl.descentStart) / (tl.total - tl.descentStart))
      const k = smootherstep(f)
      fog.near = lerp(400, baseFog.current.near, k)
      fog.far = lerp(800, baseFog.current.far, k)
    }
  }

  const restore = () => {
    const fog = scene.fog as Fog | null
    if (fog && baseFog.current) {
      fog.near = baseFog.current.near
      fog.far = baseFog.current.far
    }
    camera.position.set(layout.spawn.x, EYE, layout.spawn.z)
    camera.rotation.order = 'YXZ'
    camera.rotation.set(0, layout.spawn.yaw, 0)
  }

  // Antes del primer pintado: la cámara ya está arriba y precalentamos shaders.
  useLayoutEffect(() => {
    if (introState.active) {
      place()
      try {
        // Pre-warming de shaders: compila materiales y sombras antes del primer frame
        // de movimiento para evitar el tirón inicial por shader compilation.
        gl.compile(scene, camera)
      } catch {
        // En entornos sin soporte WebGL (p. ej. tests) no bloquea.
      }
    }
    return () => {
      if (introState.active) restore()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useFrame((_, dt) => {
    const tl = introState.timeline
    if (!introState.active || !tl) return
    if (introState.frozenAt != null) introState.t = introState.frozenAt
    else {
      // Clampeo a 50ms para evitar saltos bruscos si el navegador pierde frames.
      const safeDt = Math.min(Math.max(0, dt), 0.05)
      introState.t = Math.min(tl.total, introState.t + safeDt)
    }
    if (introState.t >= tl.total) {
      restore()
      finishIntro()
      return
    }
    place()
  }, -100)

  return <IntroTitles layout={layout} />
}

/** Cada sala muestra su título en una placa flotante un instante, al levantarse. */
function IntroTitles({ layout }: { layout: PalaceLayout }) {
  const live = useIntro((s) => s.phase === 'playing' && !s.reduced)
  if (!live) return null
  return (
    <Suspense fallback={null}>
      {layout.rooms.map((r) => (
        <TitleFlash key={r.id} id={titleKey(r.id)} x={r.x} z={r.z} y={r.height + 2.2} title={r.title} />
      ))}
    </Suspense>
  )
}

function TitleFlash({ id, x, y, z, title }: { id: string; x: number; y: number; z: number; title: string }) {
  const ref = useRef<Group>(null)
  const tokens = DEFAULT_THEME.ui.tokens
  useFrame(() => {
    const g = ref.current
    const s = introState.timeline?.spans[id]
    if (!g || !s) return
    const u = (introState.t - s.start) / (s.end - s.start)
    // Entra en el primer cuarto y sale en el último.
    const k = u <= 0 || u >= 1 ? 0 : Math.min(1, u / 0.25, (1 - u) / 0.25)
    g.visible = k > 0.01
    g.scale.setScalar(Math.max(0.001, k))
  })
  return (
    <group ref={ref} position={[x, y, z]} visible={false}>
      <Billboard>
        <LabelPlate font={FONT_DISPLAY} fontSize={1.1} maxWidth={9} surface={tokens.surface} ink={tokens.ink} onTop>
          {title}
        </LabelPlate>
      </Billboard>
    </group>
  )
}
