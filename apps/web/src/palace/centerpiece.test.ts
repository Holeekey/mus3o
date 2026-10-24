import { describe, expect, it } from 'vitest'
import { chooseCenterpiece, classifyRoom, type CenterpieceInput } from './centerpiece'

const pieces = (n: number) => Array.from({ length: n }, (_, i) => `Pieza ${i + 1}`)
const room = (title: string, n = 4, hasDiorama = false): CenterpieceInput => ({ title, pieceTitles: pieces(n), hasDiorama })

describe('classifyRoom', () => {
  const table: Array<[string, string]> = [
    ['Batalla de Boyacá (1819)', 'battle'],
    ['Batalla de Carabobo (1821)', 'battle'],
    ['Congreso de Angostura (1819)', 'assembly'],
    ['El Senado y la Filosofía Estoica', 'assembly'],
    ['Batalla Naval del Lago de Maracaibo (1823)', 'naval'],
    ['El corazón', 'organ'],
    ['Sistema respiratorio', 'organ'],
    ['La célula', 'cell'],
    ['Mitocondria y Bioenergética', 'cell'],
    ['Núcleo y Expresión Génica', 'cell'],
    ['La neurona', 'neural'],
    ['Simón Bolívar', 'person'],
    ['Vida de un genio', 'person'],
    ['Las Pirámides', 'sacred'],
    ['Bosque tropical', 'nature'],
    ['Unidad Central de Procesamiento', 'abstract'],
    ['Jerarquía de Memoria', 'abstract'],
    ['Heart anatomy', 'organ'],
    ['The Battle of Trafalgar', 'battle'],
    ['Parliament and law', 'assembly'],
  ]
  it.each(table)('%s -> %s', (name, archetype) => {
    expect(classifyRoom(name).archetype).toBe(archetype)
  })

  it('ignora tildes y mayúsculas', () => {
    expect(classifyRoom('EL CORAZÓN').archetype).toBe('organ')
    expect(classifyRoom('el corazon').organ).toBe('heart')
  })

  it('una sala de personas (piezas) es una sala de estatua', () => {
    const c = classifyRoom('Los próceres', ['Simón Bolívar', 'José Antonio Páez', 'Manuela Sáenz', 'Francisco de Miranda'])
    expect(c.archetype).toBe('person')
  })

  it('elige el órgano que corresponde', () => {
    expect(classifyRoom('Los pulmones').organ).toBe('lung')
    expect(classifyRoom('El hígado').organ).toBe('liver')
    expect(classifyRoom('El cerebro').organ).toBe('brain')
    expect(classifyRoom('Los riñones').organ).toBe('kidney')
  })
})

describe('chooseCenterpiece', () => {
  it('es determinista', () => {
    for (const t of ['Batalla de Boyacá', 'Bosque', 'Templo del sol', 'CPU', 'Simón Bolívar']) {
      expect(chooseCenterpiece(room(t))).toEqual(chooseCenterpiece(room(t)))
    }
  })

  it('devuelve la pieza del tema', () => {
    expect(chooseCenterpiece(room('Batalla de Boyacá'))?.kind).toBe('battle')
    expect(chooseCenterpiece(room('Congreso de Angostura'))?.kind).toBe('tribune')
    expect(chooseCenterpiece(room('Batalla Naval del Lago'))?.kind).toBe('ship')
    expect(chooseCenterpiece(room('Simón Bolívar'))?.kind).toBe('statue')
    expect(chooseCenterpiece(room('El corazón'))).toMatchObject({ kind: 'organ', organ: 'heart', idle: true })
    expect(chooseCenterpiece(room('La célula'))?.kind).toBe('nucleus')
    expect(chooseCenterpiece(room('Mitocondria'))?.kind).toBe('mitochondrion')
    expect(chooseCenterpiece(room('La neurona'))?.kind).toBe('neuron')
  })

  it('los temas abstractos no llevan pieza central', () => {
    expect(chooseCenterpiece(room('Unidad Central de Procesamiento'))).toBeNull()
    expect(chooseCenterpiece(room('Jerarquía de Memoria'))).toBeNull()
  })

  it('una sala con diorama queda despejada, salvo la de ciencia', () => {
    expect(chooseCenterpiece(room('Batalla de Carabobo', 5, true))).toBeNull()
    expect(chooseCenterpiece(room('El corazón', 5, true))?.kind).toBe('organ')
  })

  it('una sala casi vacía queda despejada', () => {
    expect(chooseCenterpiece(room('Batalla de Boyacá', 1))).toBeNull()
  })

  it('solo la ciencia gira', () => {
    expect(chooseCenterpiece(room('Batalla de Boyacá'))?.idle).toBe(false)
    expect(chooseCenterpiece(room('Simón Bolívar'))?.idle).toBe(false)
  })

  it('al menos un tercio de las salas de una muestra mixta quedan sin pieza', () => {
    const sample: CenterpieceInput[] = [
      room('Batalla de Carabobo (1821)', 6, true),
      room('Batalla de Boyacá (1819)'),
      room('Congreso de Angostura (1819)'),
      room('Batalla Naval del Lago de Maracaibo (1823)'),
      room('Unidad Central de Procesamiento'),
      room('Jerarquía de Memoria'),
      room('Buses del Sistema y E/S'),
      room('Membrana Plasmática'),
      room('Mitocondria y Bioenergética'),
      room('El Foro y el Espacio Cívico'),
      room('Las Legiones y la Pax Romana'),
      room('Álgebra lineal'),
      room('Introducción'),
      room('Las Pirámides'),
      room('Bosque tropical'),
      room('Ecuaciones diferenciales'),
      room('Simón Bolívar'),
      room('Historia del arte'),
    ]
    const none = sample.filter((r) => chooseCenterpiece(r) === null).length
    expect(none / sample.length).toBeGreaterThanOrEqual(1 / 3)
    expect(none).toBeLessThan(sample.length) // y no todas
  })
})
