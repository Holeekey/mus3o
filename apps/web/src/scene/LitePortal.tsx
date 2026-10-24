import { addEffect, createPortal, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, type ReactNode } from 'react'
import * as THREE from 'three'
import { perfFlags } from './PerfOverlay'

/**
 * Ventana a otra escena (el diorama visto por un cuadro). Sustituye a drei <MeshPortalMaterial>, que
 * dibuja el diorama cada frame mientras el plano esté en el frustum, a pantalla completa y con MSAA x8,
 * aunque el cuadro lo tape por completo o se vea desde el otro lado del muro.
 *
 * Aquí el diorama solo se dibuja si el jugador está a menos de `renderRange`, delante del plano, y el
 * plano está dentro del frustum; solo uno a la vez (el más cercano); a menos resolución que la pantalla
 * y cada 2 frames cuando está lejos. La textura se muestrea en coordenadas de pantalla, igual que drei.
 */

const VERT = /* glsl */ `
  void main() {
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const FRAG = /* glsl */ `
  uniform sampler2D map;
  uniform vec2 resolution;
  void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;
    vec4 t = texture2D(map, uv);
    gl_FragColor = vec4(t.rgb, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

const FBO_SCALE = 0.75 // resolución del diorama respecto a la pantalla
const MAX_DPR = 1.5

// Un solo render target compartido: nunca se dibuja más de un portal por frame. Vive mientras viva la
// página (un target a ~75 % de la pantalla); se recrea si el contexto WebGL cambia.
const shared: { fbo: THREE.WebGLRenderTarget | null; last: string } = { fbo: null, last: '' }
function getSharedFbo() {
  if (!shared.fbo) {
    shared.fbo = new THREE.WebGLRenderTarget(2, 2, { samples: 4, type: THREE.HalfFloatType, depthBuffer: true, generateMipmaps: false })
  }
  return shared.fbo
}

// Número de frame (lo avanza r3f antes de llamar a los useFrame): sirve de sello para el arbitraje.
let frameNo = 0
addEffect(() => {
  frameNo++
  return true
})

// Arbitraje entre portales: en cada frame solo dibuja el más cercano de los candidatos.
const arbiter = { stamp: -1, bestId: '', bestDist: Infinity }

export type LitePortalProps = {
  id: string
  width: number
  height: number
  /** Más lejos que esto no se dibuja el diorama (el cuadro opaco ya lo tapa). */
  renderRange: number
  /** Más lejos que esto se dibuja cada 2 frames. */
  halfRateRange?: number
  /** Si es false no se dibuja (p. ej. el jugador está dentro del diorama). */
  enabled?: boolean
  /** Contenido del diorama (incluye su <color attach="background"> y <fog>). */
  children: ReactNode
}

export function LitePortal({ id, width, height, renderRange, halfRateRange = 4.5, enabled = true, children }: LitePortalProps) {
  const mesh = useRef<THREE.Mesh>(null)
  const gl = useThree((s) => s.gl)
  const size = useThree((s) => s.size)
  const dpr = useThree((s) => s.viewport.dpr)
  const vScene = useMemo(() => {
    const s = new THREE.Scene()
    s.matrixAutoUpdate = false // la matriz del mundo la copia del plano en cada frame
    return s
  }, [])
  const fbo = useMemo(getSharedFbo, [])
  const uniforms = useMemo(() => ({ map: { value: fbo.texture as THREE.Texture | null }, resolution: { value: new THREE.Vector2(1, 1) } }), [fbo])
  const ready = useRef(false)
  const tick = useRef(0)
  const frustum = useMemo(() => new THREE.Frustum(), [])
  const pv = useMemo(() => new THREE.Matrix4(), [])
  const sphere = useMemo(() => new THREE.Sphere(), [])
  const c = useMemo(() => new THREE.Vector3(), [])
  const n = useMemo(() => new THREE.Vector3(), [])
  const rel = useMemo(() => new THREE.Vector3(), [])
  const dist = useRef(Infinity)
  const eligible = useRef(false)

  useEffect(() => {
    const dp = Math.min(dpr, MAX_DPR)
    fbo.setSize(Math.max(2, Math.round(size.width * dp * FBO_SCALE)), Math.max(2, Math.round(size.height * dp * FBO_SCALE)))
    uniforms.resolution.value.set(size.width * dpr, size.height * dpr)
  }, [fbo, uniforms, size.width, size.height, dpr])

  useEffect(
    () => () => {
      if (arbiter.bestId === id) arbiter.bestId = ''
    },
    [id],
  )

  // Compila los shaders del diorama sin bloquear el hilo (KHR_parallel_shader_compile); hasta entonces no se dibuja.
  const camera = useThree((s) => s.camera)
  useEffect(() => {
    let dead = false
    ready.current = false
    const t = window.setTimeout(() => {
      gl.compileAsync(vScene, camera)
        .catch(() => {})
        .then(() => {
          if (!dead) ready.current = true
        })
    }, 0)
    return () => {
      dead = true
      window.clearTimeout(t)
    }
  }, [gl, vScene, camera])

  // Fase A: ¿puede dibujarse este portal? Se registra como candidato con su distancia.
  useFrame((state) => {
    eligible.current = false
    const m = mesh.current
    if (!m || !enabled || !ready.current) return
    m.updateWorldMatrix(true, false)
    c.setFromMatrixPosition(m.matrixWorld)
    n.set(0, 0, 1).transformDirection(m.matrixWorld)
    const cam = state.camera
    rel.copy(cam.position).sub(c)
    const d = rel.length()
    dist.current = d
    if (d > renderRange) return
    if (rel.dot(n) < 0.02) return // por detrás del muro
    pv.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse)
    frustum.setFromProjectionMatrix(pv)
    sphere.set(c, Math.hypot(width, height) / 2)
    if (!frustum.intersectsSphere(sphere)) return
    eligible.current = true
    const stamp = frameNo
    if (arbiter.stamp !== stamp) {
      arbiter.stamp = stamp
      arbiter.bestDist = Infinity
      arbiter.bestId = ''
    }
    if (d < arbiter.bestDist) {
      arbiter.bestDist = d
      arbiter.bestId = id
    }
  }, -5)

  // Fase B: dibuja el diorama en la textura si este portal ganó el arbitraje.
  useFrame((state) => {
    const m = mesh.current
    if (!m) return
    const go = eligible.current && arbiter.bestId === id && arbiter.stamp === frameNo
    if (!go) {
      m.visible = false // el cuadro opaco ya lo tapa: no se rasteriza ni el plano
      tick.current = 0
      return
    }
    m.visible = true
    perfFlags.portalLast = performance.now()
    tick.current++
    if (dist.current > halfRateRange && tick.current % 2 === 0 && shared.last === id) return // textura anterior: sigue visible
    shared.last = id
    vScene.matrixWorld.copy(m.matrixWorld)
    const prevTarget = gl.getRenderTarget()
    const prevClear = gl.autoClear
    gl.autoClear = true
    gl.setRenderTarget(fbo)
    gl.render(vScene, state.camera)
    gl.setRenderTarget(prevTarget)
    gl.autoClear = prevClear
  })

  return (
    <>
      <mesh ref={mesh} visible={false}>
        <planeGeometry args={[width, height]} />
        <shaderMaterial vertexShader={VERT} fragmentShader={FRAG} uniforms={uniforms} />
      </mesh>
      {createPortal(children, vScene)}
    </>
  )
}
