import { useFrame, useLoader } from '@react-three/fiber'
import { Suspense, useEffect, useMemo, useRef } from 'react'
import { ExtrudeGeometry, type Group } from 'three'
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js'

const LOGO_URL = '/brand.svg'
// Ancho del logotipo en metros (el SVG mide 311 x 72 unidades).
const LOGO_W = 1.8
// Grosor del extruido, en unidades del SVG (~8 cm a esta escala).
const LOGO_DEPTH = 14
const PEDESTAL_H = 1
const PEDESTAL_TOP = PEDESTAL_H + 0.06
// Aire entre la losa del pedestal y la base de las letras.
const LOGO_GAP = 0.12
const SPIN = 0.35 // rad/s

/** Letras del SVG extruidas y centradas en su origen (en unidades del SVG, con Y hacia abajo). */
function useLogoGeometry() {
  const data = useLoader(SVGLoader, LOGO_URL)
  const geometry = useMemo(() => {
    const shapes = data.paths.flatMap((p) => SVGLoader.createShapes(p))
    const g = new ExtrudeGeometry(shapes, {
      depth: LOGO_DEPTH,
      curveSegments: 8,
      bevelEnabled: true,
      bevelThickness: 1.5,
      bevelSize: 1,
      bevelSegments: 2,
    })
    g.center()
    g.computeBoundingBox()
    return g
  }, [data])
  useEffect(() => () => geometry.dispose(), [geometry])
  return geometry
}

function Wordmark({ color }: { color: string }) {
  const geometry = useLogoGeometry()
  const ref = useRef<Group>(null)
  const box = geometry.boundingBox!
  const s = LOGO_W / (box.max.x - box.min.x)
  const h = (box.max.y - box.min.y) * s
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * SPIN
  })
  return (
    <group ref={ref} position={[0, PEDESTAL_TOP + LOGO_GAP + h / 2, 0]}>
      {/* Escala Y negativa: el SVG crece hacia abajo; three invierte el winding solo al ver el determinante negativo. */}
      <mesh geometry={geometry} scale={[s, -s, s]} castShadow receiveShadow>
        <meshStandardMaterial color={color} roughness={0.45} metalness={0.15} />
      </mesh>
    </group>
  )
}

/** Escultura central del lobby: el logotipo del proyecto de pie sobre un pedestal, girando lento. */
export function LogoSculpture({
  x,
  z,
  color,
  pedestalColor,
}: {
  x: number
  z: number
  color: string
  pedestalColor: string
}) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, PEDESTAL_H / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.62, 0.72, PEDESTAL_H, 24]} />
        <meshStandardMaterial color={pedestalColor} roughness={0.9} flatShading />
      </mesh>
      <mesh position={[0, PEDESTAL_H + 0.03, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.76, 0.76, 0.06, 24]} />
        <meshStandardMaterial color={pedestalColor} roughness={0.9} flatShading />
      </mesh>
      {/* El pedestal se ve de inmediato; el logotipo aparece cuando llega el SVG. */}
      <Suspense fallback={null}>
        <Wordmark color={color} />
      </Suspense>
    </group>
  )
}
