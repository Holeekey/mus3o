import type { Piece, WikiInfo } from '@mus3o/shared'

// Texto del panel flotante. Pura: la ficha de escritorio (ConceptCard) es HTML y en un visor no se ve.

const MAX_CHARS = 440

const clip = (s: string, n: number) => (s.length <= n ? s : s.slice(0, Math.max(0, n - 1)).trimEnd() + '…')

/** De dónde sale el dato, en una línea corta (igual criterio que ConceptInfo). */
export function sourceNote(concept: Piece, wiki: WikiInfo | null | undefined): string | null {
  const parts: string[] = []
  if (concept.source) parts.push(`Tus apuntes${concept.source.line ? `, línea ${concept.source.line}` : ''}`)
  else if (concept.unverified) parts.push('No está en tus apuntes')
  if (wiki) parts.push(`${wiki.source} · ${wiki.title}`)
  return parts.length ? parts.join(' | ') : null
}

/** Cuerpo del panel: explicación, anclaje mnemotécnico o dato, y lo que se sabe de la fuente. Recortado para caber. */
export function panelBody(concept: Piece, wiki: WikiInfo | null | undefined): string {
  const blocks: string[] = []
  if (concept.text) blocks.push(concept.text.trim())
  if (concept.mnemonicCue) blocks.push(`Anclaje: ${concept.mnemonicCue.trim()}`)
  else if (concept.fact) blocks.push(concept.fact.trim())
  if (wiki?.extract && blocks.join('').length < MAX_CHARS * 0.6) blocks.push(`Para saber más: ${wiki.extract.trim()}`)
  return clip(blocks.join('\n\n'), MAX_CHARS)
}
