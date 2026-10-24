import { useDeferredValue, useEffect, useMemo, useRef, useState, lazy, Suspense } from 'react'
import { countSources, LIMITS, type Museum } from '@mus3o/shared'
import { generateMuseum } from '../lib/api'
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
import { useReveal } from './reveal'
import { useShowcaseScroll } from './showcase'

// La sala 3D se carga aparte para que three.js no bloquee la primera pintura de la landing.
const RoomPeek = lazy(() => import('../scene/RoomPeek').then((m) => ({ default: m.RoomPeek })))

// Sala de ejemplo fija: no depende del editor, así no se reconstruye ni pide imágenes en cada tecla.
const exampleResult = parsePalace(EXAMPLE_TEXT, detectFormat(EXAMPLE_TEXT))
const EXAMPLE_LAYOUT = exampleResult.ok ? buildLayout(exampleResult.palace) : null

const PLACEHOLDER = ['# Tema 1', '- Concepto A: explicación', '- Concepto B', '', '# Tema 2', '- Concepto C'].join(String.fromCharCode(10))
const MAX_FILE_BYTES = 200_000

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
  const [aiState, setAiState] = useState<'idle' | 'loading'>('idle')
  const [aiError, setAiError] = useState<string | null>(null)
  // Palacio generado con IA a la espera de entrar: deja ver cuántos conceptos se verificaron.
  const [aiResult, setAiResult] = useState<{ palace: Museum; text: string } | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const showcaseRef = useRef<HTMLElement>(null)
  const open = useShowcaseScroll(showcaseRef)
  const workbenchRef = useRef<HTMLElement>(null)
  useReveal(workbenchRef)
  useEffect(() => () => abortRef.current?.abort(), [])
  // Al volver desde #equipo con un ancla (#crear, #como-funciona) la sección recién se montó: se baja a mano.
  useEffect(() => {
    const id = window.location.hash.slice(1)
    if (id) document.getElementById(id)?.scrollIntoView()
  }, [])

  const generateWithAi = async () => {
    if (!input.trim() || aiState === 'loading') return
    // El server acepta hasta LIMITS.maxNotesChars caracteres de apuntes para la IA.
    if (input.trim().length > LIMITS.maxNotesChars) {
      setAiError(`Para generar con IA usa hasta ${LIMITS.maxNotesChars.toLocaleString('es')} caracteres (tienes ${input.trim().length.toLocaleString('es')}). Puedes construir el palacio sin IA con todo el texto.`)
      return
    }
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setAiError(null)
    setAiResult(null)
    setAiState('loading')
    try {
      const palace = await generateMuseum(input, controller.signal)
      const { verified, unverified } = countSources(palace)
      if (verified + unverified === 0) enterPalace(palace)
      else setAiResult({ palace, text: input.trim() })
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
  const conceptCount = result.ok ? result.palace.rooms.reduce((n, r) => n + r.pieces.length, 0) : 0

  const onFile = async (file: File | undefined) => {
    setFileError(null)
    if (!file) return
    if (file.size > MAX_FILE_BYTES) {
      setFileError('El archivo pesa más de 200 KB.')
      return
    }
    const text = await file.text()
    setInput(text)
  }

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
                <RoomPeek layout={EXAMPLE_LAYOUT} open={open} />
              </Suspense>
            )}
            {aiState === 'loading' && (
              <div className="preview-loading" role="status">
                <span className="bricks" aria-hidden>
                  <i /><i /><i /><i /><i /><i />
                </span>
                <p>Levantando muros…</p>
                <p className="sub">La IA modela un objeto para cada concepto.</p>
              </div>
            )}
            <div className="plinth">
              <p className="plinth-title">Así se recorre por dentro</p>
              <p className="plinth-sub">Sala de ejemplo: Biología celular, en primera persona.</p>
            </div>
          </div>
        </div>
      </section>

      <section id="crear" ref={workbenchRef} className="landing-workbench">
        <header className="workbench-head">
          <h2 data-reveal>Ahora, <i>el tuyo</i></h2>
          <p data-reveal>Pega tus apuntes o entra directo a uno de los palacios destacados.</p>
        </header>
        {/* Apuntes a la izquierda y palacios destacados a la derecha, a la misma altura. */}
        <div className="workbench-grid" data-reveal>
          <div className="editor">
            <div className="tabs">
              <span className="tab active">Tus apuntes</span>
              <button className="tab tab-file" onClick={() => fileRef.current?.click()}>
                Subir archivo
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".txt,.md"
                hidden
                onChange={(e) => onFile(e.target.files?.[0])}
              />
            </div>
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
        </div>

        <div className="actions" data-reveal>
          {aiResult && (
            <button className="btn btn-primary btn-lg" onClick={() => enterPalace(aiResult.palace, aiResult.text)}>
              Entrar al palacio
            </button>
          )}
          <button className={aiResult ? 'btn' : 'btn btn-primary btn-lg'} disabled={!result.ok} onClick={() => result.ok && enterPalace(result.palace, input)}>
            Construir palacio
          </button>
          <button className="btn" disabled={!input.trim() || aiState === 'loading'} onClick={generateWithAi}>
            {aiState === 'loading' ? 'Levantando muros…' : 'Generar con IA'}
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
    </main>
  )
}

function FreeExploreToggleConnected() {
  const freeExplore = useStore((s) => s.freeExplore)
  const setFreeExplore = useStore((s) => s.setFreeExplore)
  return <FreeExploreToggle checked={freeExplore} onChange={setFreeExplore} />
}
