import { describe, expect, it } from 'vitest'
import { defaultMmPerPx, lensShift, nextPreset, parseStored, PRESETS, resolveCalib, sanitizeCalib, usesDistortion } from './calib'
import { edgeZoom } from './distort'

describe('resolveCalib', () => {
  it('por defecto: sin corrección (los presets de lente son opcionales)', () => {
    const r = resolveCalib('', {})
    expect(r.preset).toBe('none')
    expect(r.calib.fov).toBe(PRESETS.none.calib.fov)
    expect(r.calib.lens).toBe(0)
    expect(resolveCalib('', { preset: 'vrbox' }).calib.lens).toBe(32)
    expect(usesDistortion(r.calib)).toBe(false)
  })

  it('los parámetros de URL mandan sobre lo guardado', () => {
    const r = resolveCalib('?vrfov=100&vripd=62&vrk1=0.3&vrk2=0.1&vrlens=28', { preset: 'cardboard', values: { fov: 70 } })
    expect(r.calib).toMatchObject({ fov: 100, ipd: 0.062, k1: 0.3, k2: 0.1, lens: 28 })
    expect(r.preset).toBe('custom')
  })

  it('?vripd= acepta metros o milímetros', () => {
    expect(resolveCalib('?vripd=0.065', {}).calib.ipd).toBeCloseTo(0.065)
    expect(resolveCalib('?vripd=65', {}).calib.ipd).toBeCloseTo(0.065)
  })

  it('?vrpreset= elige el preset e ignora los valores guardados', () => {
    const r = resolveCalib('?vrpreset=none', { preset: 'vrbox', values: { fov: 120 } })
    expect(r.preset).toBe('none')
    expect(usesDistortion(r.calib)).toBe(false)
    expect(r.calib.fov).toBe(PRESETS.none.calib.fov)
  })

  it('lo guardado se aplica y la basura se ignora', () => {
    expect(resolveCalib('', { preset: 'cardboard' }).calib.k1).toBe(PRESETS.cardboard.calib.k1)
    expect(resolveCalib('?vrfov=abc&vrk1=', {}).preset).toBe('none')
    expect(parseStored('{no json')).toEqual({})
    expect(parseStored('{"preset":"x","values":{"fov":"a","k1":0.2}}')).toEqual({ values: { k1: 0.2 } })
    expect(parseStored(null)).toEqual({})
  })

  it('valores absurdos se limitan para no dejar la pantalla en negro', () => {
    const c = sanitizeCalib({ fov: 999, ipd: 5, k1: 50, k2: -50, lens: 900, mmPerPx: 0 })
    expect(c.fov).toBeLessThanOrEqual(130)
    expect(c.ipd).toBeLessThanOrEqual(0.08)
    expect(c.k1).toBeLessThanOrEqual(0.8)
    expect(c.k2).toBeGreaterThanOrEqual(-0.2)
    expect(c.lens).toBeLessThanOrEqual(60)
    expect(c.mmPerPx).toBeGreaterThan(0)
  })

  it('mm por píxel: iPhone y Android distintos, ?vrmm= manda', () => {
    expect(defaultMmPerPx('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)')).toBeGreaterThan(defaultMmPerPx('Linux; Android 14'))
    expect(resolveCalib('?vrmm=0.2', {}, 'iPhone').calib.mmPerPx).toBe(0.2)
  })

  it('el cambio rápido recorre los presets y vuelve', () => {
    expect(nextPreset('none')).toBe('vrbox')
    expect(nextPreset('vrbox')).toBe('cardboard')
    expect(nextPreset('cardboard')).toBe('none')
    expect(nextPreset('custom')).toBe('none')
  })
})

describe('centro de la lente', () => {
  it('iPhone 6,1" apaisado: 32 mm del centro lleva el centro del ojo unos 20 px hacia dentro (de 852 px)', () => {
    const c = { ...PRESETS.vrbox.calib, mmPerPx: 0.1655 }
    const px = lensShift(c, 852) * (852 / 2)
    expect(px).toBeCloseTo(852 / 2 - 32 / 0.1655 - 852 / 4, 3)
    expect(px).toBeGreaterThan(15)
    expect(px).toBeLessThan(25)
  })

  it('lens = 0 no desplaza', () => {
    expect(lensShift({ ...PRESETS.none.calib, mmPerPx: 0.16 }, 852)).toBe(0)
  })

  it('el zoom deja el borde vertical en la textura', () => {
    expect(edgeZoom(0.22, 0.06)).toBeCloseTo(1 / 1.28)
    expect(edgeZoom(0, 0)).toBe(1)
  })
})
