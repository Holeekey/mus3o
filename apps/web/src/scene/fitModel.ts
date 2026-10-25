import type { Part } from '@mus3o/shared'

/**
 * Los modelos procedurales los dibuja la IA (o el respaldo) y su tamaño real varía: algunos quedan diminutos dentro de
 * su caja de ~2 m y otros se salen de ella. Esto calcula la escala y el desplazamiento que los dejan centrados en x/z,
 * apoyados en y = 0 y con su dimensión mayor igual a `target`, para que todo pedestal muestre un objeto legible.
 */
const size = (v: number | undefined, d: number) => Math.min(Math.max(v ?? d, 0.01), 4)

/** Medio tamaño del volumen que ocupa cada forma, con las mismas cotas con que se dibuja (ProceduralModel). */
function halfExtents(part: Part): [number, number, number] {
  const a = part.args
  switch (part.shape) {
    case 'box':
      return [size(a[0], 1) / 2, size(a[1], 1) / 2, size(a[2], 1) / 2]
    case 'cylinder': {
      const r = Math.max(size(a[0], 0.5), size(a[1], 0.5))
      return [r, size(a[2], 1) / 2, r]
    }
    case 'sphere': {
      const r = size(a[0], 0.5)
      return [r, r, r]
    }
    case 'cone': {
      const r = size(a[0], 0.5)
      return [r, size(a[1], 1) / 2, r]
    }
  }
}

/** Extremos (mín y máx en x, y, z) del conjunto de partes, con la rotación (Euler XYZ) de cada una. */
export function partsBounds(parts: Part[]): { min: [number, number, number]; max: [number, number, number] } | null {
  if (parts.length === 0) return null
  const min: [number, number, number] = [Infinity, Infinity, Infinity]
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity]
  for (const part of parts) {
    const [hx, hy, hz] = halfExtents(part)
    const [rx, ry, rz] = part.rot
    const [sx, cx, sy, cy, sz, cz] = [Math.sin(rx), Math.cos(rx), Math.sin(ry), Math.cos(ry), Math.sin(rz), Math.cos(rz)]
    // Matriz de rotación Euler XYZ (convención de three.js): R = Rx · Ry · Rz.
    const m = [
      [cy * cz, -cy * sz, sy],
      [cx * sz + sx * sy * cz, cx * cz - sx * sy * sz, -sx * cy],
      [sx * sz - cx * sy * cz, sx * cz + cx * sy * sz, cx * cy],
    ]
    // La caja rotada tiene, en cada eje, un semiancho igual a la suma de |fila · semiejes|.
    const ext = m.map((row) => Math.abs(row[0]) * hx + Math.abs(row[1]) * hy + Math.abs(row[2]) * hz)
    for (let i = 0; i < 3; i++) {
      min[i] = Math.min(min[i], part.pos[i] - ext[i])
      max[i] = Math.max(max[i], part.pos[i] + ext[i])
    }
  }
  return { min, max }
}

export type Fit = { scale: number; offset: [number, number, number] }

/** Escala y desplazamiento (aplicar primero la escala y luego el desplazamiento) que encajan el modelo en `target` metros. */
export function fitParts(parts: Part[], target = 2, maxScale = 4): Fit {
  const b = partsBounds(parts)
  if (!b) return { scale: 1, offset: [0, 0, 0] }
  const dims = [b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]]
  const biggest = Math.max(...dims, 1e-3)
  const scale = Math.min(target / biggest, maxScale)
  return {
    scale,
    offset: [-((b.min[0] + b.max[0]) / 2) * scale, -b.min[1] * scale, -((b.min[2] + b.max[2]) / 2) * scale],
  }
}
