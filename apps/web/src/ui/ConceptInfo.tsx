import { useLayoutEffect, useRef, useState } from 'react'
import type { Piece, ResolvedImage } from '@mus3o/shared'
import { useWikiInfo } from '../lib/info'

/**
 * Renglones visibles de "Para saber más" antes de "Leer más": con imagen la ficha tiene menos lugar.
 * Mientras la imagen carga (`undefined`) se reserva como si la hubiera, para que no salte.
 */
export function extractLines(image: ResolvedImage | null | undefined): number {
  return image === null ? 8 : 4
}

/**
 * Solo en la ficha de exploración (nunca en un examen: daría la respuesta).
 * "Para saber más": el resumen de Wikipedia recuperado por el servidor, y "Fuentes": de dónde sale cada dato.
 */
export function ConceptInfo({ concept, image }: { concept: Piece; image: ResolvedImage | null | undefined }) {
  const info = useWikiInfo(concept.imageSearch)
  const lines = extractLines(image)
  const [expanded, setExpanded] = useState(false)
  const [overflows, setOverflows] = useState(false)
  const extract = useRef<HTMLParagraphElement>(null)
  // "Leer más" solo aparece si el texto de verdad no cabe en los renglones asignados.
  useLayoutEffect(() => {
    const el = extract.current
    if (el && !expanded) setOverflows(el.scrollHeight > el.clientHeight + 1)
  }, [info, lines, expanded])

  const notes = concept.source
    ? `Tus apuntes${concept.source.line ? ` · línea ${concept.source.line}` : ''}`
    : concept.unverified
      ? 'No está en tus apuntes'
      : null

  return (
    <>
      {info === undefined && (
        <section className="card-more" aria-busy="true" aria-label="Para saber más">
          <h3>Para saber más</h3>
          <div className="card-skeleton" aria-hidden>
            <i />
            <i />
            <i />
          </div>
        </section>
      )}
      {info && (
        <section className="card-more">
          <h3>Para saber más</h3>
          <p
            ref={extract}
            className={expanded ? undefined : 'card-more-clamp'}
            style={expanded ? undefined : ({ '--lines': lines } as React.CSSProperties)}
          >
            {info.extract}
          </p>
          {(overflows || expanded) && (
            <button type="button" className="card-more-toggle" onClick={() => setExpanded((v) => !v)}>
              {expanded ? 'Ver menos' : 'Leer más'}
            </button>
          )}
        </section>
      )}
      {(notes || info) && (
        // Una línea: de dónde sale cada dato. El crédito de la imagen ya va bajo la foto.
        <p className="card-sources">
          <span className="card-sources-label">Fuentes:</span>{' '}
          {notes && <span className={concept.source ? undefined : 'card-src-warn'}>{notes}</span>}
          {notes && info && ' · '}
          {info && (
            <>
              {info.source}, {info.license}{' '}
              <a className="card-src-open" href={info.url} target="_blank" rel="noopener noreferrer">
                Abrir artículo
              </a>
            </>
          )}
        </p>
      )}
    </>
  )
}
