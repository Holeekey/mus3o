import { describe, expect, it } from 'vitest'
import { buildPhotoIntro, buildPropNarration, dedupeLabels, matchConcept, PHOTO_INTRO_MAX_ITEMS } from './guide'

describe('buildPhotoIntro', () => {
  it('dice que recrea la imagen real, con título y autor, y lista lo que se ve con direcciones', () => {
    const t = buildPhotoIntro({
      imageTitle: 'Batalla de Boyacá',
      artist: 'Martin Tovar y Tovar, 1890',
      dioramaTitle: 'Carga patriota en la ladera',
      items: [
        { label: 'infantería patriota cargando', direction: 'a tu izquierda' },
        { label: 'soldados realistas', direction: 'a tu derecha' },
      ],
    })
    expect(t).toContain('recreación en 3D de «Batalla de Boyacá», de Martin Tovar y Tovar, 1890')
    expect(t).toContain('imagen real')
    expect(t).toContain('infantería patriota cargando (a tu izquierda), soldados realistas (a tu derecha)')
  })

  it('sin datos de la imagen usa el título de la escena; sin props, invita a recorrerla', () => {
    const t = buildPhotoIntro({ dioramaTitle: 'Combate naval', items: [] })
    expect(t).toContain('«Combate naval»')
    expect(t).toContain('Recórrela')
  })

  it('no repite rótulos iguales (sin mayúsculas ni tildes) y se queda con el más cercano', () => {
    const out = dedupeLabels([
      { label: 'Soldados realistas', direction: 'delante, a tu derecha', d: 9 },
      { label: 'soldados realistas', direction: 'a tu derecha', d: 4 },
      { label: 'árboles', direction: 'justo delante', d: 6 },
      { label: 'Arboles', direction: 'a tu espalda', d: 8 },
    ])
    expect(out.map((i) => i.direction)).toEqual(['a tu derecha', 'justo delante'])
    const t = buildPhotoIntro({ dioramaTitle: 'x', items: [{ label: 'soldados realistas', direction: 'a tu derecha', d: 4 }, { label: 'Soldados Realistas', direction: 'a tu izquierda', d: 7 }] })
    expect(t.match(/soldados realistas/gi)).toHaveLength(1)
    expect(t).toContain('soldados realistas (a tu derecha)')
  })

  it('nombra cinco y resume el resto', () => {
    const items = Array.from({ length: 8 }, (_, i) => ({ label: `cosa ${i}`, direction: 'a tu derecha', d: i }))
    const t = buildPhotoIntro({ dioramaTitle: 'x', items })
    expect(t).toContain(`y ${8 - PHOTO_INTRO_MAX_ITEMS} más`)
    expect(t).not.toContain('cosa 5')
  })
})

describe('matchConcept', () => {
  const pieces = [{ title: 'Francisco de Paula Santander' }, { title: 'Caballería' }, { title: 'ADN' }]
  it('coincide si el título contiene el rótulo (o al revés), sin mayúsculas ni tildes', () => {
    expect(matchConcept('caballeria', pieces)?.title).toBe('Caballería')
    expect(matchConcept('Paula Santander', pieces)?.title).toBe('Francisco de Paula Santander')
  })
  it('no coincide con rótulos ajenos ni con textos demasiado cortos', () => {
    expect(matchConcept('río Tíber', pieces)).toBeUndefined()
    expect(matchConcept('ADN', pieces)).toBeUndefined()
    expect(matchConcept('', pieces)).toBeUndefined()
  })
})

describe('buildPropNarration', () => {
  it('sin concepto: solo el rótulo', () => {
    expect(buildPropNarration('soldados realistas')).toBe('Soldados realistas.')
  })
  it('con concepto: rótulo, apuntes y fuente', () => {
    const t = buildPropNarration('caballería', { title: 'Caballería', text: 'Decidió la batalla con una carga final.', sourceLine: 12 })
    expect(t).toBe('Caballería. Decidió la batalla con una carga final. Según tus apuntes, línea 12.')
  })
})
