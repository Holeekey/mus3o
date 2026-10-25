import { describe, expect, it } from 'vitest'
import { buildIntro, buildPieceNarration, clipSentences, createVisitTracker, DIORAMA_SPAWN, relativeDirection } from './guide'

const from = { x: DIORAMA_SPAWN.x, z: DIORAMA_SPAWN.z }
const dir = (x: number, z: number) => relativeDirection(DIORAMA_SPAWN.yaw, from, { x, z })

describe('relativeDirection (mirando a -Z desde el punto de aparición)', () => {
  it('delante, derecha, izquierda y detrás', () => {
    expect(dir(0, 0)).toBe('justo delante')
    expect(dir(8, 10.6)).toBe('a tu derecha')
    expect(dir(-8, 10.6)).toBe('a tu izquierda')
    expect(dir(0, 14)).toBe('a tu espalda')
  })
  it('diagonales', () => {
    expect(dir(5, 5)).toBe('delante, a tu derecha')
    expect(dir(-5, 5)).toBe('delante, a tu izquierda')
    expect(dir(6, 14)).toBe('detrás, a tu derecha')
  })
  it('respeta el yaw: mirando a +X, un punto en -Z queda a la izquierda', () => {
    expect(relativeDirection(Math.PI / 2, { x: 0, z: 0 }, { x: 0, z: -5 })).toBe('a tu izquierda')
    expect(relativeDirection(Math.PI / 2, { x: 0, z: 0 }, { x: 5, z: 0 })).toBe('justo delante')
  })
})

describe('buildIntro', () => {
  it('con sala y periodo y varios conceptos', () => {
    const t = buildIntro({
      dioramaTitle: 'Batalla de Carabobo',
      roomTitle: 'Independencia',
      period: '1821',
      items: [
        { title: 'Bolívar', direction: 'justo delante' },
        { title: 'Cañón', direction: 'a tu izquierda' },
      ],
    })
    expect(t).toContain('«Batalla de Carabobo» de la sala «Independencia» (1821)')
    expect(t).toContain('2 conceptos')
    expect(t).toContain('Bolívar (justo delante), Cañón (a tu izquierda)')
  })
  it('sin periodo ni sala y con un solo concepto', () => {
    const t = buildIntro({ dioramaTitle: 'Célula', items: [{ title: 'Núcleo', direction: 'a tu derecha' }] })
    expect(t).toBe('Estás dentro del cuadro «Célula». Aquí hay un concepto de tus apuntes: Núcleo (a tu derecha). Acércate y mira cada uno para que te cuente de qué se trata.')
  })
  it('sin conceptos enlazados', () => {
    const t = buildIntro({ dioramaTitle: 'Valle', roomTitle: 'Geografía', items: [] })
    expect(t).toContain('no tiene conceptos de tus apuntes enlazados')
  })
  it('muchos: nombra cuatro y resume el resto', () => {
    const items = Array.from({ length: 7 }, (_, i) => ({ title: `C${i}`, direction: 'justo delante' }))
    const t = buildIntro({ dioramaTitle: 'X', items })
    expect(t).toContain('7 conceptos')
    expect(t).toContain('C3 (justo delante) y 3 más')
    expect(t).not.toContain('C4')
  })
})

describe('buildPieceNarration', () => {
  it('con texto y línea de los apuntes (máximo dos oraciones)', () => {
    expect(buildPieceNarration({ title: 'Mitocondria', text: 'Produce ATP. Tiene doble membrana. Tercera oración.', sourceLine: 12, hasSource: true })).toBe(
      'Mitocondria. Produce ATP. Tiene doble membrana. Según tus apuntes, línea 12.',
    )
  })
  it('sin texto: solo el nombre', () => {
    expect(buildPieceNarration({ title: 'Ribosoma', text: '' })).toBe('Ribosoma.')
  })
  it('sin línea pero con cita, y sin fuente', () => {
    expect(buildPieceNarration({ title: 'A', text: 'x', hasSource: true })).toBe('A. x. Esto sale de tus apuntes.')
    expect(buildPieceNarration({ title: 'A', text: 'x', unverified: true })).toContain('no aparece en tus apuntes')
  })
  it('Wikipedia: complementa el texto o lo reemplaza si no hay', () => {
    const wiki = { title: 'Mitocondria', extract: 'Orgánulo celular. Más cosas.' }
    expect(buildPieceNarration({ title: 'M', text: 'Dato.', wiki })).toBe('M. Dato. En Wikipedia: «Mitocondria».')
    expect(buildPieceNarration({ title: 'M', text: '', wiki })).toBe('M. Wikipedia dice: Orgánulo celular. En Wikipedia: «Mitocondria».')
  })
  it('recorta textos largos a 240 caracteres sin cortar palabras', () => {
    const long = 'Palabra '.repeat(80)
    const t = clipSentences(long)
    expect(t.length).toBeLessThanOrEqual(241)
    expect(t.endsWith('…')).toBe(true)
    expect(buildPieceNarration({ title: 'L', text: long }).length).toBeLessThan(260)
  })
})

describe('createVisitTracker', () => {
  it('cuenta una vez por visita y se reinicia', () => {
    const v = createVisitTracker()
    expect(v.claim('a')).toBe(true)
    expect(v.claim('a')).toBe(false)
    expect(v.claim('b')).toBe(true)
    expect(v.size).toBe(2)
    v.reset()
    expect(v.claim('a')).toBe(true)
  })
})
