import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/**
 * Marco de un cuadro (cuatro barras con su filete biselado) como UNA geometría: de 8 mallas, y sus
 * draw calls (y pasadas de sombra), a una. `ow`/`oh` es la abertura; la geometría está en el espacio
 * del grupo del cuadro, con el mismo `z` que tenían las barras sueltas.
 */
export function buildFrameGeometry(ow: number, oh: number, thickness: number, depth: number, wallZ: number): THREE.BufferGeometry {
  const bars: [number, number, number, number][] = [
    [0, oh / 2 + thickness / 2, ow + 2 * thickness, thickness],
    [0, -oh / 2 - thickness / 2, ow + 2 * thickness, thickness],
    [-ow / 2 - thickness / 2, 0, thickness, oh],
    [ow / 2 + thickness / 2, 0, thickness, oh],
  ]
  const parts: THREE.BufferGeometry[] = []
  for (const [x, y, bw, bh] of bars) {
    const z = wallZ + depth / 2
    const bar = new THREE.BoxGeometry(bw, bh, depth)
    bar.translate(x, y, z)
    parts.push(bar)
    // Filete biselado: una pestaña más delgada y saliente.
    const lip = new THREE.BoxGeometry(bw * (bw > bh ? 0.97 : 0.55), bh * (bw > bh ? 0.55 : 0.97), 0.02)
    lip.translate(x, y, z + depth / 2 + 0.01)
    parts.push(lip)
  }
  const merged = mergeGeometries(parts, false)
  for (const p of parts) p.dispose()
  return merged ?? new THREE.BufferGeometry()
}
