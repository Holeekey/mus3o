import type { Piece, ResolvedImage } from '@mus3o/shared'
import { creditLine } from '../lib/images'
import { shortUrl, useWikiInfo } from '../lib/info'

/**
 * Solo en la ficha de exploración (nunca en un examen: daría la respuesta).
 * "Para saber más": el resumen de Wikipedia recuperado por el servidor, y "Fuentes": de dónde sale cada dato.
 */
export function ConceptInfo({ concept, image }: { concept: Piece; image: ResolvedImage | null | undefined }) {
  const info = useWikiInfo(concept.imageSearch)

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
          <p>{info.extract}</p>
        </section>
      )}
      {(notes || info || image) && (
        <section className="card-sources">
          <h3>Fuentes</h3>
          <ul>
            {notes && <li className={concept.source ? undefined : 'card-src-warn'}>{notes}</li>}
            {info && (
              <li>
                <span>
                  {info.source} · «{info.title}» · {info.license}
                </span>
                <span className="card-src-url">{shortUrl(info.url)}</span>
                <a className="card-src-open" href={info.url} target="_blank" rel="noopener noreferrer">
                  Abrir artículo
                </a>
              </li>
            )}
            {image && <li>Imagen: {creditLine(image)}</li>}
          </ul>
        </section>
      )}
    </>
  )
}
