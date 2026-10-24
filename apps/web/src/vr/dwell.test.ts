import { describe, expect, it } from 'vitest'
import { DWELL_DEFAULTS, dwellIdle, forceDwellFire, updateDwell, type DwellState, type DwellTarget } from './dwell'

// Avanza el estado en pasos de 0,1 s mirando `target` durante `secs`.
function gaze(state: DwellState, target: DwellTarget | null, secs: number, step = 0.1) {
  let fired = 0
  let progress = 0
  const n = Math.round(secs / step)
  for (let i = 0; i < n; i++) {
    const r = updateDwell(state, target, step)
    state = r.state
    progress = r.progress
    if (r.fired) fired++
  }
  return { state, fired, progress }
}

const A: DwellTarget = { key: 'ped:a' }
const B: DwellTarget = { key: 'ped:b' }

describe('dwell', () => {
  it('fires once after the configured time and not before', () => {
    const early = gaze(dwellIdle(), A, DWELL_DEFAULTS.duration - 0.2)
    expect(early.fired).toBe(0)
    expect(early.progress).toBeGreaterThan(0.8)
    expect(early.progress).toBeLessThan(1)
    const done = gaze(early.state, A, 0.4)
    expect(done.fired).toBe(1)
    expect(done.progress).toBe(1)
  })

  it('does not fire again while the same target keeps being looked at', () => {
    expect(gaze(dwellIdle(), A, 6).fired).toBe(1)
  })

  it('changing target restarts the timer', () => {
    const a = gaze(dwellIdle(), A, 1.0)
    const b = gaze(a.state, B, 1.0)
    expect(b.fired).toBe(0)
    expect(b.progress).toBeCloseTo(1.0 / DWELL_DEFAULTS.duration, 1)
  })

  it('tolerates a short loss (grace) but resets after a long one', () => {
    const a = gaze(dwellIdle(), A, 1.0)
    const blink = gaze(a.state, null, 0.2) // dentro de la gracia
    expect(gaze(blink.state, A, 0.6).fired).toBe(1)

    const lost = gaze(a.state, null, 0.5) // fuera de la gracia
    expect(lost.state.key).toBeNull()
    expect(gaze(lost.state, A, 0.6).fired).toBe(0)
  })

  it('re-arms only after the gaze leaves the target', () => {
    let r = gaze(dwellIdle(), A, 2)
    expect(r.fired).toBe(1)
    r = gaze(r.state, null, 0.5)
    r = gaze(r.state, A, 2)
    expect(r.fired).toBe(1)
  })

  it('a floor point that drifts too far restarts the dwell, small jitter does not', () => {
    const at = (x: number): DwellTarget => ({ key: 'floor', point: [x, 0, 3] })
    let s = dwellIdle()
    for (let i = 0; i < 8; i++) s = updateDwell(s, at(i % 2 ? 0.2 : 0), 0.1).state // temblor de 20 cm
    expect(s.t).toBeCloseTo(0.8, 5)
    s = updateDwell(s, at(3), 0.1).state // 3 m más allá
    expect(s.t).toBeCloseTo(0.1, 5)
  })

  it('an instant press fires immediately, once per gaze', () => {
    const first = forceDwellFire(dwellIdle(), A)
    expect(first.fired).toBe(true)
    expect(forceDwellFire(first.state, A).fired).toBe(false)
    expect(forceDwellFire(dwellIdle(), null).fired).toBe(false)
  })

  it('after a press the dwell does not fire a second time', () => {
    const press = forceDwellFire(dwellIdle(), A)
    expect(gaze(press.state, A, 3).fired).toBe(0)
  })
})
