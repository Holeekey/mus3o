import { Text } from '@react-three/drei'
import { useState, type ReactNode } from 'react'

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
}

// Placa legible sobre cualquier pared: el fondo se ajusta al tamaño real del texto
// (medido por troika al componer) y lleva borde y sombra dura, como las fichas de la UI.
export function LabelPlate({ children, font, fontSize, maxWidth, surface, ink, opacity = 1, padding }: Props) {
  const [bounds, setBounds] = useState<Bounds | null>(null)
  const pad = padding ?? fontSize * 0.45
  const transparent = opacity < 1

  // Hasta que troika mida el texto, se estima su caja para que el fondo exista desde el primer frame.
  const text = typeof children === 'string' ? children : String(children ?? '')
  const estW = Math.min(text.length * fontSize * 0.55, maxWidth ?? Infinity)
  const estLines = maxWidth ? Math.max(1, Math.ceil((text.length * fontSize * 0.55) / maxWidth)) : 1
  const estH = estLines * fontSize * 1.2
  const box: Bounds = bounds ?? [-estW / 2, -estH / 2, estW / 2, estH / 2]

  let plate: ReactNode = null
  if (text) {
    const [x0, y0, x1, y1] = box
    const w = x1 - x0 + pad * 2
    const h = y1 - y0 + pad * 2
    const cx = (x0 + x1) / 2
    const cy = (y0 + y1) / 2
    const border = fontSize * 0.08
    const shadow = fontSize * 0.14
    plate = (
      <group position={[cx, cy, 0]}>
        {/* Sombra dura desplazada, sin desenfoque */}
        <mesh position={[shadow, -shadow, -0.006]} renderOrder={1}>
          <planeGeometry args={[w + border * 2, h + border * 2]} />
          <meshBasicMaterial color={ink} transparent={transparent} opacity={opacity * 0.9} depthWrite={false} />
        </mesh>
        {/* Borde de tinta */}
        <mesh position={[0, 0, -0.004]} renderOrder={2}>
          <planeGeometry args={[w + border * 2, h + border * 2]} />
          <meshBasicMaterial color={ink} transparent={transparent} opacity={opacity} depthWrite={false} />
        </mesh>
        {/* Yeso */}
        <mesh position={[0, 0, -0.002]} renderOrder={3}>
          <planeGeometry args={[w, h]} />
          <meshBasicMaterial color={surface} transparent={transparent} opacity={opacity} depthWrite={false} />
        </mesh>
      </group>
    )
  }

  return (
    <group>
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
        renderOrder={4}
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
