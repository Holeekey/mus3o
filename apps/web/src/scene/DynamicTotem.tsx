import { Center, Resize, useGLTF } from '@react-three/drei'
import { Component, type ReactNode, Suspense, useMemo } from 'react'

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
  // Clon propio: varias piezas pueden compartir el mismo .glb sin mutarse entre sí.
  const clone = useMemo(() => scene.clone(true), [scene])
  return (
    <Resize scale={0.7}>
      <Center bottom>
        <primitive object={clone} />
      </Center>
    </Resize>
  )
}

/**
 * Modelo 3D externo normalizado (~0,7 m, base en y = 0). Mientras carga o si falla (red, .glb roto)
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
