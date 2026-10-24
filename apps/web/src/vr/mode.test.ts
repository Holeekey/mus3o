import { describe, expect, it } from 'vitest'
import { parseVrFlag, selectVrMode } from './mode'

describe('parseVrFlag', () => {
  it('reads ?vr=', () => {
    expect(parseVrFlag('?demo=historia&vr=cardboard')).toBe('cardboard')
    expect(parseVrFlag('?vr=xr')).toBe('xr')
    expect(parseVrFlag('?vr=off')).toBe('off')
  })
  it('ignores missing or unknown values', () => {
    expect(parseVrFlag('')).toBeNull()
    expect(parseVrFlag('?vr=banana')).toBeNull()
  })
})

describe('selectVrMode', () => {
  const base = { force: null, xrSupported: false, touch: false } as const
  it('prefers WebXR when the browser supports it', () => {
    expect(selectVrMode({ ...base, xrSupported: true, touch: true })).toBe('xr')
    expect(selectVrMode({ ...base, xrSupported: true })).toBe('xr')
  })
  it('falls back to cardboard on touch devices without WebXR (iOS Safari)', () => {
    expect(selectVrMode({ ...base, touch: true })).toBe('cardboard')
  })
  it('offers nothing on desktop without WebXR', () => {
    expect(selectVrMode(base)).toBe('none')
  })
  it('?vr=cardboard forces the fallback even on desktop or with WebXR', () => {
    expect(selectVrMode({ ...base, force: 'cardboard' })).toBe('cardboard')
    expect(selectVrMode({ ...base, force: 'cardboard', xrSupported: true })).toBe('cardboard')
  })
  it('?vr=off disables everything; ?vr=xr forces WebXR', () => {
    expect(selectVrMode({ ...base, force: 'off', xrSupported: true, touch: true })).toBe('none')
    expect(selectVrMode({ ...base, force: 'xr' })).toBe('xr')
  })
})
