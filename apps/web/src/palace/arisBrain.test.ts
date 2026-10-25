import { describe, expect, it } from 'vitest'
import type { Museum } from '@mus3o/shared'
import { evaluateArisQuery } from './arisBrain'

const piece = (id: string, title: string, text: string, mnemonicCue?: string) => ({ id, title, text, fact: '', mnemonicCue })
const palace = {
  title: 'Roma antigua',
  rooms: [
    { id: 'r1', name: 'El Foro', description: 'Centro político.', pieces: [piece('p1', 'Senado romano', 'Consejo de ancianos que asesoraba a los magistrados.', 'Imagina togas gigantes'), piece('p2', 'Julio César', 'Dictador asesinado en el 44 a.C.')] },
    { id: 'r2', name: 'El Coliseo', description: '', pieces: [piece('p3', 'Gladiadores', 'Luchadores profesionales.')] },
  ],
} as unknown as Museum
const ctx = { palace, currentRoomId: 'r1', memorized: {}, hasKey: false, unlockedDoors: {}, mode: 'explore' as const }
const ask = (q: string) => evaluateArisQuery(q, ctx)

describe('arisBrain: menos fallback', () => {
  it('explica un concepto por nombre aunque falte una palabra o haya un typo', () => {
    expect(ask('qué es el senado').text).toContain('Consejo de ancianos')
    expect(ask('hablame de julio cesar').text).toContain('44 a.C.')
    expect(ask('gladiadors?').text).toContain('"El Coliseo"')
  })

  it('da la asociación mnemotécnica cuando se pide recordar el concepto', () => {
    expect(ask('cómo recordar el senado').text).toContain('togas gigantes')
  })

  it('responde por sala, listas, conteos y controles', () => {
    expect(ask('cuéntame del coliseo').text).toContain('Sala 2 de 2')
    expect(ask('cuéntame del coliseo').text).toContain('sala contigua')
    expect(ask('qué conceptos hay aquí').text).toContain('Senado romano')
    expect(ask('cuántas salas tiene').text).toContain('2 salas')
    expect(ask('cuáles son los controles').text).toContain('WASD')
  })

  it('no confunde palabras que solo contienen un saludo', () => {
    expect(ask('escolástica').text).not.toContain('Soy Aris')
  })

  it('solo pide ayuda a Haiku con preguntas reales que ninguna regla entiende', () => {
    expect(ask('por qué cayó el imperio').needsHelp).toBe(true)
    expect(ask('??').needsHelp).toBeFalsy()
    expect(ask('qué falta memorizar').needsHelp).toBeFalsy()
  })
})
