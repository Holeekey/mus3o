import { useEffect, useRef, useState } from 'react'
import { LIMITS, type Source } from '@mus3o/shared'
import type { ImageAttachment } from '../lib/files'

export const ACCEPT = '.docx,.doc,.xlsx,.xls,.csv,.txt,.md,.json,.png,.jpg,.jpeg,.webp'

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

/** Panel lateral de fuentes: adjuntar, arrastrar y quitar archivos. */
export function SourcesPanel({ open, onClose, attachments, onAdd, onRemove, error }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    if (!open) return
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  const { label, willDigest } = sourcesSummary(attachments)

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} aria-hidden />
      <aside className="drawer" role="dialog" aria-modal="true" aria-labelledby="sources-title">
        <header className="drawer-header">
          <h2 id="sources-title">Fuentes</h2>
          <button ref={closeRef} className="drawer-close" onClick={onClose} aria-label="Cerrar fuentes">
            ✕
          </button>
        </header>
        <p className="drawer-lead">
          Word, Excel, CSV, texto, JSON o imágenes. Se leen en tu navegador: solo viaja el texto.
        </p>

        <button className="btn btn-primary drawer-add" onClick={() => inputRef.current?.click()}>
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
          className={dragging ? 'dropzone dropzone-active' : 'dropzone'}
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

        {error && <p className="error drawer-error">{error}</p>}

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
            <p className="drawer-summary">
              {label}
              {willDigest && <span className="warn"> · se resumirán con IA antes de generar</span>}
            </p>
          </>
        ) : (
          <p className="drawer-empty">Todavía no hay archivos.</p>
        )}

        <p className="drawer-hint">
          Lo que escribas en «Tus apuntes» se usa como pedido (por ejemplo, «enfócate en las lunas»). Si es largo, se
          toma como un apunte más.
        </p>
      </aside>
    </>
  )
}
