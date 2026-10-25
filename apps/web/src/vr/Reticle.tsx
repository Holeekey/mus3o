import { Text } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { Suspense, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { dioramaFx } from '../diorama/dioramaStore'
import { useVr, vrRuntime } from './runtime'
import { gazeView } from './view'

const FONT = '/fonts/HankenGrotesk.ttf'

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
// Anillo que se llena en sentido horario desde las 12 (progreso del "dwell") y un punto central.
const FRAG = /* glsl */ `
  varying vec2 vUv;
  uniform float progress;
  uniform vec3 color;
  void main() {
    vec2 p = vUv - 0.5;
    float r = length(p) * 2.0;
    float a = atan(p.x, p.y);
    if (a < 0.0) a += 6.2831853;
    float on = step(a / 6.2831853, progress);
    float ring = smoothstep(0.62, 0.68, r) * (1.0 - smoothstep(0.94, 1.0, r));
    float dotc = 1.0 - smoothstep(0.09, 0.14, r);
    float alpha = ring * mix(0.4, 1.0, on) + dotc * 0.9;
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(mix(vec3(1.0), color, on), alpha);
  }
`

/** Retícula en el centro de la vista con el anillo de permanencia y el texto de lo que pasará. */
export function Reticle() {
  const camera = useThree((s) => s.camera)
  const group = useRef<THREE.Group>(null)
  const hint = useVr((s) => s.hint)
  const uniforms = useMemo(() => ({ progress: { value: 0 }, color: { value: new THREE.Color('#7cffb0') } }), [])
  const fwd = useMemo(() => new THREE.Vector3(), [])
  const pos = useMemo(() => new THREE.Vector3(), [])

  // Prioridad 2: después de la lógica y la mirada de VrRuntime (1) y antes de dibujar (3).
  useFrame(() => {
    const g = group.current
    if (!g) return
    g.visible = vrRuntime.active
    if (!vrRuntime.active) return
    camera.getWorldPosition(pos)
    camera.getWorldDirection(fwd)
    const d = gazeView.dist
    g.position.copy(pos).addScaledVector(fwd, d)
    g.quaternion.copy(camera.quaternion)
    g.scale.setScalar(d * 0.05)
    uniforms.progress.value = gazeView.progress
  }, 2)

  return (
    <group ref={group} visible={false} renderOrder={1000}>
      <mesh renderOrder={1000} frustumCulled={false}>
        <planeGeometry args={[1, 1]} />
        <shaderMaterial vertexShader={VERT} fragmentShader={FRAG} uniforms={uniforms} transparent depthTest={false} depthWrite={false} />
      </mesh>
      {hint && (
        <Suspense fallback={null}>
          <Text
            font={FONT}
            fontSize={1.0}
            position={[0, -1.05, 0]}
            anchorY="top"
            anchorX="center"
            maxWidth={18}
            textAlign="center"
            color="#ffffff"
            outlineWidth={0.09}
            outlineColor="#000000"
            renderOrder={1001}
            frustumCulled={false}
            material-depthTest={false}
            material-depthWrite={false}
            material-toneMapped={false}
          >
            {hint}
          </Text>
        </Suspense>
      )}
    </group>
  )
}

/** Disco en el suelo donde caerás al mantener la mirada (rojo si no se puede ir). */
export function FloorMarker() {
  const group = useRef<THREE.Group>(null)
  const ring = useRef<THREE.MeshBasicMaterial>(null)
  const good = useMemo(() => new THREE.Color('#7cffb0'), [])
  const bad = useMemo(() => new THREE.Color('#ff6b5b'), [])
  useFrame(() => {
    const g = group.current
    if (!g) return
    const f = gazeView.floor
    g.visible = vrRuntime.active && f.show
    if (!g.visible) return
    g.position.set(f.x, f.y + 0.03, f.z)
    ring.current?.color.copy(f.valid ? good : bad)
    const s = 1 + gazeView.progress * 0.25
    g.scale.set(s, s, s)
  }, 2)
  return (
    <group ref={group} visible={false}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={20}>
        <ringGeometry args={[0.26, 0.34, 40]} />
        <meshBasicMaterial ref={ring} color="#7cffb0" transparent opacity={0.9} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={19}>
        <circleGeometry args={[0.26, 32]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.16} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  )
}

/** Velo de color alrededor de la cabeza: negro al teletransportar, el del cuadro al entrar o salir de un diorama. */
export function Veil() {
  const camera = useThree((s) => s.camera)
  const mesh = useRef<THREE.Mesh>(null)
  const mat = useRef<THREE.MeshBasicMaterial>(null)
  const tmp = useMemo(() => new THREE.Vector3(), [])
  const black = useMemo(() => new THREE.Color('#000000'), [])
  const tint = useMemo(() => new THREE.Color(), [])
  useFrame(() => {
    const m = mesh.current
    const material = mat.current
    if (!m || !material) return
    const own = vrRuntime.fade
    const dio = dioramaFx.fade
    const a = Math.max(own, dio)
    m.visible = vrRuntime.active && a > 0.003
    if (!m.visible) return
    camera.getWorldPosition(tmp)
    m.position.copy(tmp)
    material.opacity = a
    material.color.copy(own >= dio ? black : tint.set(dioramaFx.color))
  }, 2)
  return (
    <mesh ref={mesh} visible={false} renderOrder={2000} frustumCulled={false}>
      <sphereGeometry args={[0.6, 16, 12]} />
      <meshBasicMaterial ref={mat} color="#000000" transparent side={THREE.BackSide} depthTest={false} depthWrite={false} toneMapped={false} />
    </mesh>
  )
}
