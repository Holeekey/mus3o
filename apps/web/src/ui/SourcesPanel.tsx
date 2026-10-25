import { useEffect, useRef, useState } from 'react'
import { LIMITS, type Source } from '@mus3o/shared'
import type { ImageAttachment } from '../lib/files'

export const ACCEPT = '.pdf,.docx,.doc,.xlsx,.xls,.csv,.txt,.md,.json,.png,.jpg,.jpeg,.webp'

export type Attachment = { id: string; kind: 'text'; source: Source } | { id: string; kind: 'image'; image: ImageAttachment }

/** "3 fuentes · 1 240 caracteres · 1 imagen", y si el texto se resumirá con IA antes de generar. */
export function sourcesSummary(attachments: Attachment[]): { label: string; willDigest: boolean } {
  const texts = attachments.flatMap((a) => (a.kind === 'text' ? [a.source] : []))
  const images = attachments.length - texts.length
  const chars = texts.reduce((n, s) => n + s.text.length, 0)
  const parts = [
    `${attachments.length} ${attachments.length === 1 ? 'fuente' : 'fuentes'}`,
    ...(texts.length ? [`${chars.toLocaleString('es')} caracteres`] : []),
    ...(images ? [`${images} ${images === 1 ? 'imagen' : 'imágenes'}`] : []),
  ]
  return { label: parts.join(' · '), willDigest: chars > LIMITS.maxNotesChars || texts.length > 5 }
}

type Props = {
  open: boolean
  onClose: () => void
  attachments: Attachment[]
  onAdd: (files: File[]) => void
  onRemove: (id: string) => void
  error: string | null
}

/** Columna de fuentes dentro del recuadro del editor: adjuntar, arrastrar y quitar archivos. */
export function SourcesPanel({ open, onClose, attachments, onAdd, onRemove, error }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    if (open) closeRef.current?.focus()
  }, [open])

  if (!open) return null
  const { label, willDigest } = sourcesSummary(attachments)

  return (
    <aside
      id="sources-panel"
      className="sources-panel"
      aria-labelledby="sources-title"
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
    >
      <header className="sources-header">
        <h2 id="sources-title">Fuentes</h2>
        <button ref={closeRef} className="sources-close" onClick={onClose} aria-label="Cerrar fuentes">
          ✕
        </button>
      </header>
      <p className="sources-lead">
        PDF, Word, Excel, CSV, texto, JSON o imágenes. Se leen en tu navegador.
      </p>

      <button className="btn sources-add" onClick={() => inputRef.current?.click()}>
        + Adjuntar archivos
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        hidden
        onChange={(e) => {
          onAdd(Array.from(e.target.files ?? []))
          e.target.value = ''
        }}
      />

      <div
        className={dragging ? 'sources-drop sources-drop-active' : 'sources-drop'}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          onAdd(Array.from(e.dataTransfer.files))
        }}
      >
        Arrastra aquí tus archivos
      </div>

      {error && <p className="error sources-error">{error}</p>}

      {attachments.length > 0 ? (
        <>
          <ul className="attachments attachments-list" aria-label="Archivos adjuntos">
            {attachments.map((a) => (
              <li key={a.id} className="attachment">
                {a.kind === 'image' ? (
                  <img src={a.image.previewUrl} alt="" className="attachment-thumb" />
                ) : (
                  <span className="attachment-kind">{a.source.kind}</span>
                )}
                <span className="attachment-name">{a.kind === 'image' ? a.image.image.name : a.source.name}</span>
                {a.kind === 'text' && (
                  <span className="attachment-meta">{a.source.text.length.toLocaleString('es')} car.</span>
                )}
                <button className="attachment-remove" onClick={() => onRemove(a.id)} aria-label="Quitar archivo">
                  ×
                </button>
              </li>
            ))}
          </ul>
          <p className="sources-summary">
            {label}
            {willDigest && <span className="warn"> · se resumirán con IA antes de generar</span>}
          </p>
        </>
      ) : (
        <p className="sources-empty">Todavía no hay archivos.</p>
      )}

      <p className="sources-hint">
        Lo que escribas al lado es tu pedido (por ejemplo, «enfócate en las lunas»). Si es largo, se suma como un
        apunte más.
      </p>
    </aside>
  )
}
