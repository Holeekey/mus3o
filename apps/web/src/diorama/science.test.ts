import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { atmosphereOf } from './atmosphere'
import { BLOOD_CELLS, KINDS, ORGANS, TERRAINS, VALVE_TYPES, parseDiorama } from '@mus3o/shared'
import { layoutDiorama } from './layout'
import { CELULA, CELULA_PIECES, CORAZON, CORAZON_PIECES, NEURONA, NEURONA_PIECES, NUCLEO_POS } from './medicina'
import { getDioramaModel } from './model'
import { medicinaMuseum } from '../mocks/medicina'
import { buildProp } from './props'
import { buildOrgan, buildValve } from './props/science/anatomy'
import { buildDnaHelix, buildGolgi, cisterna } from './props/science/cell'
import { SCIENCE_KINDS, SCIENCE_HEIGHT } from './props/science'
import { BEAT, PHASE0, blob, flip, heartPhase, signedVolume, thump, valveOpenness } from './props/science/util'
import { heightField, buildTerrainGeometry } from './terrain'
import { SCIENCE_TERRAINS, isScienceTerrain } from './terrain/science'

const ctx = { accent: '#ecd2a6', ground: '#b4514b', seed: 4242, terrain: 'organic' as const }
const hash = (g: THREE.BufferGeometry) => {
  const a = g.getAttribute('position').array as Float32Array
  let h = 0
  for (let i = 0; i < a.length; i += 7) h = (Math.imul(h, 31) + Math.round(a[i] * 1000)) | 0
  return h
}
const bbox = (g: THREE.BufferGeometry) => {
  g.computeBoundingBox()
  return g.boundingBox!.getSize(new THREE.Vector3())
}

describe('contrato del kit de ciencia', () => {
  it('todos los tipos y terrenos nuevos están en el contrato', () => {
    for (const k of SCIENCE_KINDS) expect(KINDS).toContain(k)
    for (const t of SCIENCE_TERRAINS) expect(TERRAINS).toContain(t)
    expect(SCIENCE_KINDS).toHaveLength(19)
    expect(isScienceTerrain('organic') && isScienceTerrain('cellular') && isScienceTerrain('vessel')).toBe(true)
    expect(isScienceTerrain('hills')).toBe(false)
  })

  it('acepta los parámetros por tipo y los acota', () => {
    const d = parseDiorama({
      props: [
        { kind: 'heart-chamber-valve', valveType: 'mitral', pos: [0, 0], y: 999 },
        { kind: 'organ', organ: 'brain', pos: [1, 1] },
        { kind: 'blood-cell', cell: 'platelet', pos: [0, 0], count: 5, flow: { path: [[0, 1, 0], [50, 99, -50]], speed: 99, gate: 5 } },
      ],
    })
    expect(d.props).toHaveLength(3)
    expect(d.props[0]).toMatchObject({ valveType: 'mitral', y: 24 })
    expect(d.props[1].organ).toBe('brain')
    expect(d.props[2].cell).toBe('platelet')
    expect(d.props[2].flow!.path[1]).toEqual([40, 30, -40])
    expect(d.props[2].flow!.speed).toBe(8)
    expect(d.props[2].flow!.gate).toBeCloseTo(0.98)
  })

  it('ignora con gracia los parámetros inválidos o desconocidos', () => {
    const d = parseDiorama({
      props: [
        { kind: 'heart-chamber-valve', valveType: 'dragon', pos: [0, 0], y: 'alto', inventado: 1 },
        { kind: 'organ', organ: 'wing', pos: [0, 0] },
        { kind: 'blood-cell', cell: 'azul', pos: [0, 0], flow: { path: [[0, 0, 0]] } },
        { kind: 'blood-cell', pos: [0, 0], flow: 'rápido' },
        { kind: 'sirena', pos: [0, 0] },
      ],
    })
    expect(d.props).toHaveLength(4) // 'sirena' se descarta; el resto sobrevive sin sus campos inválidos
    expect(d.props[0].valveType).toBeUndefined()
    expect(d.props[0].y).toBe(0)
    expect(d.props[1].organ).toBeUndefined()
    expect(d.props[2].cell).toBeUndefined()
    expect(d.props[2].flow).toBeUndefined()
    expect(d.props[3].flow).toBeUndefined()
    expect(parseDiorama({ terrain: 'organic', props: [] }).terrain).toBe('organic')
  })

  it('los valores del contrato están documentados', () => {
    expect(VALVE_TYPES).toEqual(['tricuspid', 'mitral', 'pulmonary', 'aortic'])
    expect(ORGANS).toEqual(['heart', 'lung', 'kidney', 'brain', 'liver'])
    expect(BLOOD_CELLS).toEqual(['red', 'white', 'platelet'])
  })
})

describe('generación determinista de props científicos', () => {
  it.each(SCIENCE_KINDS)('%s: misma semilla = misma geometría, finita y con presupuesto', (kind) => {
    const a = buildProp(kind, ctx, 0)
    const b = buildProp(kind, ctx, 0)
    expect(hash(a.geometry)).toBe(hash(b.geometry))
    const pos = a.geometry.getAttribute('position')
    expect(pos.count / 3).toBeLessThan(13_000)
    for (let i = 0; i < pos.count; i++) expect(Number.isFinite(pos.getX(i) + pos.getY(i) + pos.getZ(i))).toBe(true)
    const s = bbox(a.geometry)
    expect(Math.max(s.x, s.y, s.z)).toBeLessThan(40)
    expect(SCIENCE_HEIGHT[kind]).toBeGreaterThan(0)
    if (a.science?.shader) expect(a.geometry.getAttribute('aAnim').count).toBe(pos.count)
  }, 20_000)

  it('la semilla y la variante cambian los orgánulos con variantes', () => {
    for (const kind of ['mitochondrion', 'ribosome', 'vesicle'] as const) {
      const v0 = buildProp(kind, ctx, 0)
      const v1 = buildProp(kind, ctx, 1)
      const other = buildProp(kind, { ...ctx, seed: 7 }, 0)
      expect(hash(v0.geometry)).not.toBe(hash(v1.geometry))
      expect(hash(v0.geometry)).not.toBe(hash(other.geometry))
    }
  })

  it('la válvula mitral tiene dos valvas y las demás tres', () => {
    const tri = buildValve({ ...ctx, prop: parseDiorama({ props: [{ kind: 'heart-chamber-valve', valveType: 'tricuspid', pos: [0, 0] }] }).props[0] })
    const mit = buildValve({ ...ctx, prop: parseDiorama({ props: [{ kind: 'heart-chamber-valve', valveType: 'mitral', pos: [0, 0] }] }).props[0] })
    const leafVerts = (g: THREE.BufferGeometry) => {
      const an = g.getAttribute('aAnim')
      let n = 0
      for (let i = 0; i < an.count; i++) if (an.getX(i) === 1) n++
      return n
    }
    expect(leafVerts(tri.geometry) / leafVerts(mit.geometry)).toBeCloseTo(1.5, 1)
    expect(tri.science!.shader).toBe(true)
  })

  it('los cinco órganos son distintos entre sí', () => {
    const hashes = ORGANS.map((organ) => hash(buildOrgan({ ...ctx, prop: parseDiorama({ props: [{ kind: 'organ', organ, pos: [0, 0] }] }).props[0] }).geometry))
    expect(new Set(hashes).size).toBe(5)
  })

  it('un blood-cell con flow se dibuja solo desde el overlay y conserva el recorrido', () => {
    const prop = parseDiorama({ props: [{ kind: 'blood-cell', pos: [0, 0], count: 4, spread: 2, flow: { path: [[-5, 2, 0], [5, 2, 0]], speed: 3, gate: 0.5 } }] }).props[0]
    const b = buildProp('blood-cell', { ...ctx, prop }, 0)
    expect(b.science).toMatchObject({ dynamicOnly: true, flow: { speed: 3, gate: 0.5, radius: 2 } })
    expect(b.science!.flow!.path).toHaveLength(2)
    expect(buildProp('blood-cell', ctx, 0).science).toBeUndefined()
  })

  it('el nodo marcapasos emite ondas y la neurona un impulso', () => {
    expect(buildProp('node-pacemaker', ctx, 0).science?.pulse).toBeDefined()
    const imp = buildProp('neuron', ctx, 0).science?.impulse
    expect(imp!.points.length).toBeGreaterThan(5)
  })

  it('las mallas cerradas miran hacia fuera (volumen positivo) y flip las invierte', () => {
    const sph = blob(2, () => 1)
    expect(signedVolume(sph)).toBeGreaterThan(0)
    expect(signedVolume(flip(sph))).toBeLessThan(0)
    const red = buildProp('blood-cell', { ...ctx, prop: parseDiorama({ props: [{ kind: 'blood-cell', cell: 'red', pos: [0, 0] }] }).props[0] }, 0)
    expect(signedVolume(red.geometry)).toBeGreaterThan(0)
  })
})

describe('latido', () => {
  it('la válvula se cierra en la sístole, se abre en la diástole y arranca abierta si se congela', () => {
    expect(BEAT).toBeCloseTo(60 / 70)
    expect(valveOpenness(0)).toBe(0)
    expect(valveOpenness(0.2)).toBe(0)
    expect(valveOpenness(0.7)).toBe(1)
    expect(valveOpenness(1)).toBeCloseTo(0, 5)
    expect(valveOpenness(heartPhase(0))).toBe(1) // prefers-reduced-motion: time = 0
    expect(heartPhase(0)).toBeCloseTo(PHASE0)
    expect(heartPhase(BEAT)).toBeCloseTo(PHASE0)
  })

  it('"lub" y "dub" son picos y hay silencio entre ellos', () => {
    expect(thump(0.03)).toBeGreaterThan(0.9)
    expect(thump(0.4)).toBeGreaterThan(0.5)
    expect(thump(0.7)).toBeLessThan(0.01)
  })
})

describe('entornos de interior', () => {
  it.each(SCIENCE_TERRAINS)('%s: suelo finito y jugable, malla cerrada y determinista', (terrain) => {
    const f = heightField(terrain, 123)
    for (const [x, z] of [[0, 4], [0, 10.6], [-13, -13], [13, 13], [60, 60]]) expect(Number.isFinite(f.heightAt(x, z))).toBe(true)
    expect(Math.abs(f.heightAt(0, 4))).toBeLessThan(1)
    expect(f.waterLevel).toBeNull()
    const a = buildTerrainGeometry(terrain, '#b4514b', '#ecd2a6', 'x')
    const b = buildTerrainGeometry(terrain, '#b4514b', '#ecd2a6', 'x')
    expect(hash(a.geometry)).toBe(hash(b.geometry))
    expect(a.geometry.getAttribute('position').count / 3).toBeLessThan(160_000)
    expect(a.geometry.getAttribute('color').count).toBe(a.geometry.getAttribute('position').count)
  })

  it('la cavidad orgánica tiene muros que suben y un techo', () => {
    const f = heightField('organic', 5)
    expect(f.heightAt(14.5, -6)).toBeGreaterThan(f.heightAt(0, -6) + 2)
    const { geometry } = buildTerrainGeometry('organic', '#b4514b', '#ecd2a6', 'x')
    geometry.computeBoundingBox()
    expect(geometry.boundingBox!.max.y).toBeGreaterThan(14)
  })

  it('el interior no depende de la hora del día', () => {
    const p = { ground: '#b4514b', sky: '#4a1a21', accent: '#ecd2a6' }
    for (const terrain of SCIENCE_TERRAINS) {
      const day = atmosphereOf({ time: 'day', palette: p, terrain })
      const night = atmosphereOf({ time: 'night', palette: p, terrain })
      expect(day).toEqual(night)
      expect(day.fogFar).toBeGreaterThan(day.fogNear)
      expect(day.clouds || day.stars).toBe(false)
      expect(day.fog).toBe(p.sky)
    }
    expect(atmosphereOf({ time: 'night', palette: p }).stars).toBe(true) // el exterior sigue igual
  })
})

describe('layout con elevación', () => {
  it('prop.y eleva las instancias y las etiquetas', () => {
    const d = parseDiorama({ terrain: 'cellular', props: [{ kind: 'atp', pos: [0, 0], y: 5, label: 'ATP', pieceId: 'a' }] })
    const lay = layoutDiorama(d, heightField('cellular', 1))
    expect(lay.placed[0].instances[0].y).toBeGreaterThan(4.9)
    expect(lay.linked[0].labelY).toBeGreaterThan(lay.linked[0].y)
  })

  it('el núcleo bloquea el paso; la válvula y las células, no', () => {
    const d = parseDiorama({ terrain: 'cellular', props: [{ kind: 'nucleus', pos: [0, -10] }, { kind: 'blood-cell', pos: [0, 0], count: 3 }, { kind: 'heart-chamber-valve', pos: [0, 5] }] })
    const { colliders } = layoutDiorama(d, heightField('cellular', 1))
    expect(colliders).toHaveLength(1)
    expect(colliders[0].r).toBeGreaterThan(4)
  })
})

describe('demo ?demo=medicina', () => {
  const pieces = new Map(medicinaMuseum.rooms.flatMap((r) => r.pieces).map((p) => [p.id, p]))

  it('los tres dioramas conservan todos sus props tras validar', () => {
    expect(CORAZON.terrain).toBe('organic')
    expect(CELULA.terrain).toBe('cellular')
    expect(NEURONA.terrain).toBe('cellular')
    expect(CORAZON.props.length).toBeGreaterThanOrEqual(10)
    expect(CELULA.props.length).toBeGreaterThanOrEqual(10)
    for (const d of [CORAZON, CELULA, NEURONA]) expect(d.props.length).toBeLessThanOrEqual(24)
  })

  it('cada pieceId enlaza con una pieza del museo y cada pieza de las dos primeras salas tiene su prop', () => {
    for (const d of [CORAZON, CELULA, NEURONA]) for (const p of d.props) if (p.pieceId) expect(pieces.has(p.pieceId)).toBe(true)
    const linked = (d: typeof CORAZON) => d.props.filter((p) => p.pieceId).map((p) => p.pieceId)
    expect(linked(CORAZON).sort()).toEqual(Object.values(CORAZON_PIECES).sort())
    expect(linked(CELULA).sort()).toEqual(Object.values(CELULA_PIECES).sort())
    expect(linked(NEURONA).length).toBeGreaterThan(0)
    expect(Object.values(NEURONA_PIECES).every((id) => pieces.has(id))).toBe(true)
  })

  it('los textos son los hechos pedidos', () => {
    expect(pieces.get(CORAZON_PIECES.tricuspide)!.text).toBe('Separa la aurícula derecha del ventrículo derecho; tiene tres valvas.')
    expect(pieces.get(CORAZON_PIECES.nodo)!.text).toBe('Es el marcapasos natural del corazón; inicia cada latido.')
    expect(pieces.get(CELULA_PIECES.membrana)!.text).toBe('Bicapa de lípidos que controla qué entra y sale.')
    expect(medicinaMuseum.rooms.map((r) => r.imageSearch?.wikiTitle)).toEqual(['Corazón', 'Célula', 'Neurona'])
  })

  it('la sangre espera en la válvula: la puerta cae dentro del recorrido', () => {
    const flows = CORAZON.props.filter((p) => p.flow)
    expect(flows.length).toBeGreaterThanOrEqual(3)
    for (const p of flows) expect(p.flow!.gate).toBeGreaterThan(0.3)
  })

  it.each([
    ['corazón', CORAZON],
    ['célula', CELULA],
    ['neurona', NEURONA],
  ])('%s: se construye entera y respeta el presupuesto de draw calls', (_n, d) => {
    const m = getDioramaModel(d)
    // terreno + cielo + partículas + overlays + props: muy por debajo de 300 (y la sombra los repite)
    expect(m.groups.length).toBeLessThanOrEqual(40)
    const tris = m.groups.reduce((n, g) => n + g.built.geometry.getAttribute('position').count / 3, 0) + m.terrain.getAttribute('position').count / 3
    expect(tris).toBeLessThan(260_000)
    expect(m.atmo.clouds).toBe(false)
  }, 60_000)

  it('el ADN está dentro del núcleo, no flotando en el citoplasma', () => {
    const nucleus = CELULA.props.find((p) => p.kind === 'nucleus')!
    const dna = CELULA.props.filter((p) => p.kind === 'dna-helix')
    expect(dna.length).toBeGreaterThan(0)
    const R = 6 * nucleus.scale * 0.95 // radio interior de la envoltura (R = 6 m a escala 1)
    const cy = 6 * 0.92 * nucleus.scale
    const h = buildDnaHelix({ ...ctx, terrain: 'cellular' as const }).height
    for (const d of dna) {
      // todos los extremos de la hélice (arriba y abajo) caen dentro de la esfera nuclear
      for (const top of [0.2, h - 0.3]) {
        const dist = Math.hypot(d.pos[0] - nucleus.pos[0], d.y + top * d.scale - cy, d.pos[1] - nucleus.pos[1])
        expect(dist).toBeLessThan(R)
      }
    }
    expect(NUCLEO_POS).toEqual(nucleus.pos)
  })

  it('la célula está despejada: pocas moléculas sueltas y los cinco orgánulos a la vista', () => {
    const floating = CELULA.props.filter((p) => ['atp', 'vesicle'].includes(p.kind)).reduce((n, p) => n + p.count, 0)
    expect(floating).toBeLessThanOrEqual(6)
    const linked = CELULA.props.filter((p) => p.pieceId)
    expect(linked).toHaveLength(5)
    // desde el punto de aparición (0, 10,6, mirando a -z; FOV horizontal ≈ 96°) caen dentro del campo visual
    for (const p of linked) {
      const ang = Math.abs(Math.atan2(p.pos[0], 10.6 - p.pos[1]))
      expect(ang).toBeLessThan((46 * Math.PI) / 180)
    }
  })

  it('el Golgi son cisternas planas y curvas apiladas con vesículas', () => {
    const c = cisterna(3, 2.2, 0.17, 0.5, 0, 0)
    expect(signedVolume(c)).toBeGreaterThan(0)
    const s = bbox(c)
    expect(s.y).toBeLessThan(s.x * 0.35) // plana, no una bola
    const g = buildGolgi({ ...ctx, terrain: 'cellular' as const })
    const gs = bbox(g.geometry)
    expect(gs.y).toBeGreaterThan(3.5) // pila de seis
    expect(gs.y).toBeLessThan(g.height + 0.5)
  })

  it('el diorama nunca nombra el producto con el nombre antiguo', () => {
    const all = JSON.stringify([CORAZON, CELULA, NEURONA, medicinaMuseum])
    expect(all.toLowerCase()).not.toContain('locigen')
  })
})
