import { describe, expect, it } from 'vitest'
import { MuseumSchema, PartSchema } from '@mus3o/shared'
import { fitParts } from '../../scene/fitModel'
import {
  ramStick,
  aluChip,
  controlUnit,
  registerFile,
  systemClock,
  cacheL1,
  nvmeSsd,
  dataBus,
  addressBus,
  controlBus,
  pcTower,
  keyboard,
  mouse,
  monitor,
  motherboard,
} from './pcAssets'
import {
  phospholipidBilayer,
  proteinChannel,
  sodiumPotassiumPump,
  atpSynthase,
  krebsCycle,
  cristaeMitochondria,
  dnaDoubleHelix,
  mrnaTranscription,
  ribosomeTranslation,
} from './bioAssets'
import {
  corinthianColumn,
  rostraSpeakers,
  romanLaw,
  curiaIulia,
  fasces,
  meditationsAurelius,
  romanScutum,
  gladiusHispaniensis,
  viaAppia,
} from './romanAssets'
import { PRESET_PALACES } from '../presets'

describe('PC Procedural Assets', () => {
  const pcBuilders = [
    { name: 'ramStick', fn: ramStick },
    { name: 'aluChip', fn: aluChip },
    { name: 'controlUnit', fn: controlUnit },
    { name: 'registerFile', fn: registerFile },
    { name: 'systemClock', fn: systemClock },
    { name: 'cacheL1', fn: cacheL1 },
    { name: 'nvmeSsd', fn: nvmeSsd },
    { name: 'dataBus', fn: dataBus },
    { name: 'addressBus', fn: addressBus },
    { name: 'controlBus', fn: controlBus },
    { name: 'pcTower', fn: pcTower },
    { name: 'keyboard', fn: keyboard },
    { name: 'mouse', fn: mouse },
    { name: 'monitor', fn: monitor },
    { name: 'motherboard', fn: motherboard },
  ]

  for (const { name, fn } of pcBuilders) {
    it(`generates valid procedural parts for ${name}`, () => {
      const parts = fn()
      expect(parts.length).toBeGreaterThanOrEqual(3)
      expect(parts.length).toBeLessThanOrEqual(40)

      for (const p of parts) {
        expect(() => PartSchema.parse(p)).not.toThrow()
        expect(p.color).toMatch(/^#[0-9a-fA-F]{3,8}$/)
      }

      const fit = fitParts(parts)
      expect(fit.scale).toBeGreaterThan(0)
      expect(Number.isFinite(fit.scale)).toBe(true)
      expect(fit.offset.every(Number.isFinite)).toBe(true)
    })
  }

  it('supports custom palette colors in ramStick', () => {
    const custom = ramStick({ pcb: '#112233', accent: '#ff00ff' })
    expect(custom.some((p) => p.color === '#112233')).toBe(true)
    expect(custom.some((p) => p.color === '#ff00ff')).toBe(true)
  })
})

describe('Biology & Roman Procedural Assets', () => {
  const otherBuilders = [
    { name: 'phospholipidBilayer', fn: phospholipidBilayer },
    { name: 'proteinChannel', fn: proteinChannel },
    { name: 'sodiumPotassiumPump', fn: sodiumPotassiumPump },
    { name: 'atpSynthase', fn: atpSynthase },
    { name: 'krebsCycle', fn: krebsCycle },
    { name: 'cristaeMitochondria', fn: cristaeMitochondria },
    { name: 'dnaDoubleHelix', fn: dnaDoubleHelix },
    { name: 'mrnaTranscription', fn: mrnaTranscription },
    { name: 'ribosomeTranslation', fn: ribosomeTranslation },
    { name: 'corinthianColumn', fn: corinthianColumn },
    { name: 'rostraSpeakers', fn: rostraSpeakers },
    { name: 'romanLaw', fn: romanLaw },
    { name: 'curiaIulia', fn: curiaIulia },
    { name: 'fasces', fn: fasces },
    { name: 'meditationsAurelius', fn: meditationsAurelius },
    { name: 'romanScutum', fn: romanScutum },
    { name: 'gladiusHispaniensis', fn: gladiusHispaniensis },
    { name: 'viaAppia', fn: viaAppia },
  ]

  for (const { name, fn } of otherBuilders) {
    it(`generates valid procedural parts for ${name}`, () => {
      const parts = fn()
      expect(parts.length).toBeGreaterThanOrEqual(3)
      expect(parts.length).toBeLessThanOrEqual(40)

      for (const p of parts) {
        expect(() => PartSchema.parse(p)).not.toThrow()
      }

      const fit = fitParts(parts)
      expect(fit.scale).toBeGreaterThan(0)
      expect(Number.isFinite(fit.scale)).toBe(true)
    })
  }
})

describe('PRESET_PALACES procedural models', () => {
  it('has 3 preset museums, all valid against MuseumSchema', () => {
    expect(PRESET_PALACES.length).toBe(3)
    for (const preset of PRESET_PALACES) {
      expect(() => MuseumSchema.parse(preset.museum)).not.toThrow()
    }
  })

  it('every piece in all preset palaces uses a detailed procedural model', () => {
    let totalPieces = 0
    for (const preset of PRESET_PALACES) {
      for (const room of preset.museum.rooms) {
        for (const piece of room.pieces) {
          totalPieces++
          expect(piece.model).toBeDefined()
          expect(piece.model?.type).toBe('procedural')
          if (piece.model?.type === 'procedural') {
            expect(piece.model.parts.length).toBeGreaterThanOrEqual(3)
            expect(piece.model.parts.length).toBeLessThanOrEqual(40)
            const fit = fitParts(piece.model.parts)
            expect(fit.scale).toBeGreaterThan(0)
          }
        }
      }
    }
    expect(totalPieces).toBe(28)
  })
})
