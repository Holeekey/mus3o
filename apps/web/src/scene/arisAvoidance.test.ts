import { describe, expect, it } from 'vitest'
import type { Box } from '../palace/layout'
import { computeArisPosition } from './arisAvoidance'

describe('computeArisPosition', () => {
  const camera = { x: 0, y: 1.7, z: 0 }
  const forward = { x: 0, z: -1 } // Mirando hacia el norte (-Z)
  const right = { x: 1, z: 0 }    // Derecha es +X

  it('mantiene el lado preferido si el espacio está libre', () => {
    const pos = computeArisPosition(camera, forward, right, 1, [])
    expect(pos.sideSign).toBe(1)
    expect(pos.x).toBeGreaterThan(0)
    expect(pos.z).toBeLessThan(0)
  })

  it('cambia de hombro si el lado preferido colisiona con un muro', () => {
    // Muro a la derecha del jugador
    const wallRight: Box = { x: 1, z: -1.5, w: 1, d: 2, h: 3 }
    const pos = computeArisPosition(camera, forward, right, 1, [wallRight])

    // Debe cambiar al hombro izquierdo (sideSign = -1, x < 0)
    expect(pos.sideSign).toBe(-1)
    expect(pos.x).toBeLessThan(0)
  })

  it('se repliega más cerca del jugador si ambos lados a distancia completa colisionan', () => {
    // Pasillo estrecho con muros a derecha e izquierda
    const wallRight: Box = { x: 1.0, z: -1.5, w: 1, d: 2, h: 3 }
    const wallLeft: Box = { x: -1.0, z: -1.5, w: 1, d: 2, h: 3 }

    const pos = computeArisPosition(camera, forward, right, 1, [wallRight, wallLeft])

    // Debe seguir sin chocar con ninguno de los dos muros y haber acortado distancia
    expect(Math.abs(pos.x - wallRight.x)).toBeGreaterThanOrEqual(wallRight.w / 2 + 0.25 - 1e-4)
    expect(Math.abs(pos.x - wallLeft.x)).toBeGreaterThanOrEqual(wallLeft.w / 2 + 0.25 - 1e-4)
  })

  it('no penetra un pedestal situado al frente a la derecha', () => {
    const pedestal: Box = { x: 0.9, z: -1.6, w: 0.9, d: 0.9, h: 1 }
    const pos = computeArisPosition(camera, forward, right, 1, [pedestal])

    // No debe solaparse con el pedestal
    const collidesWithPedestal =
      Math.abs(pos.x - pedestal.x) < pedestal.w / 2 + 0.25 &&
      Math.abs(pos.z - pedestal.z) < pedestal.d / 2 + 0.25

    expect(collidesWithPedestal).toBe(false)
  })
})
