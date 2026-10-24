import { describe, expect, it } from 'vitest'
import { DioramaSchema, MAX_PROPS, RoomSchema, parseDiorama } from './schema'

describe('DioramaSchema', () => {
  it('acepta un diorama mínimo y aplica valores por defecto', () => {
    const d = parseDiorama({ title: 'X', terrain: 'hills', time: 'day', palette: { ground: '#112233', sky: '#445566', accent: '#778899' }, props: [{ kind: 'tree', pos: [1, 2] }] })
    expect(d.props[0]).toMatchObject({ kind: 'tree', pos: [1, 2], rotY: 0, scale: 1, count: 1, spread: 0 })
  })

  it('degrada una salida descuidada sin lanzar', () => {
    const d = parseDiorama({ title: 42, terrain: 'volcano', time: 'dawn', palette: { ground: 'verde' }, props: 'nope' })
    expect(d).toMatchObject({ title: 'Diorama', terrain: 'plain', time: 'day', props: [] })
    expect(d.palette.sky).toMatch(/^#/)
    expect(parseDiorama(null).terrain).toBe('plain')
  })

  it('acota coordenadas, escala y cantidad', () => {
    const d = parseDiorama({ props: [{ kind: 'rock', pos: [999, -999], scale: 50, count: 500, spread: 99, color: 'rojo' }] })
    const p = d.props[0]
    expect(p.pos).toEqual([14, -14])
    expect(p.scale).toBe(3)
    expect(p.count).toBe(30)
    expect(p.spread).toBe(8)
    expect(p.color).toBeUndefined()
  })

  it('descarta props inválidos y recorta a MAX_PROPS', () => {
    const many = Array.from({ length: 40 }, () => ({ kind: 'tree', pos: [0, 0] }))
    const d = parseDiorama({ props: [{ kind: 'dragon' }, { kind: 'custom' }, ...many] })
    expect(d.props).toHaveLength(MAX_PROPS)
    expect(d.props.every((p) => p.kind === 'tree')).toBe(true)
  })

  it('custom exige partes y las limita a 10', () => {
    const part = { shape: 'box', args: [1, 1, 1], color: '#aabbcc' }
    const d = parseDiorama({ props: [{ kind: 'custom', parts: Array.from({ length: 12 }, () => part) }, { kind: 'custom', parts: [part] }] })
    // 12 partes superan el máximo: ese prop se descarta, el de 1 parte sobrevive
    expect(d.props).toHaveLength(1)
    expect(d.props[0].parts).toHaveLength(1)
  })

  it('acepta pattern saltire en banderas y descarta valores desconocidos', () => {
    const d = parseDiorama({ props: [{ kind: 'flag', pattern: 'saltire', color: '#efe8d8', secondary: '#c8102e', pos: [0, 0] }, { kind: 'flag', pattern: 'wavy', pos: [1, 1] }] })
    expect(d.props[0].pattern).toBe('saltire')
    expect(d.props[1].pattern).toBeUndefined()
  })

  it('RoomSchema.diorama es opcional y un diorama roto se descarta sin tumbar la sala', () => {
    const base = { id: 'r', name: 'Sala', pieces: [] }
    expect(RoomSchema.parse(base).diorama).toBeUndefined()
    const ok = RoomSchema.parse({ ...base, diorama: { title: 'X', terrain: 'hills', time: 'day', props: [{ kind: 'tree', pos: [1, 2] }] } })
    expect(ok.diorama?.props).toHaveLength(1)
    // no es un objeto: se descarta en vez de lanzar
    expect(RoomSchema.parse({ ...base, diorama: 'nope' }).diorama).toBeUndefined()
    // objeto con basura: se repara con valores por defecto
    expect(RoomSchema.parse({ ...base, diorama: { terrain: 'volcano', props: 7 } }).diorama).toMatchObject({ terrain: 'plain', props: [] })
  })
})
