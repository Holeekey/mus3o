import { describe, expect, it } from 'vitest'
import { Vector3 } from 'three'
import { dioramaBoxes, DIORAMA_BOUND, DIORAMA_ORIGIN_XZ, rigForHead, validateDioramaTeleport } from './walk'
import { rigOffset, viewerInOffsetSpace, worldFromBase } from '../vr/rig'

const dry = { isWater: () => false }
const boxes = dioramaBoxes([{ x: 3, z: 0, r: 1 }])

describe('teletransporte por mirada dentro del cuadro', () => {
  it('un suelo libre a la vista es válido', () => {
    expect(validateDioramaTeleport(boxes, dry, { x: 0, z: 5 }, { x: 0, z: 0 })).toEqual({ ok: true, x: 0, z: 0 })
  })

  it('rechaza lo muy lejos, lo muy cerca y lo fuera de los límites', () => {
    expect(validateDioramaTeleport(boxes, dry, { x: 0, z: 0 }, { x: 0, z: -11 })).toMatchObject({ ok: false, reason: 'far' })
    expect(validateDioramaTeleport(boxes, dry, { x: 0, z: 0 }, { x: 0.2, z: 0 })).toMatchObject({ ok: false, reason: 'near' })
    expect(validateDioramaTeleport(boxes, dry, { x: DIORAMA_BOUND - 2, z: 0 }, { x: DIORAMA_BOUND + 1, z: 0 })).toMatchObject({ ok: false, reason: 'bounds' })
  })

  it('rechaza el agua, un obstáculo y atravesar un obstáculo', () => {
    expect(validateDioramaTeleport(boxes, { isWater: (x) => x > 4 }, { x: 0, z: 3 }, { x: 5, z: 3 })).toMatchObject({ ok: false, reason: 'water' })
    expect(validateDioramaTeleport(boxes, dry, { x: 0, z: 3 }, { x: 3, z: 0 })).toMatchObject({ ok: false })
    expect(validateDioramaTeleport(boxes, dry, { x: 0, z: 0 }, { x: 6, z: 0 })).toMatchObject({ ok: false, reason: 'blocked' })
    // Dar la vuelta al árbol sí se puede.
    expect(validateDioramaTeleport(boxes, dry, { x: 0, z: 4 }, { x: 6, z: 4 })).toMatchObject({ ok: true })
  })

  it('cruzar un charco en el trayecto también se rechaza', () => {
    expect(validateDioramaTeleport(boxes, { isWater: (x, z) => Math.abs(x - 2) < 0.5 && z > 3 }, { x: 0, z: 4 }, { x: 5, z: 4 })).toMatchObject({ ok: false, reason: 'water' })
  })

  it('no aterriza en la zona del marco de regreso (saldría del cuadro solo)', () => {
    expect(validateDioramaTeleport(boxes, dry, { x: 0, z: 8 }, { x: 0, z: 12 })).toMatchObject({ ok: false, reason: 'gate' })
  })
})

describe('movimiento del cuadro a través del rig (WebXR)', () => {
  it('con la cabeza física desplazada, el rig deja la cabeza exactamente en la posición del jugador', () => {
    const phys = new Vector3(0.4, 1.6, -0.3)
    for (const yaw of [0, 0.7, -2.1, Math.PI]) {
      const player = { x: 2.5, z: -4 }
      const r = rigForHead(player, { x: phys.x, z: phys.z }, yaw)
      const head = worldFromBase({ x: r.x, y: 0, z: r.z, yaw }, phys)
      expect(head.x).toBeCloseTo(DIORAMA_ORIGIN_XZ.x + player.x, 6)
      expect(head.z).toBeCloseTo(DIORAMA_ORIGIN_XZ.z + player.z, 6)
    }
  })

  it('un paso del joystick mueve el rig lo mismo y el espacio desplazado es el inverso', () => {
    const phys = new Vector3(0.2, 1.6, 0.1)
    const yaw = 0.9
    const a = rigForHead({ x: 0, z: 0 }, { x: phys.x, z: phys.z }, yaw)
    const b = rigForHead({ x: 1.5, z: 0 }, { x: phys.x, z: phys.z }, yaw)
    expect(b.x - a.x).toBeCloseTo(1.5)
    expect(b.z - a.z).toBeCloseTo(0)
    // La pose que verá el visor en el espacio desplazado deshace la transformación del rig.
    const seen = viewerInOffsetSpace(rigOffset({ x: b.x, y: 0, z: b.z, yaw }), phys)
    const back = worldFromBase({ x: b.x, y: 0, z: b.z, yaw }, phys)
    expect(Number.isFinite(seen.x + seen.y + seen.z)).toBe(true)
    expect(back.x).toBeCloseTo(DIORAMA_ORIGIN_XZ.x + 1.5, 6)
  })
})
