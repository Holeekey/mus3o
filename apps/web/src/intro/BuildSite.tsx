import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import type { GridHelper, Material } from 'three'
import { STREAM_MAX_BOUNDS } from '../palace/layout'
import { DEFAULT_THEME } from '../theme'
import { introState } from './store'

const SIZE = 220
const DIVISIONS = 44
const BASE_OPACITY = 0.22

/**
 * El solar de la obra: una retícula tenue sobre el suelo mientras la cámara aérea espera y sigue las salas
 * que llegan. Se desvanece cuando empieza el descenso. No participa de colisiones ni de la luz.
 */
export function BuildSite() {
  const ref = useRef<GridHelper>(null)
  const { minX, maxX, minZ, maxZ } = STREAM_MAX_BOUNDS
  const ink = DEFAULT_THEME.ui.tokens.ink

  useFrame(() => {
    const grid = ref.current
    const tl = introState.timeline
    if (!grid) return
    const flying = introState.mode === 'build' && introState.active && !!tl
    // 1 hasta que empieza el descenso; luego se apaga con él.
    const descent = tl && Number.isFinite(tl.descentStart) ? Math.min(1, Math.max(0, (introState.t - tl.descentStart) / 0.8)) : 0
    const k = flying ? 1 - descent : 0
    grid.visible = k > 0.01
    const material = grid.material as Material
    material.opacity = BASE_OPACITY * k
  })

  return (
    <gridHelper
      ref={ref}
      args={[SIZE, DIVISIONS, ink, ink]}
      position={[(minX + maxX) / 2, -0.04, (minZ + maxZ) / 2]}
      material-transparent
      material-opacity={BASE_OPACITY}
      material-depthWrite={false}
    />
  )
}
