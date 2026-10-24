import { useDeferredValue, useEffect, useMemo, useRef, useState, lazy, Suspense } from 'react'
import { countSources, LIMITS, type Museum, type Source } from '@mus3o/shared'
import { generateMuseum, generateMuseumFromFiles, type FilesStage } from '../lib/api'
import { fileKindOf, readImageAttachment, readTextAttachment, type ImageAttachment } from '../lib/files'
import { dungeonDemoMuseum } from '../mocks/dungeon'
import { EXAMPLE_TEXT } from '../palace/example'
import { PRESET_PALACES } from '../palace/presets'
import { buildLayout } from '../palace/layout'
import { detectFormat, MAX_INPUT_CHARS, parsePalace } from '../palace/parse'
import { dueCountFor } from '../memory/hooks'
import { dueLabel } from '../memory/dueLabel'
import { useStore } from '../store'
import { FreeExploreToggle } from './FreeExploreToggle'

// La maqueta 3D se carga aparte para que three.js no bloquee la primera pintura de la landing.
const Preview = lazy(() => import('../scene/Preview').then((m) => ({ default: m.Preview })))

const PLACEHOLDER = ['# Tema 1', '- Concepto A: explicación', '- Concepto B', '', '# Tema 2', '- Concepto C'].join(String.fromCharCode(10))
// Peso máximo de cada archivo antes de leerlo (las imágenes se achican después a 1024 px).
const MAX_FILE_BYTES = 15 * 1024 * 1024
// Lo que acepta el prompt maestro: hasta 10 archivos de texto y 100.000 caracteres cada uno.
const MAX_TEXT_FILES = 10
const MAX_TEXT_FILE_CHARS = 100_000
const ACCEPT = '.docx,.doc,.xlsx,.xls,.csv,.txt,.md,.json,.png,.jpg,.jpeg,.webp'

type Attachment = { id: string; kind: 'text'; source: Source } | { id: string; kind: 'image'; image: ImageAttachment }

const nextImageId = (list: Attachment[]) => {
  const used = new Set(list.map((a) => a.id))
  let n = 1
  while (used.has(`img-${n}`)) n++
  return `img-${n}`
}

/** "17 de 17 conceptos verificados en tus apuntes" o "15 de 17 · 2 sin fuente". */
export function sourceSummary(palace: Museum): string {
  const { total, verified, unverified } = countSources(palace)
  return unverified === 0
    ? `${verified} de ${total} conceptos verificados en tus apuntes`
    : `${verified} de ${total} · ${unverified} sin fuente`
}

export function Landing() {
  const enterPalace = useStore((s) => s.enterPalace)
  const resume = useStore((s) => s.resume)
  const saved = useStore((s) => s.palace)
  // Una sola vez por render: la landing se vuelve a renderizar en cada tecla del editor.
  const dueText = dueLabel(dueCountFor(saved))
  const [input, setInput] = useState(EXAMPLE_TEXT)
  const [fileError, setFileError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [aiStage, setAiStage] = useState<FilesStage>('generating')
  const [aiState, setAiState] = useState<'idle' | 'loading'>('idle')
  const [aiError, setAiError] = useState<string | null>(null)
  // Palacio generado con IA a la espera de entrar: deja ver cuántos conceptos se verificaron.
  const [aiResult, setAiResult] = useState<{ palace: Museum; text: string; userImages?: Record<string, string> } | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  useEffect(() => () => abortRef.current?.abort(), [])

  const generateWithAi = async () => {
    const withFiles = attachments.length > 0
    if ((!input.trim() && !withFiles) || aiState === 'loading') return
    // Sin adjuntos, el server acepta hasta LIMITS.maxNotesChars caracteres de apuntes para la IA.
    // Con adjuntos, el prompt maestro resume lo que no entra.
    if (!withFiles && input.trim().length > LIMITS.maxNotesChars) {
      setAiError(`Para generar con IA usa hasta ${LIMITS.maxNotesChars.toLocaleString('es')} caracteres (tienes ${input.trim().length.toLocaleString('es')}). Puedes construir el palacio sin IA con todo el texto.`)
      return
    }
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setAiError(null)
    setAiResult(null)
    setAiState('loading')
    setAiStage('generating')
    try {
      const sources = attachments.flatMap((a) => (a.kind === 'text' ? [a.source] : []))
      const images = attachments.flatMap((a) => (a.kind === 'image' ? [a.image] : []))
      // El texto de ejemplo que trae el editor no se mezcla con los archivos del usuario.
      const typed = input === EXAMPLE_TEXT ? '' : input
      const palace = withFiles
        ? await generateMuseumFromFiles({ prompt: typed, sources, images: images.map((i) => i.image) }, setAiStage, controller.signal)
        : await generateMuseum(input, controller.signal)
      // Las imágenes del usuario se cuelgan en los cuadros: viajan al palacio por id.
      const userImages = Object.fromEntries(images.map((i) => [i.image.id, i.previewUrl]))
      // Texto con el que se verifican las citas: lo escrito más lo extraído de los archivos.
      const text = [(withFiles ? typed : input).trim(), ...sources.map((s) => s.text)].filter(Boolean).join('\n\n')
      const { verified, unverified } = countSources(palace)
      if (verified + unverified === 0) enterPalace(palace, text, userImages)
      else setAiResult({ palace, text, userImages })
    } catch (e) {
      if (controller.signal.aborted) return
      const status = (e as { status?: number }).status
      setAiError(
        status === 503
          ? 'La IA no está configurada en el servidor. Puedes construir el palacio sin IA.'
          : status === 429
            ? 'Demasiadas solicitudes. Intenta en un minuto.'
            : 'No pudimos generar el palacio con IA. Intenta de nuevo o constrúyelo sin IA.',
      )
    } finally {
      if (!controller.signal.aborted) setAiState('idle')
    }
  }

  const deferred = useDeferredValue(input)
  // El formato se detecta solo: un JSON pegado (p. ej. un palacio exportado) se sigue aceptando.
  const result = useMemo(() => parsePalace(deferred, detectFormat(deferred)), [deferred])
  const layout = useMemo(() => (result.ok ? buildLayout(result.palace) : null), [result])
  const conceptCount = result.ok ? result.palace.rooms.reduce((n, r) => n + r.pieces.length, 0) : 0

  const onFiles = async (files: FileList | null) => {
    setFileError(null)
    setAiResult(null)
    const errors: string[] = []
    let list = attachments
    for (const file of Array.from(files ?? [])) {
      try {
        if (file.size > MAX_FILE_BYTES) throw new Error(`"${file.name}" pesa más de 15 MB.`)
        if (fileKindOf(file.name) === 'image') {
          if (list.filter((a) => a.kind === 'image').length >= LIMITS.maxImages) {
            throw new Error(`Puedes adjuntar hasta ${LIMITS.maxImages} imágenes.`)
          }
          const id = nextImageId(list)
          list = [...list, { id, kind: 'image', image: await readImageAttachment(file, id) }]
        } else {
          const texts = list.flatMap((a) => (a.kind === 'text' ? [a.source] : []))
          if (texts.length >= MAX_TEXT_FILES) throw new Error(`Puedes adjuntar hasta ${MAX_TEXT_FILES} archivos de texto.`)
          const source = await readTextAttachment(file)
          if (source.text.length > MAX_TEXT_FILE_CHARS) {
            throw new Error(`"${file.name}" tiene más de ${MAX_TEXT_FILE_CHARS.toLocaleString('es')} caracteres de texto.`)
          }
          const total = texts.reduce((n, s) => n + s.text.length, source.text.length)
          if (total > LIMITS.maxDigestInputChars) {
            throw new Error(`Los archivos superan ${LIMITS.maxDigestInputChars.toLocaleString('es')} caracteres en total.`)
          }
          list = [...list, { id: `src-${Date.now()}-${list.length}`, kind: 'text', source }]
        }
      } catch (e) {
        errors.push((e as Error).message)
      }
    }
    setAttachments(list)
    if (errors.length) setFileError(errors.join(' '))
    if (fileRef.current) fileRef.current.value = ''
  }

  const removeAttachment = (id: string) => {
    setAttachments((list) => list.filter((a) => a.id !== id))
    setAiResult(null)
  }

  return (
    <main className="landing">
      <section className="landing-left">
        <p className="brand">mus3o</p>
        <h1>Un lugar para cada idea</h1>
        <p className="lead">
          Camillo, en el siglo XVI, guardó el saber en los asientos de un teatro. Pega tus apuntes y mus3o levanta uno:
          cada tema es una sala de un solo color, cada concepto un objeto de yeso sobre su pedestal.
        </p>

        <div className="presets-section">
          <p className="presets-label">Entrada directa a palacios destacados:</p>
          <div className="presets-grid">
            {PRESET_PALACES.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className="preset-card"
                onClick={() => enterPalace(preset.museum)}
                title={`Entrar a ${preset.title}`}
              >
                <div className="preset-card-top">
                  <span className="preset-icon">{preset.icon}</span>
                  <span className="preset-badge">{preset.themeBadge}</span>
                </div>
                <strong className="preset-title">{preset.title}</strong>
                <p className="preset-subtitle">{preset.subtitle}</p>
                <span className="preset-meta">
                  {preset.roomCount} salas · {preset.conceptCount} conceptos
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="editor">
          <div className="tabs">
            <span className="tab active">Tus apuntes</span>
            <button
              className="tab tab-file"
              onClick={() => fileRef.current?.click()}
              title="Word, Excel, CSV, texto, JSON o imágenes"
              aria-label="Adjuntar archivos"
            >
              + Adjuntar
            </button>
            <input ref={fileRef} type="file" accept={ACCEPT} multiple hidden onChange={(e) => onFiles(e.target.files)} />
          </div>
          {attachments.length > 0 && (
            <ul className="attachments" aria-label="Archivos adjuntos">
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
                  <button className="attachment-remove" onClick={() => removeAttachment(a.id)} aria-label="Quitar archivo">
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
          <textarea
            value={input}
            onChange={(e) => { setInput(e.target.value); setAiResult(null) }}
            placeholder={PLACEHOLDER}
            spellCheck={false}
            maxLength={MAX_INPUT_CHARS}
            aria-label="Apuntes"
          />
          <div className="editor-status">
            {aiError ? (
              <span className="error">{aiError}</span>
            ) : fileError ? (
              <span className="error">{fileError}</span>
            ) : attachments.length > 0 && !aiResult ? (
              <span>
                {attachments.length} {attachments.length === 1 ? 'archivo adjunto' : 'archivos adjuntos'} · se usan con
                «Generar con IA»
              </span>
            ) : aiResult ? (
              <span>{sourceSummary(aiResult.palace)}</span>
            ) : result.ok ? (
              <span>
                {result.palace.rooms.length} salas · {conceptCount} conceptos
                {result.warnings.length > 0 && <span className="warn"> · {result.warnings[0]}</span>}
              </span>
            ) : (
              <span className="error">{result.error}</span>
            )}
          </div>
        </div>

        <div className="actions">
          {aiResult && (
            <button className="btn btn-primary btn-lg" onClick={() => enterPalace(aiResult.palace, aiResult.text, aiResult.userImages)}>
              Entrar al palacio
            </button>
          )}
          <button className={aiResult ? 'btn' : 'btn btn-primary btn-lg'} disabled={!result.ok} onClick={() => result.ok && enterPalace(result.palace, input)}>
            Construir palacio
          </button>
          <button
            className={attachments.length > 0 && !aiResult ? 'btn btn-primary btn-lg' : 'btn'}
            disabled={(!input.trim() && attachments.length === 0) || aiState === 'loading'}
            onClick={generateWithAi}
          >
            {aiState === 'loading'
              ? aiStage === 'digesting'
                ? 'Resumiendo tus archivos…'
                : 'Levantando muros…'
              : 'Generar con IA'}
          </button>
          <button className="btn btn-ghost" onClick={() => setInput(EXAMPLE_TEXT)}>
            Usar ejemplo: Biología celular
          </button>
          <button className="btn btn-ghost" onClick={() => enterPalace(dungeonDemoMuseum)}>
            Explorar Mazmorra
          </button>
          {saved && (
            <button className="btn btn-ghost" onClick={resume}>
              Continuar “{saved.title}”
              {dueText && <span className="due-chip"> · {dueText}</span>}
            </button>
          )}
        </div>
        <FreeExploreToggleConnected />
      </section>

      <section className="landing-right" aria-label="Vista previa del palacio">
        <div className="preview-frame">
          <Suspense fallback={null}>
            <Preview layout={layout} />
          </Suspense>
          {aiState === 'loading' && (
            <div className="preview-loading" role="status">
              <span className="bricks" aria-hidden>
                <i /><i /><i /><i /><i /><i />
              </span>
              <p>Levantando muros…</p>
              <p className="sub">La IA modela un objeto para cada concepto.</p>
            </div>
          )}
        </div>
        <div className="plinth">
          <p className="plinth-title">Maqueta del palacio</p>
          <p className="plinth-sub">Se levanta de nuevo cada vez que cambias el texto.</p>
        </div>
      </section>
    </main>
  )
}

function FreeExploreToggleConnected() {
  const freeExplore = useStore((s) => s.freeExplore)
  const setFreeExplore = useStore((s) => s.setFreeExplore)
  return <FreeExploreToggle checked={freeExplore} onChange={setFreeExplore} />
}
