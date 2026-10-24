import { Billboard } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { Suspense, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { DioramaKind } from '@mus3o/shared'
import type { Centerpiece as CenterpieceSpec } from '../palace/centerpiece'
import type { RoomLayout } from '../palace/layout'
import { buildProp } from '../diorama/props'
import { useIntro } from '../intro/store'
import type { Theme } from '../theme'
import { LabelPlate } from './LabelPlate'

const FONT_BODY = '/fonts/HankenGrotesk.ttf'

// --- Geometría -----------------------------------------------------------------------------------

/** Solo posición y normal: lo que necesita el yeso. Permite fundir piezas de orígenes distintos. */
function plain(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const src = g.index ? g.toNonIndexed() : g.clone()
  const out = new THREE.BufferGeometry()
  out.setAttribute('position', src.getAttribute('position'))
  if (!src.getAttribute('normal')) src.computeVertexNormals()
  out.setAttribute('normal', src.getAttribute('normal'))
  return out
}

const box = (w: number, h: number, d: number, x: number, y: number, z: number) =>
  plain(new THREE.BoxGeometry(w, h, d).translate(x, y + h / 2, z))
const cyl = (rt: number, rb: number, h: number, seg: number, x: number, y: number, z: number) =>
  plain(new THREE.CylinderGeometry(rt, rb, h, seg).translate(x, y + h / 2, z))

type Fit = {
  /** Altura máxima (m). */
  h: number
  /** Medio ancho máximo en x y z (tras girar). */
  fx: number
  fz: number
  /** Si gira, el radio máximo desde el eje (para que no roce nada al girar). */
  radial?: number
  rotY?: number
}

/** Un prop de la biblioteca de dioramas, ajustado a un tamaño: centrado en x/z y apoyado en y=0. */
function fitted(kind: DioramaKind, seed: number, fit: Fit, at: [number, number, number], pose?: 'standing' | 'pointing', organ?: string): THREE.BufferGeometry {
  const built = buildProp(kind, {
    accent: '#ffffff',
    ground: '#ffffff',
    seed,
    terrain: 'plain',
    pose,
    prop: { kind, organ } as never,
  }, 0)
  const g = plain(built.geometry)
  if (fit.rotY) g.rotateY(fit.rotY)
  g.computeBoundingBox()
  const bb = g.boundingBox!
  const cx = (bb.min.x + bb.max.x) / 2
  const cz = (bb.min.z + bb.max.z) / 2
  g.translate(-cx, -bb.min.y, -cz)
  const pos = g.getAttribute('position')
  let maxR = 0
  for (let i = 0; i < pos.count; i++) maxR = Math.max(maxR, Math.hypot(pos.getX(i), pos.getZ(i)))
  const ex = (bb.max.x - bb.min.x) / 2
  const ez = (bb.max.z - bb.min.z) / 2
  const hh = bb.max.y - bb.min.y
  let s = Math.min(fit.h / hh, fit.fx / Math.max(ex, 1e-3), fit.fz / Math.max(ez, 1e-3))
  if (fit.radial) s = Math.min(s, fit.radial / Math.max(maxR, 1e-3))
  g.scale(s, s, s)
  g.translate(at[0], at[1], at[2])
  return g
}

const merge = (parts: THREE.BufferGeometry[]) => mergeGeometries(parts, false)!

type Built = { base: THREE.BufferGeometry; top?: { geometry: THREE.BufferGeometry; y: number } }

/** Todas las piezas del centro. `base` es estática; `top` (si lo hay) gira despacio sobre su plinto. */
export function buildCenterpieceGeometry(cp: CenterpieceSpec, seed: number): Built {
  switch (cp.kind) {
    case 'statue': {
      const base = [box(1.35, 0.25, 1.35, 0, 0, 0), box(0.9, 1.3, 0.9, 0, 0.25, 0), box(1.1, 0.12, 1.1, 0, 1.55, 0)]
      const fig = fitted('figure', seed, { h: 2.2, fx: 0.6, fz: 0.6 }, [0, 1.67, 0], cp.pose ?? 'standing')
      return { base: merge([...base, fig]) }
    }
    case 'battle': {
      const parts = [
        box(2.7, 0.2, 1.6, 0, 0, 0),
        box(2.5, 0.2, 1.4, 0, 0.2, 0),
        fitted('cannon', seed, { h: 1.3, fx: 0.95, fz: 0.6, rotY: Math.PI / 2 }, [0.5, 0.4, 0], undefined),
        // obelisco: base, fuste y punta
        box(0.55, 0.3, 0.55, -0.95, 0.4, 0),
        cyl(0.11, 0.21, 2.1, 4, -0.95, 0.7, 0),
        cyl(0.0, 0.11, 0.3, 4, -0.95, 2.8, 0),
      ]
      return { base: merge(parts) }
    }
    case 'tribune': {
      const colH = 2.5
      const parts = [
        box(3.0, 0.2, 1.4, 0, 0, 0),
        fitted('column', seed, { h: colH, fx: 0.4, fz: 0.4 }, [-1.05, 0.2, 0]),
        fitted('column', seed, { h: colH, fx: 0.4, fz: 0.4 }, [1.05, 0.2, 0]),
        box(2.9, 0.22, 0.8, 0, 0.2 + colH, 0),
        // atril: fuste y plano inclinado
        box(0.8, 1.0, 0.45, 0, 0.2, 0.1),
        plain(new THREE.BoxGeometry(0.95, 0.07, 0.6).rotateX(-0.35).translate(0, 1.27, 0.1)),
      ]
      return { base: merge(parts) }
    }
    case 'organ': {
      const base = merge([cyl(0.62, 0.72, 0.8, 12, 0, 0, 0), cyl(0.78, 0.78, 0.1, 12, 0, 0.8, 0)])
      const g = fitted('organ', seed, { h: 2.0, fx: 1.0, fz: 1.0, radial: 1.0 }, [0, 0, 0], undefined, cp.organ ?? 'heart')
      return { base, top: { geometry: g, y: 0.9 } }
    }
    case 'nucleus':
    case 'mitochondrion':
    case 'neuron': {
      const base = merge([cyl(0.62, 0.72, 0.6, 12, 0, 0, 0), cyl(0.78, 0.78, 0.1, 12, 0, 0.6, 0)])
      const r = cp.kind === 'neuron' ? 1.5 : 1.2
      const g = fitted(cp.kind, seed, { h: 2.1, fx: r, fz: r, radial: r }, [0, 0, 0])
      return { base, top: { geometry: g, y: 0.7 } }
    }
    case 'ship': {
      const parts = [
        box(3.0, 0.25, 1.2, 0, 0, 0),
        box(2.7, 0.3, 0.9, 0, 0.25, 0),
        fitted('ship', seed, { h: 2.2, fx: 1.25, fz: 0.4, rotY: Math.PI / 2 }, [0, 0.55, 0]),
      ]
      return { base: merge(parts) }
    }
    case 'temple': {
      const parts = [cyl(1.2, 1.25, 0.3, 14, 0, 0, 0), fitted('church', seed, { h: 2.4, fx: 1.0, fz: 1.0 }, [0, 0.3, 0])]
      return { base: merge(parts) }
    }
    case 'rock': {
      const parts = [cyl(1.1, 1.15, 0.18, 12, 0, 0, 0), fitted('rock', seed, { h: 1.9, fx: 1.0, fz: 1.0 }, [0, 0.18, 0])]
      return { base: merge(parts) }
    }
    case 'tree': {
      const parts = [cyl(1.25, 1.3, 0.18, 12, 0, 0, 0), fitted('tree', seed, { h: 2.9, fx: 1.4, fz: 1.4 }, [0, 0.18, 0])]
      return { base: merge(parts) }
    }
  }
}

// --- Componente ----------------------------------------------------------------------------------

/**
 * Pieza central de la sala: figura, monumento o modelo de yeso blanco sobre un plinto, según el
 * tema. Una o dos mallas por sala; solo el órgano o la célula giran. Sin luces propias.
 */
export function Centerpiece({ room, theme }: { room: RoomLayout; theme: Theme }) {
  const cp = room.centerpiece
  const isIntroPlaying = useIntro((s) => s.phase === 'playing')
  const spin = useRef<THREE.Mesh>(null)

  const built = useMemo(() => (cp ? buildCenterpieceGeometry(cp, room.index * 7919 + 13) : null), [cp, room.index])
  useFrame((_, dt) => {
    if (spin.current) spin.current.rotation.y += dt * 0.25
  })
  if (!cp || !built) return null

  const plaster = (
    <meshStandardMaterial color={theme.scene.object.color} roughness={theme.scene.object.roughness} flatShading />
  )
  const tokens = theme.ui.tokens
  return (
    <group position={[room.x, 0, room.z]}>
      <mesh geometry={built.base} castShadow receiveShadow>
        {plaster}
      </mesh>
      {built.top && (
        <mesh ref={spin} geometry={built.top.geometry} position={[0, built.top.y, 0]} castShadow receiveShadow>
          {plaster}
        </mesh>
      )}
      {!isIntroPlaying && (
        <Suspense fallback={null}>
          <Billboard position={[0, 0.5, cp.footprint[1] / 2 + 0.45]}>
            <LabelPlate font={FONT_BODY} fontSize={0.13} maxWidth={2.4} surface={tokens.surface} ink={tokens.ink} opacity={0.9}>
              {room.title}
            </LabelPlate>
          </Billboard>
        </Suspense>
      )}
    </group>
  )
}
