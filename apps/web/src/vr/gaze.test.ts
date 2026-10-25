import { describe, expect, it } from 'vitest'
import { occluderDistance, pickGazeTarget, rayBox, rayFloor, raySphere, type GazeCandidate, type Ray } from './gaze'

type V = [number, number, number]
const ray = (o: V, d: V): Ray => {
  const l = Math.hypot(...d)
  return { o, d: [d[0] / l, d[1] / l, d[2] / l] }
}
const sphere = (key: string, kind: GazeCandidate['kind'], c: V, r = 0.5, maxDist = 10): GazeCandidate => ({ key, kind, shape: { type: 'sphere', c, r }, maxDist })
const quad = (key: string, kind: GazeCandidate['kind'], c: V, hw = 1, hh = 1): GazeCandidate => ({
  key,
  kind,
  shape: { type: 'quad', c, right: [1, 0, 0], up: [0, 1, 0], hw, hh },
  maxDist: 20,
})

describe('ray primitives', () => {
  it('sphere hit and miss', () => {
    expect(raySphere(ray([0, 0, 0], [0, 0, -1]), [0, 0, -5], 1)).toBeCloseTo(4)
    expect(raySphere(ray([0, 0, 0], [1, 0, 0]), [0, 0, -5], 1)).toBeNull()
    expect(raySphere(ray([0, 0, 0], [0, 0, 1]), [0, 0, -5], 1)).toBeNull() // detrás
  })
  it('floor only when looking down', () => {
    expect(rayFloor(ray([0, 1.7, 0], [0, -1, -1]))).toBeCloseTo(Math.hypot(1.7, 1.7))
    expect(rayFloor(ray([0, 1.7, 0], [0, 0.2, -1]))).toBeNull()
  })
  it('box occlusion', () => {
    const wall = { x: 0, z: -3, w: 6, d: 0.4, h: 3.6 }
    expect(rayBox(ray([0, 1.7, 0], [0, 0, -1]), wall)).toBeCloseTo(2.8)
    expect(occluderDistance(ray([0, 1.7, 0], [0, 0, 1]), [wall])).toBe(Infinity)
  })
})

describe('pickGazeTarget', () => {
  const eye: V = [0, 1.7, 0]
  const ahead = ray(eye, [0, 0, -1])

  it('returns null when nothing is in line', () => {
    expect(pickGazeTarget(ahead, [sphere('p', 'pedestal', [5, 1.7, -5])])).toBeNull()
  })

  it('the nearest target wins', () => {
    const hit = pickGazeTarget(ahead, [quad('door', 'door', [0, 1.7, -8]), sphere('ped', 'pedestal', [0, 1.7, -3])])
    expect(hit?.cand.key).toBe('ped')
  })

  it('ties go to the higher-priority kind (ui over portal, pedestal over door)', () => {
    const c: V = [0, 1.7, -3]
    expect(pickGazeTarget(ahead, [quad('d', 'door', c), sphere('p', 'pedestal', [0, 1.7, -3.4], 0.4)])?.cand.key).toBe('p')
    expect(pickGazeTarget(ahead, [quad('p', 'portal', c), quad('u', 'ui', c)])?.cand.key).toBe('u')
  })

  it('a panel in front blocks what is behind it', () => {
    const hit = pickGazeTarget(ahead, [quad('panel', 'blocker', [0, 1.7, -2]), sphere('ped', 'pedestal', [0, 1.7, -4])])
    expect(hit?.cand.kind).toBe('blocker')
  })

  it('ignores targets beyond their max distance', () => {
    expect(pickGazeTarget(ahead, [sphere('far', 'pedestal', [0, 1.7, -9], 0.5, 6)])).toBeNull()
  })

  it('ignores targets hidden behind a wall, but keeps those in front of it', () => {
    const behind = sphere('behind', 'pedestal', [0, 1.7, -6])
    const front = sphere('front', 'pedestal', [0, 1.7, -1.5], 0.3)
    expect(pickGazeTarget(ahead, [behind], { wallDistance: 3 })).toBeNull()
    expect(pickGazeTarget(ahead, [behind, front], { wallDistance: 3 })?.cand.key).toBe('front')
  })

  it('a door glued to its wall still counts thanks to its tolerance', () => {
    const door: GazeCandidate = { ...quad('door', 'door', [0, 1.7, -4]), occludeTol: 1.2 }
    expect(pickGazeTarget(ahead, [door], { wallDistance: 3.6 })?.cand.key).toBe('door')
  })

  it('the floor is the fallback when looking down and nothing is closer', () => {
    const hit = pickGazeTarget(ray(eye, [0, -1, -2]), [])
    expect(hit?.cand.kind).toBe('floor')
    expect(hit?.point[1]).toBeCloseTo(0)
    expect(hit?.point[2]).toBeCloseTo(-3.4)
  })

  it('an object in front of the floor point beats the floor', () => {
    const hit = pickGazeTarget(ray(eye, [0, -1, -2]), [sphere('ped', 'pedestal', [0, 1.0, -1.2], 0.5)])
    expect(hit?.cand.key).toBe('ped')
  })

  it('the floor is not a target too close, too far or behind a wall', () => {
    expect(pickGazeTarget(ray(eye, [0, -1, 0.01]), [], { floorMin: 2 })).toBeNull() // casi a los pies
    expect(pickGazeTarget(ray(eye, [0, -0.1, -1]), [], { floorMax: 5 })).toBeNull() // mirada rasante: el suelo queda a ~17 m
    expect(pickGazeTarget(ray(eye, [0, -1, -2]), [], { wallDistance: 2 })).toBeNull() // el muro cae antes que el punto (3,8 m)
  })
})
