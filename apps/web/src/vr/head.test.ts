import { describe, expect, it } from 'vitest'
import { Vector3 } from 'three'
import type { Piece } from '@mus3o/shared'
import { deviceQuaternion, GYRO_CORRECT, integrateGyro, normAngle, yawOf } from './head'
import { panelBody, sourceNote } from './panelText'

const forward = (a: number, b: number, g: number, orient = 0) => new Vector3(0, 0, -1).applyQuaternion(deviceQuaternion(a, b, g, orient))

describe('deviceQuaternion', () => {
  it('phone upright and facing the horizon looks straight ahead (-Z)', () => {
    const f = forward(0, 90, 0)
    expect(f.x).toBeCloseTo(0)
    expect(f.y).toBeCloseTo(0)
    expect(f.z).toBeCloseTo(-1)
  })

  it('tilting the phone back looks up; forward leans down', () => {
    expect(forward(0, 120, 0).y).toBeGreaterThan(0.4)
    expect(forward(0, 60, 0).y).toBeLessThan(-0.4)
  })

  it('alpha turns the head left (counterclockwise seen from above)', () => {
    const f = forward(90, 90, 0)
    expect(f.x).toBeCloseTo(-1)
    expect(yawOf(deviceQuaternion(90, 90, 0, 0))).toBeCloseTo(Math.PI / 2)
  })

  it('landscape (screen angle 90) with the phone on its side still looks at the horizon', () => {
    // Teléfono girado 90° (en el visor): beta ~0, gamma ~-90 con la pantalla a 90°.
    const f = forward(0, 0, -90, 90)
    expect(f.y).toBeCloseTo(0, 1)
    expect(Math.hypot(f.x, f.z)).toBeCloseTo(1, 1)
  })
})

const piece = (extra: Partial<Piece> = {}) => ({ id: 'p', title: 'Mitocondria', text: 'Produce energía.', fact: 'Tiene ADN propio.', ...extra }) as Piece

describe('panelText', () => {
  it('uses the mnemonic cue over the fact when there is one', () => {
    const body = panelBody(piece({ mnemonicCue: 'Una central eléctrica' }), null)
    expect(body).toContain('Produce energía.')
    expect(body).toContain('Anclaje: Una central eléctrica')
    expect(body).not.toContain('ADN')
  })

  it('falls back to the fact and appends the wiki extract when there is room', () => {
    const body = panelBody(piece(), { extract: 'Orgánulo celular.' } as never)
    expect(body).toContain('Tiene ADN propio.')
    expect(body).toContain('Para saber más: Orgánulo celular.')
  })

  it('never exceeds the panel budget', () => {
    expect(panelBody(piece({ text: 'x'.repeat(2000) }), null).length).toBeLessThanOrEqual(440)
  })

  it('names the source: notes line, unverified, or wikipedia', () => {
    expect(sourceNote(piece({ source: { quote: 'q', line: 4 } }), null)).toBe('Tus apuntes, línea 4')
    expect(sourceNote(piece({ unverified: true }), null)).toBe('No está en tus apuntes')
    expect(sourceNote(piece(), { source: 'Wikipedia', title: 'Mitocondria' } as never)).toContain('Wikipedia')
    expect(sourceNote(piece(), null)).toBeNull()
  })
})

describe('pantalla y giroscopio', () => {
  const look = (q: import('three').Quaternion) => new Vector3(0, 0, -1).applyQuaternion(q)

  it('normAngle: window.orientation de iOS (-90) equivale a 270', () => {
    expect(normAngle(-90)).toBe(270)
    expect(normAngle(90)).toBe(90)
    expect(normAngle(360)).toBe(0)
  })

  it('apaisado a izquierda (90) y a derecha (270): de canto se mira al horizonte, en sentidos opuestos', () => {
    const l = look(deviceQuaternion(0, 0, -90, 90))
    const r = look(deviceQuaternion(0, 0, 90, 270))
    expect(l.y).toBeCloseTo(0)
    expect(r.y).toBeCloseTo(0)
    expect(Math.hypot(l.x, l.z)).toBeCloseTo(1)
    expect(Math.hypot(r.x, r.z)).toBeCloseTo(1)
    // Cada giro ve hacia el lado contrario del mismo marco de sensor.
    expect(l.x * r.x + l.z * r.z).toBeCloseTo(-1)
  })

  it('apaisado: inclinar la cabeza hacia delante mira hacia abajo en ambos sentidos (y hacia atrás, arriba)', () => {
    expect(look(deviceQuaternion(0, 0, -70, 90)).y).toBeLessThan(-0.3)
    expect(look(deviceQuaternion(0, 0, 70, 270)).y).toBeLessThan(-0.3)
    expect(look(deviceQuaternion(0, 0, -110, 90)).y).toBeGreaterThan(0.3)
  })

  it('integrar el giroscopio reproduce el giro sin esperar al siguiente evento', () => {
    const q = deviceQuaternion(0, 90, 0, 0)
    for (let i = 0; i < 100; i++) integrateGyro(q, 0, (90 * Math.PI) / 180, 0, 0.01)
    expect(yawOf(q)).toBeCloseTo(Math.PI / 2, 2)
    expect(look(q).x).toBeCloseTo(-1, 2)
  })

  it('sin velocidad angular o con dt 0 no cambia nada', () => {
    const q = deviceQuaternion(30, 80, 5, 0)
    const copy = q.clone()
    integrateGyro(q, 0, 0, 0, 0.016)
    integrateGyro(q, 1, 1, 1, 0)
    expect(q.angleTo(copy)).toBeCloseTo(0)
  })

  it('la corrección con DeviceOrientation es parcial y converge sin saltos', () => {
    const target = deviceQuaternion(40, 90, 0, 0)
    const q = deviceQuaternion(0, 90, 0, 0)
    const before = q.angleTo(target)
    q.slerp(target, GYRO_CORRECT)
    expect(q.angleTo(target)).toBeLessThan(before)
    expect(q.angleTo(target)).toBeGreaterThan(0)
  })
})
