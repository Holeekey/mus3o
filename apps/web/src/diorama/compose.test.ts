import { describe, expect, it } from 'vitest'
import { MAX_PROPS, parseDiorama, type Museum, type Room } from '@mus3o/shared'
import { attachComposedDioramas, classifyRoom, composeDiorama, ENTRY_Z, MAX_LINKED, MIN_LINK_SPACING, type Archetype } from './compose'
import { historiaMuseum } from '../mocks/historia'
import { medicinaMuseum } from '../mocks/medicina'
import { attachLibraryDioramas } from './library'
import { assignPaintings, buildLayout } from '../palace/layout'

const room = (name: string, titles: string[] = [], description = ''): Room => ({
  id: name,
  name,
  description,
  pieces: titles.map((t, i) => ({ id: `${name}-${i}`, title: t, text: 'Texto breve de la pieza.', fact: '' })),
})

const TABLE: [string, Archetype][] = [
  ['Batalla de Carabobo', 'battle'],
  ['Toma de la Bastilla', 'battle'],
  ['Guerra de Independencia', 'battle'],
  ['The Siege of Troy', 'battle'],
  ['Asamblea Nacional', 'assembly'],
  ['Congreso de Angostura', 'assembly'],
  ['Constitución y república', 'assembly'],
  ['Parliament and Treaty', 'assembly'],
  ['Flota y navegación', 'naval'],
  ['El puerto y el océano', 'naval'],
  ['Naval fleet', 'naval'],
  ['La Iglesia y la religión', 'sacred'],
  ['Catedral gótica', 'sacred'],
  ['Los Andes venezolanos', 'nature'],
  ['Clima y ecosistemas', 'nature'],
  ['Selva amazónica', 'nature'],
  ['Volcanes', 'nature'],
  ['La ciudad y el comercio', 'city'],
  ['Revolución industrial: industria y mercado', 'city'],
  ['La célula', 'cell'],
  ['Mitocondria y ADN', 'cell'],
  ['El corazón', 'organ'],
  ['Sistema circulatorio: sangre y arterias', 'organ'],
  ['La neurona y la sinapsis', 'neural'],
  ['Ilustración', 'abstract'],
  ['Arquitectura de computadoras', 'abstract'],
  ['Programación en Python', 'abstract'],
  ['Cálculo diferencial', 'abstract'],
  ['Gramática española', 'abstract'],
  ['Marzo y marcas', 'abstract'], // "mar" no casa como inicio de palabra
]

describe('classifyRoom', () => {
  it.each(TABLE)('%s -> %s', (name, arch) => {
    expect(classifyRoom(room(name))).toBe(arch)
  })

  it('uses description and piece titles when the name is silent', () => {
    expect(classifyRoom(room('Sala 3', ['Cañón', 'Soldado'], 'Una batalla y una guerra'))).toBe('battle')
    expect(classifyRoom(room('Sala 4', ['Cerebro', 'Corazón humano', 'Pulmón']))).toBe('organ')
  })

  it('never throws on odd rooms', () => {
    expect(classifyRoom({} as Room)).toBe('abstract')
    expect(classifyRoom({ name: undefined, description: null, pieces: [null, {}] } as unknown as Room)).toBe('abstract')
  })
})

const linkedOf = (d: ReturnType<typeof composeDiorama>) => d.props.filter((p) => p.pieceId)

describe('composeDiorama', () => {
  const samples: Room[] = [
    room('Toma de la Bastilla', ['Luis XVI', 'Camille Desmoulins', 'Los Inválidos', 'Cañones', 'Bandera real']),
    room('Asamblea Nacional', ['Declaración de Derechos', 'Abate Sieyès', 'Juramento del Juego de Pelota']),
    room('Ilustración', ['Razón', 'Voltaire', 'Enciclopedia', 'Contrato social', 'Libertad', 'Igualdad', 'Ciencia']),
    room('Arquitectura de computadoras', ['CPU', 'Memoria', 'Bus', 'Caché', 'Registros', 'ALU', 'Pipeline', 'GPU', 'E/S', 'Reloj', 'Interrupciones', 'DMA']),
    room('Los Andes', ['Pico Bolívar', 'Páramo', 'Frailejón']),
    room('Flota y navegación', ['Cristóbal Colón', 'La Niña', 'Brújula', 'Carabela']),
    room('Catedral', ['San Pedro', 'Nave central', 'Vitral']),
    room('La célula', ['Núcleo', 'Mitocondria', 'ADN', 'Ribosoma', 'Membrana celular']),
    room('El corazón', ['Válvula mitral', 'Aurícula', 'Ventrículo izquierdo']),
    room('La neurona', ['Dendritas', 'Axón', 'Sinapsis']),
    room('La ciudad', ['Mercado', 'Plaza mayor', 'Alexander von Humboldt']),
    room('Vacía', []),
  ]

  it.each(samples.map((r) => [r.name, r] as const))('is deterministic and valid: %s', (_n, r) => {
    const a = composeDiorama(r, 'Museo', 7)
    const b = composeDiorama(structuredClone(r), 'Museo', 7)
    expect(a).toEqual(b)
    expect(parseDiorama(a)).toEqual(a)
    expect(a.props.length).toBeLessThanOrEqual(MAX_PROPS)
    if (r.pieces.length > 0) expect(a.props.length).toBeGreaterThan(r.pieces.length) // hay ambiente, no solo enlaces
  })

  it.each(samples.map((r) => [r.name, r] as const))('links every piece exactly once: %s', (_n, r) => {
    const d = composeDiorama(r, 'Museo', 1)
    const ids = linkedOf(d).map((p) => p.pieceId)
    expect(ids.sort()).toEqual(r.pieces.slice(0, MAX_LINKED).map((p) => p.id).sort())
    for (const p of linkedOf(d)) expect(p.label && p.label.length).toBeLessThanOrEqual(40)
  })

  it.each(samples.map((r) => [r.name, r] as const))('keeps the entry area clear and linked props apart: %s', (_n, r) => {
    const d = composeDiorama(r, 'Museo', 3)
    for (const p of d.props) expect(p.pos[1] + p.spread).toBeLessThanOrEqual(ENTRY_Z)
    const l = linkedOf(d)
    for (let i = 0; i < l.length; i++) {
      for (let j = i + 1; j < l.length; j++) {
        expect(Math.hypot(l[i].pos[0] - l[j].pos[0], l[i].pos[1] - l[j].pos[1])).toBeGreaterThanOrEqual(MIN_LINK_SPACING - 0.2)
      }
    }
  })

  it('maps people to figures and things to archetype props', () => {
    const d = composeDiorama(samples[0], 'Revolución francesa', 1)
    const byLabel = (l: string) => d.props.find((p) => p.label === l)!
    expect(['rider', 'figure']).toContain(byLabel('Luis XVI').kind)
    expect(['rider', 'figure']).toContain(byLabel('Camille Desmoulins').kind)
    expect(['cannon', 'flag', 'tent']).toContain(byLabel('Cañones').kind)
    const cell = composeDiorama(samples[7], 'Biología', 1)
    const kind = (l: string) => cell.props.find((p) => p.label === l)!.kind
    expect(kind('Mitocondria')).toBe('mitochondrion')
    expect(kind('Núcleo')).toBe('nucleus')
    expect(kind('ADN')).toBe('dna-helix')
    expect(composeDiorama(samples[8], 'Medicina', 1).props.find((p) => p.label === 'Válvula mitral')!.kind).toBe('heart-chamber-valve')
    expect(composeDiorama(samples[9], 'Medicina', 1).props.find((p) => p.label === 'Dendritas')!.kind).toBe('neuron')
  })

  it('the abstract archetype is a temple of ideas, not an empty field', () => {
    const d = composeDiorama(samples[3], 'Computación', 1)
    expect(d.terrain).toBe('interior')
    expect(d.props.filter((p) => p.kind === 'column' || p.kind === 'arch').length).toBeGreaterThanOrEqual(2)
    expect(linkedOf(d).every((p) => p.kind === 'custom')).toBe(true)
  })

  it('never throws on empty or odd rooms', () => {
    expect(() => composeDiorama({} as Room, '', 0)).not.toThrow()
    expect(() => composeDiorama(null as unknown as Room, undefined as unknown as string, 'x')).not.toThrow()
    const odd = composeDiorama({ name: '', description: '', pieces: [{ id: '', title: '', text: '' }] } as unknown as Room, '', 1)
    expect(parseDiorama(odd)).toEqual(odd)
  })

  it('takes the accent from the fresco pigment', () => {
    const d = composeDiorama(samples[0], 'Museo', 1, { wall: '#aa3322', trim: '#112233' })
    expect(d.palette.accent).toBe('#112233')
    expect(composeDiorama(samples[0], 'Museo', 1)).not.toEqual(d)
  })
})

describe('attachComposedDioramas', () => {
  const museum = (rooms: Room[]): Museum => ({ title: 'Prueba', rooms })

  it('gives a diorama to every room without one and never overrides existing ones', () => {
    const library = attachLibraryDioramas(museum([room('Batalla de Carabobo', ['Simón Bolívar']), room('Ilustración', ['Razón'])]))
    const out = attachComposedDioramas(library)
    expect(out.rooms.every((r) => r.diorama)).toBe(true)
    expect(out.rooms[0].diorama).toBe(library.rooms[0].diorama)
    expect(out.rooms[1].diorama?.title).toBe('Ilustración')
  })

  it('covers every room of the mock museums', () => {
    for (const m of [historiaMuseum, medicinaMuseum]) {
      const out = attachComposedDioramas(attachLibraryDioramas(m))
      expect(out.rooms.every((r) => r.diorama)).toBe(true)
    }
  })

  it('every room keeps a main painting slot (portal) even without an image search', () => {
    const out = attachComposedDioramas(museum([room('Ilustración', ['Razón']), room('Batalla de Carabobo', ['Simón Bolívar'])]))
    const layout = buildLayout(out)
    for (const r of layout.rooms) {
      const main = assignPaintings(r).find((a) => a.slot.main)
      expect(main?.diorama).toBeDefined()
      expect(main?.search).toBeUndefined()
    }
  })
})
