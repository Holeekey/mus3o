import { describe, expect, it } from 'vitest'
import { COMFORT_SCALE, parseComfort, stepVignette, VIGNETTE_MAX } from './comfort'
import { VR_WALK_SCALE } from './pad'

describe('modo cómodo', () => {
  it('por defecto activo; la URL y lo guardado lo apagan', () => {
    expect(parseComfort('', null)).toBe(true)
    expect(parseComfort('', '0')).toBe(false)
    expect(parseComfort('?vrcomfort=0', '1')).toBe(false)
    expect(parseComfort('?vrcomfort=1', '0')).toBe(true)
  })

  it('la marcha en VR queda cerca de 1,4 m/s (escritorio 4,5 m/s)', () => {
    const v = 4.5 * VR_WALK_SCALE * COMFORT_SCALE
    expect(v).toBeGreaterThan(1.2)
    expect(v).toBeLessThan(1.6)
  })

  it('la viñeta sube rápido, baja despacio y no pasa de su máximo', () => {
    let v = stepVignette(0, true, 0.05)
    expect(v).toBeGreaterThan(0.2)
    for (let i = 0; i < 100; i++) v = stepVignette(v, true, 0.05)
    expect(v).toBe(VIGNETTE_MAX)
    const down = stepVignette(v, false, 0.05)
    expect(down).toBeLessThan(v)
    expect(v - down).toBeLessThan(0.2)
    let w = v
    for (let i = 0; i < 100; i++) w = stepVignette(w, false, 0.05)
    expect(w).toBe(0)
  })
})
