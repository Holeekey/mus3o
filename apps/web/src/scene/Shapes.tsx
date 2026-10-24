import type { MonumentType } from '@mus3o/shared'
import type { Monument, Shape } from '../palace/layout'

export type AnyMonument = Monument | MonumentType

// Geometrías con pocos segmentos + flatShading = estética low poly sin assets.
export function ShapeGeometry({ shape, size = 1 }: { shape: Shape | AnyMonument; size?: number }) {
  switch (shape) {
    case 'icosahedron':
      return <icosahedronGeometry args={[size, 0]} />
    case 'octahedron':
    case 'crystal':
      return <octahedronGeometry args={[size, 0]} />
    case 'dodecahedron':
      return <dodecahedronGeometry args={[size, 0]} />
    case 'tetrahedron':
      return <tetrahedronGeometry args={[size, 0]} />
    case 'torus':
    case 'ring_system':
      return <torusGeometry args={[size * 0.8, size * 0.3, 4, 8]} />
    case 'torusKnot':
      return <torusKnotGeometry args={[size * 0.7, size * 0.22, 48, 5]} />
    case 'cone':
      return <coneGeometry args={[size * 0.8, size * 1.6, 5]} />
    case 'box':
      return <boxGeometry args={[size * 1.2, size * 1.2, size * 1.2]} />
    case 'sphere':
      return <sphereGeometry args={[size, 7, 5]} />
  }
}
