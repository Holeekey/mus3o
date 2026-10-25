import { describe, expect, it } from 'vitest'
import { ARIS_PENDING_MAX_MS, arisActivity, isArisPending, profileFacing } from './arisPose'

describe('arisActivity', () => {
  it('está en reposo si no pasa nada', () => {
    expect(arisActivity({ listening: false, pending: false, speaking: false })).toBe('idle')
  })
  it('te mira mientras te escucha, incluso si estaba hablando o pensando', () => {
    expect(arisActivity({ listening: true, pending: false, speaking: false })).toBe('listening')
    expect(arisActivity({ listening: true, pending: true, speaking: true })).toBe('listening')
  })
  it('piensa mientras espera la respuesta y habla cuando suena la voz', () => {
    expect(arisActivity({ listening: false, pending: true, speaking: false })).toBe('thinking')
    expect(arisActivity({ listening: false, pending: true, speaking: true })).toBe('speaking')
  })
})

describe('isArisPending', () => {
  it('es pendiente solo si hay marca y no pasó el máximo', () => {
    expect(isArisPending(null, 1000)).toBe(false)
    expect(isArisPending(1000, 1000 + ARIS_PENDING_MAX_MS - 1)).toBe(true)
    expect(isArisPending(1000, 1000 + ARIS_PENDING_MAX_MS)).toBe(false)
  })
})

describe('profileFacing', () => {
  // Jugador mirando a -Z (su derecha es +X). Aris flota a su lado: hacia el jugador es (-0.51, 0.86) si está a la derecha.
  const right = { x: 1, z: 0 }

  it('mira de perfil: perpendicular a la dirección hacia el jugador y unitario', () => {
    const f = profileFacing(-0.95, 1.6, right.x, right.z, 1)
    expect(Math.hypot(f.x, f.z)).toBeCloseTo(1)
    expect(f.x * (-0.95) + f.z * 1.6).toBeCloseTo(0)
  })

  it('desde el hombro derecho gira hacia el centro de la vista (izquierda y al frente)', () => {
    const f = profileFacing(-0.95, 1.6, right.x, right.z, 1)
    expect(f.x).toBeLessThan(0)
    expect(f.z).toBeLessThan(0)
  })

  it('desde el hombro izquierdo gira hacia la derecha', () => {
    const f = profileFacing(0.95, 1.6, right.x, right.z, -1)
    expect(f.x).toBeGreaterThan(0)
    expect(f.z).toBeLessThan(0)
  })

  it('tolera un vector nulo y reutiliza el objeto de salida', () => {
    const out = { x: 9, z: 9 }
    expect(profileFacing(0, 0, 1, 0, 1, out)).toBe(out)
    expect(Number.isFinite(out.x) && Number.isFinite(out.z)).toBe(true)
  })
})
