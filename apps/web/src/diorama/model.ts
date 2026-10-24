import type * as THREE from 'three'
import { atmosphereOf, type Atmosphere } from './atmosphere'
import type { Diorama } from './dioramaSchema'
import { layoutDiorama, type DioramaLayout } from './layout'
import { buildProp, type Built } from './props'
import { hashStr } from './random'
import { buildTerrainGeometry, type HeightField } from './terrain'

// Modelo de un diorama: geometrías ya construidas + colocación. Se comparte entre la
// ventana en miniatura (portal) y el mundo a escala real, así que se cachea por objeto.

export type PropGroup = { index: number; variant: number; built: Built; instances: DioramaLayout['placed'][number]['instances'] }

export type DioramaModel = {
  diorama: Diorama
  atmo: Atmosphere
  field: HeightField
  terrain: THREE.BufferGeometry
  layout: DioramaLayout
  groups: PropGroup[]
  seed: number
}

const cache = new WeakMap<Diorama, DioramaModel>()

export function getDioramaModel(d: Diorama): DioramaModel {
  const hit = cache.get(d)
  if (hit) return hit
  const seed = hashStr(d.title)
  const { geometry, field } = buildTerrainGeometry(d.terrain, d.palette.ground, d.palette.accent, d.title)
  const layout = layoutDiorama(d, field)
  const groups: PropGroup[] = []
  for (const pl of layout.placed) {
    for (let v = 0; v < pl.variants; v++) {
      const instances = pl.instances.filter((i) => i.variant === v)
      if (!instances.length) continue
      const built = buildProp(
        pl.prop.kind,
        {
          color: pl.prop.color,
          secondary: pl.prop.secondary,
          accent: d.palette.accent,
          ground: d.palette.ground,
          pose: pl.prop.pose,
          seed: seed + pl.index * 7919,
          terrain: d.terrain,
        },
        v,
        pl.prop.parts,
      )
      groups.push({ index: pl.index, variant: v, built, instances })
    }
  }
  const model: DioramaModel = { diorama: d, atmo: atmosphereOf(d), field, terrain: geometry, layout, groups, seed }
  cache.set(d, model)
  return model
}

/** Construye el modelo en un hueco libre del hilo principal, antes de que el jugador se acerque. */
export function warmDioramaModel(d: Diorama) {
  if (cache.has(d)) return () => {}
  const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (h: number) => void }
  if (w.requestIdleCallback) {
    const h = w.requestIdleCallback(() => getDioramaModel(d), { timeout: 2500 })
    return () => w.cancelIdleCallback?.(h)
  }
  const h = window.setTimeout(() => getDioramaModel(d), 600)
  return () => window.clearTimeout(h)
}
