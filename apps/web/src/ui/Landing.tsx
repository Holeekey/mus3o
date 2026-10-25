import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, lazy, Suspense } from 'react'
import { LIMITS, type Source } from '@mus3o/shared'
import { startLiveBuild } from '../build/liveBuild'
import { sourceSummary } from '../palace/sourceSummary'
import { fileKindOf, readImageAttachment, readTextAttachment } from '../lib/files'
import { dungeonDemoMuseum } from '../mocks/dungeon'
import { EXAMPLE_TEXT } from '../palace/example'
import { PRESET_PALACES } from '../palace/presets'
import { buildLayout } from '../palace/layout'
import { detectFormat, MAX_INPUT_CHARS, parsePalace } from '../palace/parse'
import { dueCountFor } from '../memory/hooks'
import { dueLabel } from '../memory/dueLabel'
import { useStore } from '../store'
import { FreeExploreToggle } from './FreeExploreToggle'
import { SiteHeader } from './SiteHeader'
import { SourcesPanel, type Attachment } from './SourcesPanel'
import { useReveal } from './reveal'
import { useShowcaseScroll } from './showcase'
import type { LobbyMode, WalkApi } from '../scene/LobbyWalker'
import { touchInput } from '../scene/touchInput'

// La sala 3D se carga aparte para que three.js no bloquee la primera pintura de la landing.
const RoomPeek = lazy(() => import('../scene/RoomPeek').then((m) => ({ default: m.RoomPeek })))

// Sala de ejemplo fija: no depende del editor, así no se reconstruye ni pide imágenes en cada tecla.
const exampleResult = parsePalace(EXAMPLE_TEXT, detectFormat(EXAMPLE_TEXT))
const EXAMPLE_LAYOUT = exampleResult.ok ? buildLayout(exampleResult.palace) : null

const PLACEHOLDER = ['# Tema 1', '- Concepto A: explicación', '- Concepto B', '', '# Tema 2', '- Concepto C'].join(String.fromCharCode(10))
// Peso máximo de cada archivo antes de leerlo (las imágenes se achican después a 1024 px).
const MAX_FILE_BYTES = 15 * 1024 * 1024
// Lo que acepta el prompt maestro: hasta 10 archivos de texto y 100.000 caracteres cada uno.
const MAX_TEXT_FILES = 10
const MAX_TEXT_FILE_CHARS = 100_000
const FILES_PLACEHOLDER = '¿Qué quieres aprender de estos archivos? (opcional)'

const nextImageId = (list: Attachment[]) => {
  const used = new Set(list.map((a) => a.id))
  let n = 1
  while (used.has(`img-${n}`)) n++
  return `img-${n}`
}

// El resumen "N de M verificados" ahora se muestra dentro del palacio (aviso y panel de pausa).
export { sourceSummary }

export function Landing() {
  const enterPalace = useStore((s) => s.enterPalace)
  const resume = useStore((s) => s.resume)
  const saved = useStore((s) => s.palace)
  // Una sola vez por render: la landing se vuelve a renderizar en cada tecla del editor.
  const dueText = dueLabel(dueCountFor(saved))
  const [input, setInput] = useState(EXAMPLE_TEXT)
  const [fileError, setFileError] = useState<string | null>(null)
  const [sourcesOpen, setSourcesOpen] = useState(false)
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [validationError, setValidationError] = useState<string | null>(null)
  // Si la IA falló antes de la primera sala, el store nos devuelve aquí con el motivo.
  const buildError = useStore((s) => s.build.error)
  const clearBuildError = useStore((s) => s.clearBuildError)
  const aiError = validationError ?? buildError
  const showcaseRef = useRef<HTMLElement>(null)
  const { open, full } = useShowcaseScroll(showcaseRef)
  // Caminar por el lobby: solo escritorio (alcance de la demo); el clic pide el pointer lock.
  const walkApi = useRef<WalkApi>({ lock: () => {}, exit: () => {} })
  const [lobbyMode, setLobbyMode] = useState<LobbyMode>('off')
  const [nearPanel, setNearPanel] = useState(false)
  const walking = lobbyMode === 'walking'
  const canWalk = !touchInput.isTouchDevice
  useFreezeScroll(lobbyMode !== 'off')
  const workbenchRef = useRef<HTMLElement>(null)
  useReveal(workbenchRef)
  // Al volver desde #equipo con un ancla (#crear, #como-funciona) la sección recién se montó: se baja a mano.
  useEffect(() => {
    const id = window.location.hash.slice(1)
    if (id) document.getElementById(id)?.scrollIntoView()
  }, [])

  const generateWithAi = () => {
    const withFiles = attachments.length > 0
    if (!input.trim() && !withFiles) return
    // Sin adjuntos, el server acepta hasta LIMITS.maxNotesChars caracteres de apuntes para la IA.
    // Con adjuntos, el prompt maestro resume lo que no entra.
    if (!withFiles && input.trim().length > LIMITS.maxNotesChars) {
      setValidationError(`Para generar con IA usa hasta ${LIMITS.maxNotesChars.toLocaleString('es')} caracteres (tienes ${input.trim().length.toLocaleString('es')}). Puedes construir el palacio sin IA con todo el texto.`)
      return
    }
    setValidationError(null)
    clearBuildError()
    if (!withFiles) {
      // Entra al palacio ya: las salas se levantan según la IA las escribe.
      void startLiveBuild({ kind: 'text', text: input })
      return
    }
    const sources = attachments.flatMap((a) => (a.kind === 'text' ? [a.source] : []))
    const images = attachments.flatMap((a) => (a.kind === 'image' ? [a.image] : []))
    // El texto de ejemplo que trae el editor no se mezcla con los archivos del usuario.
    const typed = input === EXAMPLE_TEXT ? '' : input
    void startLiveBuild({
      kind: 'files',
      prompt: typed,
      sources,
      images: images.map((i) => i.image),
      // Las imágenes del usuario se cuelgan en los cuadros: viajan al palacio por id.
      userImages: Object.fromEntries(images.map((i) => [i.image.id, i.previewUrl])),
      // Texto con el que se verifican las citas: lo escrito más lo extraído de los archivos.
      text: [typed.trim(), ...sources.map((s) => s.text)].filter(Boolean).join('\n\n'),
    })
  }

  const deferred = useDeferredValue(input)
  // El formato se detecta solo: un JSON pegado (p. ej. un palacio exportado) se sigue aceptando.
  const result = useMemo(() => parsePalace(deferred, detectFormat(deferred)), [deferred])
  const conceptCount = result.ok ? result.palace.rooms.reduce((n, r) => n + r.pieces.length, 0) : 0

  const onFiles = async (files: File[]) => {
    setFileError(null)
    setValidationError(null)
    clearBuildError()
    const errors: string[] = []
    let list = attachments
    for (const file of files) {
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
  }

  const closeSources = useCallback(() => setSourcesOpen(false), [])

  const removeAttachment = (id: string) => {
    setAttachments((list) => list.filter((a) => a.id !== id))
    setValidationError(null)
    clearBuildError()
  }

  // Los mismos elementos se muestran abajo y en la pared del lobby: comparten estado (lo escrito en uno aparece en el otro).
  const notesEditor = (
    <div className="editor">
      <div className="tabs">
        <span className="tab active">Tus apuntes</span>
        <button
          className="tab tab-file"
          onClick={() => setSourcesOpen((open) => !open)}
          title="PDF, Word, Excel, CSV, texto, JSON o imágenes"
          aria-expanded={sourcesOpen}
          aria-controls="sources-panel"
        >
          + Fuentes{attachments.length > 0 && ` (${attachments.length})`}
        </button>
      </div>
      <div className={sourcesOpen ? 'editor-body editor-body-split' : 'editor-body'}>
        <textarea
          value={input}
          onChange={(e) => { setInput(e.target.value); setValidationError(null); clearBuildError() }}
          placeholder={attachments.length > 0 ? FILES_PLACEHOLDER : PLACEHOLDER}
          spellCheck={false}
          maxLength={MAX_INPUT_CHARS}
          aria-label="Apuntes"
        />
        <SourcesPanel
          open={sourcesOpen}
          onClose={closeSources}
          attachments={attachments}
          onAdd={onFiles}
          onRemove={removeAttachment}
          error={fileError}
        />
      </div>
      <div className="editor-status">
        {aiError ? (
          <span className="error">{aiError}</span>
        ) : attachments.length > 0 ? (
          <span>
            {attachments.length} {attachments.length === 1 ? 'archivo adjunto' : 'archivos adjuntos'} · se usan con
            «Generar con IA»
          </span>
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
  )
  const presetsList = (
    <div className="presets-section">
      <p className="presets-label">Entrada directa a palacios destacados</p>
      <div className="presets-list">
        {PRESET_PALACES.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className="preset-card"
            onClick={() => enterPalace(preset.museum)}
            title={`Entrar a ${preset.title}`}
          >
            <div className="preset-card-top">
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
  )
  const primaryActions = (
    <>
      <button className="btn btn-primary btn-lg" disabled={!result.ok} onClick={() => result.ok && enterPalace(result.palace, input)}>
        Construir palacio
      </button>
      <button
        className={attachments.length > 0 ? 'btn btn-primary btn-lg' : 'btn'}
        disabled={!input.trim() && attachments.length === 0}
        onClick={generateWithAi}
      >
        Generar con IA
      </button>
    </>
  )

  const workbenchHead = (
    <header className="workbench-head">
      <h2 data-reveal>Ahora, <i>el tuyo</i></h2>
      <p data-reveal>Pega tus apuntes o entra directo a uno de los palacios destacados.</p>
    </header>
  )
  const actionButtons = (
    <>
      {primaryActions}
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
    </>
  )
  // En la pared del lobby va "Crea tu palacio" tal cual: texto guía, apuntes | palacios destacados y acciones.
  const wallPanel = (
    <div className="lobby-workbench">
      {workbenchHead}
      <div className="workbench-grid">
        {notesEditor}
        {presetsList}
      </div>
      <div className="actions">{actionButtons}</div>
    </div>
  )

  return (
    <main id="top" className="landing">
      <SiteHeader />
      <section className="landing-hero">
        <h1>Un lugar para cada <i>idea</i></h1>
        <p className="lead">
          Camillo, en el siglo XVI, guardó el saber en los asientos de un teatro. Pega tus apuntes y <span className="inline-logo" role="img" aria-label="mus3o" /> levanta uno:
          cada tema es una sala de un solo color, cada concepto un objeto de yeso sobre su pedestal.
        </p>
        <a className="scroll-cue" href="#como-funciona">
          Baja para entrar <span aria-hidden>↓</span>
        </a>
      </section>

      {/* Al hacer scroll la maqueta se abre a pantalla completa y luego se vuelve a cerrar. */}
      <section id="como-funciona" ref={showcaseRef} className="showcase" aria-label="Vista previa del palacio">
        <div className="showcase-sticky">
          <div className="showcase-frame">
            {EXAMPLE_LAYOUT && (
              <Suspense fallback={null}>
                <RoomPeek
                  layout={EXAMPLE_LAYOUT}
                  open={open}
                  walkApi={walkApi}
                  mode={lobbyMode}
                  onModeChange={setLobbyMode}
                  onNearPanelChange={setNearPanel}
                  wallPanel={wallPanel}
                />
              </Suspense>
            )}
            {canWalk && full && lobbyMode === 'off' && (
              <button type="button" className="walk-cta" onClick={() => walkApi.current.lock()}>
                Haz clic para recorrer el lobby
              </button>
            )}
            {walking && <span className="walk-crosshair" aria-hidden />}
            {walking && nearPanel && (
              <p className="walk-use" role="status">
                <kbd>E</kbd> para usar el panel
              </p>
            )}
            {walking && (
              <p className="walk-hint" role="status">
                <kbd>W A S D</kbd> caminar · <kbd>Shift</kbd> correr · <kbd>Esc</kbd> volver al scroll
              </p>
            )}
            {lobbyMode === 'using' && (
              <div className="walk-bar">
                <button type="button" className="walk-bar-btn" onClick={() => walkApi.current.lock()}>
                  Seguir caminando <kbd>E</kbd>
                </button>
                <button type="button" className="walk-bar-btn" onClick={() => walkApi.current.exit()}>
                  Volver al scroll <kbd>Esc</kbd>
                </button>
              </div>
            )}
            <div className="plinth" hidden={lobbyMode !== 'off'}>
              <p className="plinth-title">Así se recorre por dentro</p>
              <p className="plinth-sub">Sala de ejemplo: Biología celular, en primera persona.</p>
            </div>
          </div>
        </div>
      </section>

      <section id="crear" ref={workbenchRef} className="landing-workbench">
        {workbenchHead}
        {/* Apuntes a la izquierda y palacios destacados a la derecha, a la misma altura. */}
        <div className="workbench-grid" data-reveal>
          {notesEditor}
          {presetsList}
        </div>

        <div className="actions" data-reveal>
          {actionButtons}
        </div>
        <FreeExploreToggleConnected />
      </section>
    </main>
  )
}

// Mientras se camina, la rueda y el scroll de la página quedan quietos: el lobby sigue a pantalla completa.
function useFreezeScroll(frozen: boolean) {
  useEffect(() => {
    if (!frozen) return
    const root = document.documentElement
    const prev = root.style.overflow
    root.style.overflow = 'hidden'
    const stop = (e: WheelEvent) => e.preventDefault()
    window.addEventListener('wheel', stop, { passive: false })
    return () => {
      root.style.overflow = prev
      window.removeEventListener('wheel', stop)
    }
  }, [frozen])
}

function FreeExploreToggleConnected() {
  const freeExplore = useStore((s) => s.freeExplore)
  const setFreeExplore = useStore((s) => s.setFreeExplore)
  return <FreeExploreToggle checked={freeExplore} onChange={setFreeExplore} />
}
