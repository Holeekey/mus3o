import { useGLTF } from '@react-three/drei'
import { Component, type ReactNode, Suspense, useMemo } from 'react'
import { computeModelFit } from './modelBounds'

class ModelBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

function Model({ url }: { url: string }) {
  const { scene } = useGLTF(url)
  // Clon propio normalizado: centra en X/Z y apoya la base en y = 0
  const { clone, fit } = useMemo(() => {
    const c = scene.clone(true)
    const f = computeModelFit(c, 0.7)
    return { clone: c, fit: f }
  }, [scene])

  return (
    <group position={fit.offset} scale={fit.scale}>
      <primitive object={clone} />
    </group>
  )
}

/**
 * Modelo 3D externo normalizado (~0,7 m, base en y = 0, centrado en X/Z). Mientras carga o si falla (red, .glb roto)
 * se dibuja `fallback`: el glifo o modelo procedural de siempre.
 */
export function DynamicTotem({ url, fallback }: { url: string; fallback: ReactNode }) {
  return (
    <ModelBoundary fallback={fallback}>
      <Suspense fallback={fallback}>
        <Model url={url} />
      </Suspense>
    </ModelBoundary>
  )
}
