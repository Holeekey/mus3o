import type { Piece } from '@mus3o/shared'

export type PieceKind = 'key' | 'chest' | 'trap' | 'door' | 'standard'

// Los modelos de catálogo del dungeon (ver apps/web/public/models/catalog.json) marcan el tipo
// sin depender del texto del título, que puede contener cualquier palabra del usuario.
const CATALOG_KINDS: Record<string, PieceKind> = {
  dungeon_key: 'key',
  dungeon_chest: 'chest',
  dungeon_spikes: 'trap',
  dungeon_door: 'door',
}

export function pieceKind(piece: Piece): PieceKind {
  if (piece.model?.type === 'catalog') return CATALOG_KINDS[piece.model.id] ?? 'standard'
  return 'standard'
}
