import { describe, expect, it } from 'vitest'
import { Vector3 } from 'three'
import { rigOffset, viewerInOffsetSpace, worldFromBase } from './rig'

describe('rigOffset (WebXR)', () => {
  const rigs = [
    { x: 18.04, y: 0.1, z: -4.7, yaw: -2.36 },
    { x: 0, y: 0, z: 0, yaw: 0 },
    { x: -7, y: 1.2, z: 31, yaw: Math.PI / 2 },
    { x: 1500, y: 0.3, z: 1510.6, yaw: 3.0 },
  ]
  const heads = [new Vector3(0, 1.6, 0), new Vector3(0.3, 1.55, -0.2), new Vector3(-1, 1.8, 2)]

  it('the viewer in the shifted space ends up where the rig says (rig + R(yaw)·head)', () => {
    for (const rig of rigs)
      for (const head of heads) {
        const seen = viewerInOffsetSpace(rigOffset(rig), head)
        const expected = worldFromBase(rig, head)
        expect(seen.distanceTo(expected)).toBeLessThan(1e-6)
      }
  })

  it('yaw 0 reduces to the three.js teleport pattern: offset = -target', () => {
    const o = rigOffset({ x: 3, y: 0, z: -2, yaw: 0 })
    expect(o.position.x).toBeCloseTo(-3)
    expect(o.position.z).toBeCloseTo(2)
    expect(o.orientation.w).toBeCloseTo(1)
  })

  it('a fixed eye height: rig.y = EYE - physical height puts the eyes at EYE', () => {
    const EYE = 1.7
    const physical = new Vector3(0, 1.6, 0)
    const rig = { x: 5, y: EYE - physical.y, z: 5, yaw: 0.7 }
    expect(viewerInOffsetSpace(rigOffset(rig), physical).y).toBeCloseTo(EYE)
    // un visor 3DoF que reporta altura 0 también queda a la altura de ojos
    const flat = new Vector3(0, 0, 0)
    expect(viewerInOffsetSpace(rigOffset({ ...rig, y: EYE - flat.y }), flat).y).toBeCloseTo(EYE)
  })
})
