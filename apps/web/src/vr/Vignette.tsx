import { useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { comfortView } from './comfort'
import { vrRuntime } from './runtime'

// Viñeta de comodidad: una placa grande y transparente delante de la cabeza con los bordes oscuros. Va en la escena
// (no en el DOM) para que salga igual en cada ojo, en cardboard y en WebXR, y pasa por la corrección de lente.
const DIST = 1.5
const HALF = 3.2

const vert = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`
const frag = /* glsl */ `
uniform float strength;
varying vec2 vUv;
void main(){
  float r = length(vUv - 0.5) * 2.0; // 1 = borde de la placa (tan = HALF/DIST)
  float a = smoothstep(0.26, 0.55, r) * strength;
  gl_FragColor = vec4(0.0, 0.0, 0.0, a);
}`

export function Vignette() {
  const camera = useThree((s) => s.camera)
  const mesh = useRef<THREE.Mesh>(null)
  const mat = useMemo(
    () => new THREE.ShaderMaterial({ vertexShader: vert, fragmentShader: frag, uniforms: { strength: { value: 0 } }, transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide }),
    [],
  )
  const p = useMemo(() => new THREE.Vector3(), [])
  const d = useMemo(() => new THREE.Vector3(), [])
  const q = useMemo(() => new THREE.Quaternion(), [])
  useFrame(() => {
    const m = mesh.current
    if (!m) return
    const v = comfortView.vignette
    m.visible = vrRuntime.active && v > 0.01
    if (!m.visible) return
    mat.uniforms.strength.value = v
    camera.getWorldPosition(p)
    camera.getWorldQuaternion(q)
    d.set(0, 0, -DIST).applyQuaternion(q)
    m.position.copy(p).add(d)
    m.quaternion.copy(q)
  }, 2)
  return (
    <mesh ref={mesh} visible={false} renderOrder={1500} frustumCulled={false} material={mat}>
      <planeGeometry args={[HALF * 2, HALF * 2]} />
    </mesh>
  )
}
