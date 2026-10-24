import type { Part } from '@mus3o/shared'
import type { DioramaKind } from '@mus3o/shared'
import { Builder, mat } from '../geo'
import { buildFigure } from './figure'
import { buildFlag } from './flag'
import { buildHorse, buildRider } from './horse'
import { buildRock, buildTree } from './nature'
import { buildArch, buildCampfire, buildCannon, buildChurch, buildColumn, buildHouse, buildShip, buildTent } from './structures'
import { buildScienceProp, SCIENCE_VARIED } from './science' // science-kit
import type { Built, PropCtx } from './common'

export type { Built, PropCtx } from './common'

// Mismas cotas que scene/ProceduralModel: ningún modelo del LLM puede generar geometría enorme.
const size = (v: number | undefined, d: number) => Math.min(Math.max(v ?? d, 0.01), 4)
const segs = (v: number | undefined, d: number) => Math.min(Math.max(Math.round(v ?? d), 3), 24)

export function buildCustom(parts: Part[]): Built {
  const b = new Builder()
  let top = 0
  for (const p of parts) {
    const a = p.args
    const m = mat(p.pos[0], p.pos[1], p.pos[2], p.rot[0], p.rot[1], p.rot[2])
    const o = { color: p.color }
    switch (p.shape) {
      case 'box':
        b.box(size(a[0], 1), size(a[1], 1), size(a[2], 1), m, o)
        top = Math.max(top, p.pos[1] + size(a[1], 1) / 2)
        break
      case 'cylinder':
        b.cyl(size(a[0], 0.5), size(a[1], 0.5), size(a[2], 1), segs(a[3], 8), m, o)
        top = Math.max(top, p.pos[1] + size(a[2], 1) / 2)
        break
      case 'sphere':
        b.sph(size(a[0], 0.5), m, o, segs(a[1], 8), segs(a[2], 6))
        top = Math.max(top, p.pos[1] + size(a[0], 0.5))
        break
      case 'cone':
        b.cone(size(a[0], 0.5), size(a[1], 1), segs(a[2], 8), m, o)
        top = Math.max(top, p.pos[1] + size(a[1], 1) / 2)
        break
    }
  }
  return { geometry: b.build(), radius: 0.6, height: Math.max(1, top), motion: 'none' }
}

/** Cuántas variantes de geometría merecen la pena según el tipo y la cantidad. */
export function variantsFor(kind: DioramaKind, count: number): number {
  const varied: DioramaKind[] = ['figure', 'rider', 'horse', 'tree', 'rock', 'house', 'column']
  if (!varied.includes(kind) && !(SCIENCE_VARIED as readonly DioramaKind[]).includes(kind)) return 1 // science-kit
  return count >= 7 ? 3 : count >= 3 ? 2 : 1
}

export function buildProp(kind: DioramaKind, ctx: PropCtx, variant: number, parts?: Part[]): Built {
  switch (kind) {
    case 'figure':
      return buildFigure(ctx, variant)
    case 'rider':
      return buildRider(ctx, variant)
    case 'horse':
      return buildHorse(ctx, variant)
    case 'flag':
      return buildFlag(ctx, variant)
    case 'cannon':
      return buildCannon(ctx)
    case 'tree':
      return buildTree(ctx, variant)
    case 'rock':
      return buildRock(ctx, variant)
    case 'tent':
      return buildTent(ctx)
    case 'house':
      return buildHouse(ctx, variant)
    case 'church':
      return buildChurch(ctx)
    case 'ship':
      return buildShip(ctx)
    case 'column':
      return buildColumn(ctx, variant)
    case 'arch':
      return buildArch(ctx)
    case 'campfire':
      return buildCampfire(ctx)
    case 'custom':
      return buildCustom(parts ?? [])
    default:
      return buildScienceProp(kind, ctx, variant) // science-kit
  }
}
