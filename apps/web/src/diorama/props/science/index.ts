import type { DioramaKind } from '../../dioramaSchema'
import type { Built, PropCtx } from '../common'
import { buildBloodCell, buildMuscleWall, buildNeuron, buildOrgan, buildPacemaker, buildValve, buildVesselMouth } from './anatomy'
import { buildAtp, buildDnaHelix, buildGolgi, buildMembraneProtein, buildMitochondrion, buildNucleus, buildRibosome, buildRoughER, buildVesicle } from './cell'
import { buildFlask, buildMicroscope, buildTestTubeRack } from './lab'

export const SCIENCE_KINDS = [
  'heart-chamber-valve', 'blood-cell', 'vessel-mouth', 'node-pacemaker', 'muscle-wall', 'neuron', 'organ',
  'nucleus', 'mitochondrion', 'ribosome', 'rough-er', 'golgi', 'dna-helix', 'atp', 'membrane-protein', 'vesicle',
  'microscope', 'flask', 'test-tube-rack',
] as const satisfies readonly DioramaKind[]

export type ScienceKind = (typeof SCIENCE_KINDS)[number]
export const isScienceKind = (k: string): k is ScienceKind => (SCIENCE_KINDS as readonly string[]).includes(k)

/** Altura (m, a escala 1) para colocar la etiqueta flotante encima del prop. */
export const SCIENCE_HEIGHT: Record<ScienceKind, number> = {
  'heart-chamber-valve': 3.4,
  'blood-cell': 1.4,
  'vessel-mouth': 5.6,
  'node-pacemaker': 5.0,
  'muscle-wall': 5.0,
  neuron: 6.5,
  organ: 4.6,
  nucleus: 12,
  mitochondrion: 4.2,
  ribosome: 1.5,
  'rough-er': 4.6,
  golgi: 5.0,
  'dna-helix': 7,
  atp: 1.9,
  'membrane-protein': 4.4,
  vesicle: 2.3,
  microscope: 1.8,
  flask: 1.3,
  'test-tube-rack': 1.4,
}

/** Radio de colisión (m, a escala 1); 0 = atravesable. */
export const SCIENCE_COLLIDER: Partial<Record<ScienceKind, number>> = {
  nucleus: 5.6,
  mitochondrion: 2.0,
  'rough-er': 2.8,
  golgi: 2.6,
  'dna-helix': 0.8,
  neuron: 1.2,
  organ: 1.4,
  microscope: 0.45,
  flask: 0.35,
  'test-tube-rack': 0.7,
  'membrane-protein': 0.9,
}

/** Tipos con variantes de geometría cuando hay varios. */
export const SCIENCE_VARIED: readonly ScienceKind[] = ['mitochondrion', 'ribosome', 'vesicle']

export function buildScienceProp(kind: ScienceKind, ctx: PropCtx, variant: number): Built {
  switch (kind) {
    case 'heart-chamber-valve':
      return buildValve(ctx)
    case 'blood-cell':
      return buildBloodCell(ctx)
    case 'vessel-mouth':
      return buildVesselMouth(ctx)
    case 'node-pacemaker':
      return buildPacemaker(ctx)
    case 'muscle-wall':
      return buildMuscleWall(ctx)
    case 'neuron':
      return buildNeuron(ctx)
    case 'organ':
      return buildOrgan(ctx)
    case 'nucleus':
      return buildNucleus(ctx)
    case 'mitochondrion':
      return buildMitochondrion(ctx, variant)
    case 'ribosome':
      return buildRibosome(ctx, variant)
    case 'rough-er':
      return buildRoughER(ctx)
    case 'golgi':
      return buildGolgi(ctx)
    case 'dna-helix':
      return buildDnaHelix(ctx)
    case 'atp':
      return buildAtp(ctx)
    case 'membrane-protein':
      return buildMembraneProtein(ctx)
    case 'vesicle':
      return buildVesicle(ctx, variant)
    case 'microscope':
      return buildMicroscope(ctx)
    case 'flask':
      return buildFlask(ctx)
    case 'test-tube-rack':
      return buildTestTubeRack(ctx)
  }
}
