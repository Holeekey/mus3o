import { beforeEach, describe, expect, it } from 'vitest'
import { Vector3 } from 'three'
import { atmosphereOf } from './atmosphere'
import { CARABOBO, CARABOBO_PIECES } from './carabobo'
import { dioramaRequest, handleDioramaKey, isDioramaActive, useDioramaStore } from './dioramaStore'
import { KINDS, TERRAINS, TIMES, parseDiorama } from './dioramaSchema'
import { layoutDiorama } from './layout'
import { getDioramaModel } from './model'
import { buildCustom, buildProp } from './props'
import { heightField } from './terrain'

const ctx = { accent: '#c8102e', ground: '#a39b58', seed: 1234, terrain: 'plain' as const }

describe('layoutDiorama', () => {
  const field = heightField('hills', 7)

  it('es determinista', () => {
    const a = layoutDiorama(CARABOBO, field)
    const b = layoutDiorama(CARABOBO, field)
    expect(a).toEqual(b)
  })

  it('coloca todas las instancias dentro del área jugable', () => {
    const { placed } = layoutDiorama(CARABOBO, field)
    for (const p of placed) {
      expect(p.instances).toHaveLength(p.prop.count)
      for (const i of p.instances) {
        expect(Math.abs(i.x)).toBeLessThanOrEqual(14)
        expect(Math.abs(i.z)).toBeLessThanOrEqual(14)
        expect(Number.isFinite(i.y)).toBe(true)
      }
    }
  })

  it('las formaciones no apilan figuras una sobre otra', () => {
    const troop = layoutDiorama(CARABOBO, field).placed.find((p) => p.prop.kind === 'figure' && p.prop.count === 15)!
    for (const [i, a] of troop.instances.entries())
      for (const b of troop.instances.slice(i + 1)) expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThan(0.5)
  })

  it('expone los props enlazados a conceptos', () => {
    const { linked } = layoutDiorama(CARABOBO, field)
    expect(linked.map((l) => l.pieceId).sort()).toEqual(Object.values(CARABOBO_PIECES).sort())
    expect(linked.every((l) => l.labelY > l.y)).toBe(true)
  })

  it('genera colisiones para árboles y cañones, no para tropas', () => {
    const d = parseDiorama({ props: [{ kind: 'tree', pos: [0, 0] }, { kind: 'cannon', pos: [3, 3] }, { kind: 'figure', pos: [-3, 3], count: 5 }] })
    const { colliders } = layoutDiorama(d, field)
    expect(colliders).toHaveLength(2)
  })
})

describe('biblioteca de props', () => {
  it.each(KINDS.filter((k) => k !== 'custom'))('%s produce geometría finita y acotada', (kind) => {
    const b = buildProp(kind, { ...ctx, pose: kind === 'rider' ? 'charging' : undefined }, 0)
    const pos = b.geometry.getAttribute('position')
    expect(pos.count).toBeGreaterThan(30)
    expect(pos.count % 3).toBe(0)
    expect(b.geometry.getAttribute('color').count).toBe(pos.count)
    expect(b.geometry.getAttribute('aWind').count).toBe(pos.count)
    for (let i = 0; i < pos.count; i++) expect(Number.isFinite(pos.getX(i) + pos.getY(i) + pos.getZ(i))).toBe(true)
    b.geometry.computeBoundingBox()
    const size = b.geometry.boundingBox!.getSize(new Vector3())
    expect(Math.max(size.x, size.y, size.z)).toBeLessThan(30)
    expect(pos.count).toBeLessThan(40_000) // presupuesto de triángulos por prop
  })

  it('cada pose de figura da una geometría distinta', () => {
    const sizes = (['standing', 'pointing', 'charging', 'fallen', 'seated', 'raising-arm'] as const).map((pose) => {
      const g = buildProp('figure', { ...ctx, pose }, 0).geometry
      g.computeBoundingBox()
      return `${g.boundingBox!.max.y.toFixed(2)}/${g.boundingBox!.max.z.toFixed(2)}`
    })
    expect(new Set(sizes).size).toBeGreaterThanOrEqual(4)
    // caído: casi a ras de suelo
    const fallen = buildProp('figure', { ...ctx, pose: 'fallen' }, 0).geometry
    fallen.computeBoundingBox()
    expect(fallen.boundingBox!.max.y).toBeLessThan(0.7)
  })

  it('custom acota medidas excesivas', () => {
    const b = buildCustom([{ shape: 'box', args: [999, 999, 999], pos: [0, 0, 0], rot: [0, 0, 0], color: '#112233' }])
    b.geometry.computeBoundingBox()
    expect(b.geometry.boundingBox!.max.x).toBeLessThanOrEqual(2.001)
  })
})

describe('terreno y atmósfera', () => {
  it.each(TERRAINS)('%s: alturas finitas y centro jugable razonable', (t) => {
    const f = heightField(t, 99)
    for (const [x, z] of [[0, 0], [10, -8], [-14, 14], [60, 60], [-90, -40]]) expect(Number.isFinite(f.heightAt(x, z))).toBe(true)
    expect(Math.abs(f.heightAt(0, 4))).toBeLessThan(2)
  })

  it('el río y la costa tienen agua; la llanura no', () => {
    expect(heightField('river', 1).waterLevel).not.toBeNull()
    expect(heightField('coast', 1).waterLevel).not.toBeNull()
    expect(heightField('plain', 1).waterLevel).toBeNull()
  })

  it.each(TIMES)('atmósfera %s completa', (time) => {
    const a = atmosphereOf({ time, palette: { ground: '#8a9a5b', sky: '#9fc4e8', accent: '#c9963a' } })
    expect(a.fogFar).toBeGreaterThan(a.fogNear)
    expect(a.sunIntensity).toBeGreaterThan(0)
    expect(a.skyTop).toMatch(/^#/)
  })

  it('un diorama de cada terreno y hora se construye entero', () => {
    for (const terrain of TERRAINS) {
      const d = parseDiorama({ title: `t-${terrain}`, terrain, time: 'night', props: [{ kind: 'ship', pos: [0, -10] }, { kind: 'house', pos: [4, 0] }, { kind: 'tree', pos: [-5, 2], count: 4 }] })
      const m = getDioramaModel(d)
      expect(m.groups.length).toBeGreaterThan(0)
    }
  }, 60_000)

  it('el diorama de Carabobo se construye y respeta el presupuesto de draw calls', () => {
    const m = getDioramaModel(CARABOBO)
    // terreno + cielo + nubes + hierba + props instanciados + etiquetas: muy por debajo de 300
    expect(m.groups.length).toBeLessThanOrEqual(60)
    const tris = m.groups.reduce((n, g) => n + g.built.geometry.getAttribute('position').count / 3, 0)
    expect(tris).toBeLessThan(120_000)
  })
})

describe('teclas del cuadro', () => {
  beforeEach(() => {
    useDioramaStore.setState({ phase: 'room', activeId: null, hintId: null })
    dioramaRequest.enter = null
    dioramaRequest.leave = false
  })

  it('E entra solo si hay un cuadro al alcance', () => {
    expect(handleDioramaKey('KeyE')).toBe(false)
    useDioramaStore.setState({ hintId: 'p1' })
    expect(handleDioramaKey('KeyE')).toBe(true)
    expect(dioramaRequest.enter).toBe('p1')
  })

  it('dentro, E no se consume (examina conceptos) y Q pide volver', () => {
    useDioramaStore.setState({ phase: 'inside' })
    expect(isDioramaActive()).toBe(true)
    expect(handleDioramaKey('KeyE')).toBe(false)
    expect(handleDioramaKey('KeyQ')).toBe(true)
    expect(dioramaRequest.leave).toBe(true)
  })

  it('durante las transiciones se ignora E', () => {
    useDioramaStore.setState({ phase: 'entering' })
    expect(handleDioramaKey('KeyE')).toBe(true)
    useDioramaStore.setState({ phase: 'leaving' })
    expect(handleDioramaKey('KeyE')).toBe(true)
  })

  it('en la sala, Q no hace nada', () => {
    expect(handleDioramaKey('KeyQ')).toBe(false)
  })
})
