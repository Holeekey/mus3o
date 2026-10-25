import { lazy, Suspense } from 'react'
import type { PalaceLayout } from '../palace/layout'
import { useVr } from './runtime'
import { VrRuntime } from './VrRuntime'

// WebXR (@react-three/xr) solo se descarga en dispositivos que lo soportan.
const XrBridge = lazy(() => import('./XrBridge'))

/** Punto de entrada del modo VR dentro del Canvas. Solo se monta si el dispositivo ofrece algún camino. */
export default function VrScene({ layout }: { layout: PalaceLayout }) {
  const available = useVr((s) => s.available)
  if (available === 'xr') {
    return (
      <Suspense fallback={null}>
        <XrBridge>
          <VrRuntime layout={layout} />
        </XrBridge>
      </Suspense>
    )
  }
  return <VrRuntime layout={layout} />
}
