import { useFrame } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { TimeUniform } from '../../material'
import type { DioramaModel, PropGroup } from '../../model'
import { mulberry32, range } from '../../random'
import { isScienceTerrain } from '../../terrain/science'
import { makeScienceMaterials } from './material'
import { heartPhase, TAU, valveOpenness } from './util'

// Todo lo animado de la biblioteca científica que no cabe en un InstancedMesh estático:
// circulación de células, ondas del marcapasos, impulso nervioso y partículas del medio.

const still = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** Material con animación en GPU (válvulas, ADN...), con el mismo plano de corte que el resto. */
export function useScienceMaterials(time: TimeUniform, clipping: THREE.Plane[] | null) {
  const mats = useMemo(() => makeScienceMaterials(time), [time])
  useLayoutEffect(() => {
    mats.material.clippingPlanes = clipping
    mats.material.needsUpdate = true
  }, [mats, clipping])
  useEffect(
    () => () => {
      mats.material.dispose()
      mats.depth.dispose()
    },
    [mats],
  )
  return mats
}

type Common = { time: TimeUniform; clipping: THREE.Plane[] | null }

// --- Circulación -----------------------------------------------------------------------------

const _m = new THREE.Matrix4()
const _q = new THREE.Quaternion()
const _e = new THREE.Euler()
const _p = new THREE.Vector3()
const _s = new THREE.Vector3()
const _t = new THREE.Vector3()
const _side = new THREE.Vector3()
const _up2 = new THREE.Vector3()
const UP = new THREE.Vector3(0, 1, 0)

function FlowCells({ group, material, depth, time }: { group: PropGroup; material: THREE.Material; depth: THREE.Material; time: TimeUniform }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const flow = group.built.science!.flow!
  const curve = useMemo(() => new THREE.CatmullRomCurve3(flow.path.map((p) => new THREE.Vector3(...p)), false, 'centripetal'), [flow])
  const len = useMemo(() => curve.getLength(), [curve])
  const n = group.instances.length
  const cells = useMemo(
    () =>
      group.instances.map((inst, k) => {
        const r = mulberry32(Math.floor(inst.phase * 1e6) + k * 977)
        const a = r() * TAU
        const rad = Math.sqrt(r()) * flow.radius
        return {
          s: ((k + 0.5) / n) * len + (r() - 0.5) * 0.6,
          ox: Math.cos(a) * rad,
          oy: Math.sin(a) * rad * 0.8,
          rx: r() * TAU,
          ry: r() * TAU,
          wx: range(r, -1.4, 1.4),
          wy: range(r, -1.2, 1.2),
          v: range(r, 0.85, 1.15),
          slot: (k % 6) * 0.5,
          scale: inst.scale,
        }
      }),
    [group, flow, len, n],
  )
  const frozen = useMemo(still, [])
  const gateS = flow.gate !== undefined ? flow.gate * len : -1

  const place = (dt: number) => {
    const mesh = ref.current
    if (!mesh) return
    const t = time.value
    const open = valveOpenness(heartPhase(t))
    const hold = gateS >= 0 && open < 0.4
    cells.forEach((c, k) => {
      if (!frozen && dt > 0) {
        let ds = dt * flow.speed * c.v * (0.7 + 0.5 * open)
        if (hold && c.s < gateS - 0.3 && c.s > gateS - 6) ds = Math.max(0, Math.min(ds, gateS - 0.8 - c.slot - c.s))
        c.s += ds
        if (c.s > len) c.s -= len
      }
      const u = Math.min(0.9999, Math.max(0, c.s / len))
      curve.getPointAt(u, _p)
      curve.getTangentAt(u, _t)
      _side.crossVectors(_t, UP)
      if (_side.lengthSq() < 1e-4) _side.set(1, 0, 0)
      _side.normalize()
      _up2.crossVectors(_side, _t).normalize()
      _p.addScaledVector(_side, c.ox).addScaledVector(_up2, c.oy)
      _e.set(c.rx + t * c.wx, c.ry + t * c.wy, 0)
      _q.setFromEuler(_e)
      const fade = Math.min(1, c.s / 1.4, (len - c.s) / 2.0) * c.scale
      _s.setScalar(Math.max(0.001, fade))
      _m.compose(_p, _q, _s)
      mesh.setMatrixAt(k, _m)
    })
    mesh.instanceMatrix.needsUpdate = true
  }
  useLayoutEffect(() => place(0), []) // eslint-disable-line react-hooks/exhaustive-deps
  useFrame((_, dt) => place(Math.min(dt, 0.05)))
  return <instancedMesh ref={ref} args={[group.built.geometry, material, n]} customDepthMaterial={depth as THREE.MeshDepthMaterial} castShadow receiveShadow frustumCulled={false} />
}

// --- Ondas del nodo sinusal --------------------------------------------------------------------

function PulseRings({ inst, y, clipping, time }: { inst: PropGroup['instances'][number]; y: number; clipping: THREE.Plane[] | null; time: TimeUniform }) {
  const meshes = useRef<(THREE.Mesh | null)[]>([])
  const geo = useMemo(() => new THREE.RingGeometry(0.88, 1, 48), [])
  const mats = useMemo(() => [0, 1, 2].map(() => new THREE.MeshBasicMaterial({ color: '#fff3cf', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, toneMapped: false })), [])
  useLayoutEffect(() => {
    for (const m of mats) {
      m.clippingPlanes = clipping
      m.needsUpdate = true
    }
  }, [mats, clipping])
  useEffect(
    () => () => {
      geo.dispose()
      for (const m of mats) m.dispose()
    },
    [geo, mats],
  )
  useFrame(() => {
    const p = heartPhase(time.value)
    meshes.current.forEach((m, r) => {
      if (!m) return
      // el nodo dispara justo antes del "lub"; cada anillo sale un poco después del anterior
      const tau = (((p - 0.9 - r * 0.07) % 1) + 1) % 1
      const s = tau / 0.55
      const alive = s < 1
      m.visible = alive
      if (alive) {
        m.scale.setScalar(0.35 + s * 3.6)
        mats[r].opacity = Math.pow(1 - s, 1.3) * 0.85
      }
    })
  })
  return (
    <group position={[inst.x, inst.y, inst.z]} rotation={[0, inst.rotY, 0]} scale={inst.scale}>
      {mats.map((mt, r) => (
        <mesh
          key={r}
          ref={(el) => {
            meshes.current[r] = el
          }}
          geometry={geo}
          material={mt}
          position={[0, y, 0.98]}
          renderOrder={5}
        />
      ))}
    </group>
  )
}

// --- Impulso nervioso -----------------------------------------------------------------------------

function ImpulseBead({ inst, spec, clipping, time }: { inst: PropGroup['instances'][number]; spec: NonNullable<NonNullable<PropGroup['built']['science']>['impulse']>; clipping: THREE.Plane[] | null; time: TimeUniform }) {
  const beads = useRef<(THREE.Mesh | null)[]>([])
  const curve = useMemo(() => new THREE.CatmullRomCurve3(spec.points), [spec])
  const len = useMemo(() => curve.getLength(), [curve])
  const geo = useMemo(() => new THREE.IcosahedronGeometry(1, 1), [])
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ffe27a', toneMapped: false }), [])
  useLayoutEffect(() => {
    mat.clippingPlanes = clipping
    mat.needsUpdate = true
  }, [mat, clipping])
  useEffect(
    () => () => {
      geo.dispose()
      mat.dispose()
    },
    [geo, mat],
  )
  useFrame(() => {
    const t = time.value
    // dos impulsos desfasados, cada uno con una pequeña cola de bolitas que se encogen
    beads.current.forEach((m, i) => {
      if (!m) return
      const pulse = Math.floor(i / 3)
      const tail = i % 3
      const u = (((t * spec.speed) / len + pulse * 0.5 + inst.phase * 0.1 - tail * 0.012) % 1 + 1) % 1
      curve.getPointAt(u, _p)
      m.position.copy(_p)
      const f = Math.min(1, u * 14, (1 - u) * 14)
      m.scale.setScalar(spec.radius * Math.max(0.001, f) * (1 - tail * 0.28))
    })
  })
  return (
    <group position={[inst.x, inst.y, inst.z]} rotation={[0, inst.rotY, 0]} scale={inst.scale}>
      {[0, 1, 2, 3, 4, 5].map((k) => (
        <mesh
          key={k}
          ref={(el) => {
            beads.current[k] = el
          }}
          geometry={geo}
          material={mat}
        />
      ))}
    </group>
  )
}

export function ScienceOverlay({ group, material, depth, time, clipping }: Common & { group: PropGroup; material: THREE.Material; depth: THREE.Material }) {
  const sci = group.built.science
  if (!sci) return null
  return (
    <>
      {sci.flow && <FlowCells group={group} material={material} depth={depth} time={time} />}
      {sci.pulse && group.instances.map((inst, i) => <PulseRings key={i} inst={inst} y={sci.pulse!.y} clipping={clipping} time={time} />)}
      {sci.impulse && group.instances.map((inst, i) => <ImpulseBead key={i} inst={inst} spec={sci.impulse!} clipping={clipping} time={time} />)}
    </>
  )
}

// --- Partículas del medio ----------------------------------------------------------------------------

/** Motas que derivan despacio: proteínas en el citoplasma, plasma en el vaso, restos en la cavidad. */
export function ScienceAmbient({ model, time, clipping }: Common & { model: DioramaModel }) {
  const terrain = model.diorama.terrain
  const mesh = useRef<THREE.InstancedMesh>(null)
  const spec = useMemo(() => {
    if (terrain === 'cellular') return { count: 260, box: [64, 26, 64] as const, y0: 1, size: [0.12, 0.5] as const, colors: ['#ffffff', '#e8d7ff', '#c9f0e2', '#ffe7b8'] }
    if (terrain === 'vessel') return { count: 160, box: [40, 30, 130] as const, y0: 1, size: [0.1, 0.4] as const, colors: ['#ffe6d6', '#ffcfc0', '#ffffff'] }
        return null
  }, [terrain])
  const data = useMemo(() => {
    if (!spec) return null
    const r = mulberry32(model.seed + 321)
    return Array.from({ length: spec.count }, () => ({
      x: (r() - 0.5) * spec.box[0],
      y: spec.y0 + r() * spec.box[1],
      z: (r() - 0.5) * spec.box[2] + (terrain === 'vessel' ? -25 : 0),
      vx: range(r, -0.25, 0.25),
      vy: range(r, -0.1, 0.12),
      vz: range(r, terrain === 'vessel' ? 0.5 : -0.25, terrain === 'vessel' ? 1.4 : 0.25),
      size: range(r, spec.size[0], spec.size[1]),
      rx: r() * TAU,
      ry: r() * TAU,
      c: Math.floor(r() * 4),
    }))
  }, [spec, model.seed, terrain])
  const frozen = useMemo(still, [])
  useLayoutEffect(() => {
    const m = mesh.current
    if (!m || !spec || !data) return
    const col = new THREE.Color()
    data.forEach((d, i) => m.setColorAt(i, col.set(spec.colors[d.c % spec.colors.length])))
    if (m.instanceColor) m.instanceColor.needsUpdate = true
  }, [spec, data])
  const wrap = (v: number, size: number) => ((((v + size / 2) % size) + size) % size) - size / 2
  const place = (t: number) => {
    const m = mesh.current
    if (!m || !spec || !data) return
    data.forEach((d, i) => {
      _p.set(wrap(d.x + d.vx * t, spec.box[0]), spec.y0 + wrap(d.y - spec.y0 - spec.box[1] / 2 + d.vy * t, spec.box[1]) + spec.box[1] / 2, wrap(d.z + d.vz * t + (terrain === 'vessel' ? 25 : 0), spec.box[2]) - (terrain === 'vessel' ? 25 : 0))
      _e.set(d.rx + t * 0.3, d.ry + t * 0.2, 0)
      _q.setFromEuler(_e)
      _s.setScalar(d.size)
      _m.compose(_p, _q, _s)
      m.setMatrixAt(i, _m)
    })
    m.instanceMatrix.needsUpdate = true
  }
  useLayoutEffect(() => place(0)) // eslint-disable-line react-hooks/exhaustive-deps
  useFrame(() => {
    if (!frozen) place(time.value)
  })
  const geo = useMemo(() => new THREE.IcosahedronGeometry(1, 0), [])
  useEffect(() => () => geo.dispose(), [geo])
  if (!spec || !isScienceTerrain(terrain)) return null
  return (
    <instancedMesh ref={mesh} args={[geo, undefined, spec.count]} frustumCulled={false}>
      <meshStandardMaterial flatShading roughness={1} clippingPlanes={clipping} />
    </instancedMesh>
  )
}

