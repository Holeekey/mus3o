import { describe, expect, it } from 'vitest'
import type { Part } from '@mus3o/shared'
import { fitParts, partsBounds } from './fitModel'

const part = (p: Partial<Part> & Pick<Part, 'shape' | 'args'>): Part => ({ pos: [0, 0, 0], rot: [0, 0, 0], color: '#aabbcc', ...p })

describe('partsBounds', () => {
  it('mide una caja y una esfera desplazadas', () => {
    const b = partsBounds([part({ shape: 'box', args: [2, 1, 1], pos: [0, 0.5, 0] }), part({ shape: 'sphere', args: [0.5], pos: [2, 0.5, 0] })])!
    expect(b.min).toEqual([-1, 0, -0.5])
    expect(b.max).toEqual([2.5, 1, 0.5])
  })

  it('tiene en cuenta la rotación: una caja larga girada 90° en z se vuelve alta', () => {
    const b = partsBounds([part({ shape: 'box', args: [2, 0.2, 0.2], rot: [0, 0, Math.PI / 2] })])!
    expect(b.max[1] - b.min[1]).toBeCloseTo(2, 5)
    expect(b.max[0] - b.min[0]).toBeCloseTo(0.2, 5)
  })

  it('devuelve null sin partes', () => {
    expect(partsBounds([])).toBeNull()
  })
})

describe('fitParts', () => {
  it('agranda un modelo diminuto hasta ~2 m, centrado y apoyado en y = 0', () => {
    const parts = [part({ shape: 'box', args: [0.8, 0.4, 0.4], pos: [3, 1.5, -2] })]
    const { scale, offset } = fitParts(parts)
    expect(scale).toBeCloseTo(2.5, 5) // 2 / 0.8
    const b = partsBounds(parts)!
    const worldMinY = b.min[1] * scale + offset[1]
    const worldCenterX = ((b.min[0] + b.max[0]) / 2) * scale + offset[0]
    const worldCenterZ = ((b.min[2] + b.max[2]) / 2) * scale + offset[2]
    expect(worldMinY).toBeCloseTo(0, 5)
    expect(worldCenterX).toBeCloseTo(0, 5)
    expect(worldCenterZ).toBeCloseTo(0, 5)
  })

  it('encoge un modelo que se sale de su caja', () => {
    const { scale } = fitParts([part({ shape: 'box', args: [4, 4, 4] }), part({ shape: 'box', args: [4, 4, 4], pos: [3, 0, 0] })])
    expect(scale).toBeLessThan(0.5)
  })

  it('limita la ampliación (maxScale) con un modelo diminuto', () => {
    expect(fitParts([part({ shape: 'box', args: [0.2, 0.2, 0.2] })]).scale).toBe(4)
  })

  it('no dispara la escala con un modelo degenerado', () => {
    const { scale } = fitParts([part({ shape: 'box', args: [0.01, 0.01, 0.01] })])
    expect(scale).toBeLessThanOrEqual(4)
  })

  it('sin partes no transforma nada', () => {
    expect(fitParts([])).toEqual({ scale: 1, offset: [0, 0, 0] })
  })
})
