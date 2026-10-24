import { describe, expect, it } from 'vitest'
import { dueLabel } from './dueLabel'

describe('dueLabel', () => {
  it('is null when nothing is due', () => {
    expect(dueLabel(0)).toBeNull()
    expect(dueLabel(-1)).toBeNull()
  })

  it('uses the singular for one', () => {
    expect(dueLabel(1)).toBe('1 repaso pendiente')
  })

  it('uses the plural otherwise', () => {
    expect(dueLabel(2)).toBe('2 repasos pendientes')
    expect(dueLabel(17)).toBe('17 repasos pendientes')
  })
})
