import { Text } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import * as THREE from 'three'

type Bounds = [number, number, number, number] // minX, minY, maxX, maxY

type Props = {
  children: ReactNode
  font: string
  fontSize: number
  maxWidth?: number
  /** Fondo de la placa (yeso), tinta del texto y del borde. */
  surface: string
  ink: string
  /** Opacidad de toda la placa: permite atenuar lo olvidado sin perder legibilidad. */
  opacity?: number
  padding?: number
  /** Se dibuja siempre encima de la escena (rótulos de dioramas, que no deben taparse con los props). */
  onTop?: boolean
  /** Más lejos que esto (m) la placa no se dibuja: ni plano ni texto (cada etiqueta lejana cuesta draw calls). */
  cullDistance?: number
}

// Las tres capas de la placa (sombra dura, borde, yeso) van en una sola malla con color por vértice.
function plateGeometry(box: Bounds, pad: number, border: number, shadow: number, ink: string, surface: string): THREE.BufferGeometry {
  const [x0, y0, x1, y1] = box
  const cx = (x0 + x1) / 2
  const cy = (y0 + y1) / 2
  const w = x1 - x0 + pad * 2
  const h = y1 - y0 + pad * 2
  const layers: [number, number, number, number, string, number][] = [
    // centro x, centro y, ancho, alto, color, alfa
    [cx + shadow, cy - shadow, w + border * 2, h + border * 2, ink, 0.9],
    [cx, cy, w + border * 2, h + border * 2, ink, 1],
    [cx, cy, w, h, surface, 1],
  ]
  const pos: number[] = []
  const col: number[] = []
  const idx: number[] = []
  const c = new THREE.Color()
  layers.forEach(([lx, ly, lw, lh, color, a], i) => {
    c.set(color)
    for (const [dx, dy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      pos.push(lx + (dx * lw) / 2, ly + (dy * lh) / 2, -0.002)
      col.push(c.r, c.g, c.b, a)
    }
    const o = i * 4
    idx.push(o, o + 1, o + 2, o, o + 2, o + 3)
  })
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 4))
  g.setIndex(idx)
  return g
}

// Placa legible sobre cualquier pared: el fondo se ajusta al tamaño real del texto
// (medido por troika al componer) y lleva borde y sombra dura, como las fichas de la UI.
export function LabelPlate({ children, font, fontSize, maxWidth, surface, ink, opacity = 1, padding, onTop = false, cullDistance = Infinity }: Props) {
  const [bounds, setBounds] = useState<Bounds | null>(null)
  const pad = padding ?? fontSize * 0.45
  const transparent = opacity < 1 || onTop
  const ro = onTop ? 100 : 0
  const depthTest = !onTop

  // Hasta que troika mida el texto, se estima su caja para que el fondo exista desde el primer frame.
  const text = typeof children === 'string' ? children : String(children ?? '')
  const estW = Math.min(text.length * fontSize * 0.55, maxWidth ?? Infinity)
  const estLines = maxWidth ? Math.max(1, Math.ceil((text.length * fontSize * 0.55) / maxWidth)) : 1
  const estH = estLines * fontSize * 1.2
  const box: Bounds = bounds ?? [-estW / 2, -estH / 2, estW / 2, estH / 2]

  const [x0, y0, x1, y1] = box
  const border = fontSize * 0.08
  const shadow = fontSize * 0.14
  const geo = useMemo(
    () => (text ? plateGeometry([x0, y0, x1, y1], pad, border, shadow, ink, surface) : null),
    [text, x0, y0, x1, y1, pad, border, shadow, ink, surface],
  )
  useEffect(() => () => geo?.dispose(), [geo])

  // Etiquetas lejanas: se ocultan (la comprobación es barata y no ocurre en todos los frames).
  const root = useRef<THREE.Group>(null)
  const phase = useRef(Math.floor(Math.random() * 6))
  const wp = useMemo(() => new THREE.Vector3(), [])
  useFrame((state) => {
    if (cullDistance === Infinity || !root.current) return
    if (phase.current++ % 6 !== 0) return
    root.current.getWorldPosition(wp)
    root.current.visible = wp.distanceToSquared(state.camera.position) < cullDistance * cullDistance
  })

  const plate: ReactNode = geo ? (
    <mesh geometry={geo} renderOrder={ro + 1}>
      <meshBasicMaterial vertexColors transparent={transparent} opacity={opacity} depthWrite={false} depthTest={depthTest} />
    </mesh>
  ) : null

  return (
    <group ref={root}>
      {plate}
      <Text
        font={font}
        fontSize={fontSize}
        maxWidth={maxWidth}
        textAlign="center"
        anchorX="center"
        anchorY="middle"
        color={ink}
        fillOpacity={opacity}
        renderOrder={ro + 4}
        material-depthTest={depthTest}
        onSync={(troika: { textRenderInfo?: { blockBounds?: number[] } }) => {
          const b = troika.textRenderInfo?.blockBounds
          if (b && b.length === 4) {
            const next = b as Bounds
            setBounds((prev) => (prev && prev.every((v, i) => Math.abs(v - next[i]) < 1e-4) ? prev : next))
          }
        }}
      >
        {children}
      </Text>
    </group>
  )
}
