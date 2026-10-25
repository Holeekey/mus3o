import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import {
  autoSepMm,
  DEFAULT_CALIB,
  defaultMmPerPx,
  dropLegacy,
  eyeShiftNdc,
  formatFov,
  formatSep,
  LEGACY_KEY,
  parseStored,
  resolveCalib,
  sanitizeCalib,
  stepFov,
  stepSep,
} from './calib'
import { shiftPrincipalPoint } from './stereo'

const iphone = { ...DEFAULT_CALIB, mmPerPx: 0.1655 }

describe('resolveCalib', () => {
  it('por defecto: separación auto (sin desplazamiento) y FOV 85', () => {
    const c = resolveCalib('', {})
    expect(c.sep).toBeNull()
    expect(c.fov).toBe(85)
  })

  it('lo guardado se aplica y la URL manda', () => {
    expect(resolveCalib('', { fov: 70, sep: 60 })).toMatchObject({ fov: 70, sep: 60 })
    expect(resolveCalib('?vrfov=100&vrsep=58', { fov: 70, sep: 60 })).toMatchObject({ fov: 100, sep: 58 })
  })

  it('?vripd= acepta metros o milímetros', () => {
    expect(resolveCalib('?vripd=0.065', {}).ipd).toBeCloseTo(0.065)
    expect(resolveCalib('?vripd=65', {}).ipd).toBeCloseTo(0.065)
  })

  it('basura en la URL se ignora', () => {
    expect(resolveCalib('?vrfov=abc&vrsep=', {}).sep).toBeNull()
  })

  it('mm por píxel: iPhone y Android distintos, ?vrmm= manda', () => {
    expect(defaultMmPerPx('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)')).toBeGreaterThan(defaultMmPerPx('Linux; Android 14'))
    expect(resolveCalib('?vrmm=0.2', {}, 'iPhone').mmPerPx).toBe(0.2)
  })

  it('valores absurdos se limitan', () => {
    const c = sanitizeCalib({ fov: 999, ipd: 5, sep: 900, mmPerPx: 0 })
    expect(c.fov).toBe(110)
    expect(c.ipd).toBeLessThanOrEqual(0.08)
    expect(c.sep).toBe(75)
    expect(c.mmPerPx).toBeGreaterThan(0)
    expect(sanitizeCalib({ ...DEFAULT_CALIB, fov: 1, sep: 1 })).toMatchObject({ fov: 60, sep: 50 })
  })
})

describe('almacenamiento', () => {
  it('v2: lee fov y sep, ignora basura', () => {
    expect(parseStored('{"fov":80,"sep":62}')).toEqual({ fov: 80, sep: 62 })
    expect(parseStored('{"fov":"a","sep":null}')).toEqual({})
    expect(parseStored('{no json')).toEqual({})
    expect(parseStored(null)).toEqual({})
  })

  it('el formato anterior (presets con k1/k2/lens) no aporta nada y su clave se borra', () => {
    const old = '{"preset":"vrbox","values":{"fov":92,"k1":0.22,"lens":40}}'
    expect(parseStored(old)).toEqual({})
    const store = new Map<string, string>([[LEGACY_KEY, old]])
    dropLegacy({ removeItem: (k) => void store.delete(k) })
    expect(store.has(LEGACY_KEY)).toBe(false)
  })

  it('dropLegacy tolera un almacenamiento bloqueado', () => {
    expect(() =>
      dropLegacy({
        removeItem: () => {
          throw new Error('blocked')
        },
      }),
    ).not.toThrow()
  })
})

describe('separación de lentes (desplazamiento off-axis)', () => {
  it('auto = 0', () => {
    expect(eyeShiftNdc(iphone, 852)).toBe(0)
  })

  it('la separación automática equivale a 0 de desplazamiento', () => {
    const auto = autoSepMm(852, iphone.mmPerPx)
    expect(eyeShiftNdc({ ...iphone, sep: auto }, 852)).toBeCloseTo(0, 9)
  })

  it('lentes más juntas que la automática: positivo (hacia el centro); más separadas: negativo', () => {
    const auto = autoSepMm(852, iphone.mmPerPx) // ≈ 70,5 mm
    expect(eyeShiftNdc({ ...iphone, sep: auto - 8 }, 852)).toBeGreaterThan(0)
    expect(eyeShiftNdc({ ...iphone, sep: auto + 4 }, 852)).toBeLessThan(0)
  })

  it('valor concreto: 62 mm en 852 px (0,1655 mm/px)', () => {
    // offsetPx = (852/4 − 62/2/0,1655) = 213 − 187,3 = 25,7;  ndc = 2·25,7 / 426
    expect(eyeShiftNdc({ ...iphone, sep: 62 }, 852)).toBeCloseTo((2 * (213 - 31 / 0.1655)) / 426, 6)
  })

  it('está acotado', () => {
    expect(Math.abs(eyeShiftNdc({ ...iphone, sep: 50 }, 100))).toBeLessThanOrEqual(0.6)
    expect(eyeShiftNdc({ ...iphone, sep: 60 }, 0)).toBe(0)
  })

  it('stepSep: parte de la automática redondeada, paso de 1 mm y topes 50–75', () => {
    expect(stepSep(iphone, 852, -1)).toBe(Math.round(autoSepMm(852, iphone.mmPerPx)) - 1)
    expect(stepSep({ ...iphone, sep: 62 }, 852, 1)).toBe(63)
    expect(stepSep({ ...iphone, sep: 50 }, 852, -1)).toBe(50)
    expect(stepSep({ ...iphone, sep: 75 }, 852, 1)).toBe(75)
  })

  it('stepFov: Zoom + acerca (menos FOV), paso de 4°, topes 60–110', () => {
    expect(stepFov(iphone, 1)).toBe(81)
    expect(stepFov(iphone, -1)).toBe(89)
    expect(stepFov({ ...iphone, fov: 60 }, 1)).toBe(60)
    expect(stepFov({ ...iphone, fov: 110 }, -1)).toBe(110)
  })

  it('texto del panel', () => {
    expect(formatSep(iphone, 852)).toBe('auto (≈ 71 mm)')
    expect(formatSep({ ...iphone, sep: 62.4 }, 852)).toBe('62 mm')
    expect(formatFov(iphone)).toBe('85°')
  })
})

describe('proyección descentrada', () => {
  const project = (m: THREE.Matrix4, x: number, z: number) => new THREE.Vector3(x, 0, z).applyMatrix4(m).x

  it('restar dx a elements[8] mueve la imagen +dx en NDC (hacia la derecha)', () => {
    const p = new THREE.PerspectiveCamera(85, 0.5, 0.1, 100).projectionMatrix.clone()
    const before = project(p, 1, -5)
    const shifted = p.clone()
    shiftPrincipalPoint(shifted, 0.1)
    expect(project(shifted, 1, -5) - before).toBeCloseTo(0.1, 6)
    expect(project(shifted, -3, -40) - project(p, -3, -40)).toBeCloseTo(0.1, 6) // igual a cualquier distancia
  })
})
