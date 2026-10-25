import { describe, expect, it } from 'vitest'
import { liftColor } from './liftColor'

const luma = (hex: string) => {
  const n = parseInt(hex.slice(1, 7), 16)
  return (0.2126 * (n >> 16) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255
}

describe('liftColor', () => {
  it('aclara los tonos muy oscuros', () => {
    expect(luma(liftColor('#222222'))).toBeGreaterThan(luma('#222222') + 0.2)
    expect(luma(liftColor('#000000'))).toBeGreaterThan(0.2)
  })

  it('no toca los colores que ya se leen bien', () => {
    expect(liftColor('#c8553d')).toBe('#c8553d')
    expect(liftColor('#ffffff')).toBe('#ffffff')
  })

  it('acepta #rgb y devuelve tal cual lo que no puede leer', () => {
    expect(liftColor('#111')).toMatch(/^#[0-9a-f]{6}$/)
    expect(liftColor('rojo')).toBe('rojo')
  })
})
