import { useDeferredValue, useMemo, useRef, useState, lazy, Suspense } from 'react'
import { LIMITS } from '@mus3o/shared'
import { startLiveBuild } from '../build/liveBuild'
import { sourceSummary } from '../palace/sourceSummary'
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
const MAX_FILE_BYTES = 200_000

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
  const fileRef = useRef<HTMLInputElement>(null)
  const [validationError, setValidationError] = useState<string | null>(null)
  // Si la IA falló antes de la primera sala, el store nos devuelve aquí con el motivo.
  const buildError = useStore((s) => s.build.error)
  const clearBuildError = useStore((s) => s.clearBuildError)
  const aiError = validationError ?? buildError

  const generateWithAi = () => {
    if (!input.trim()) return
    // El server acepta hasta LIMITS.maxNotesChars caracteres de apuntes para la IA.
    if (input.trim().length > LIMITS.maxNotesChars) {
      setValidationError(`Para generar con IA usa hasta ${LIMITS.maxNotesChars.toLocaleString('es')} caracteres (tienes ${input.trim().length.toLocaleString('es')}). Puedes construir el palacio sin IA con todo el texto.`)
      return
    }
    setValidationError(null)
    clearBuildError()
    // Entra al palacio ya: las salas se levantan según la IA las escribe.
    void startLiveBuild(input)
  }

  const deferred = useDeferredValue(input)
  // El formato se detecta solo: un JSON pegado (p. ej. un palacio exportado) se sigue aceptando.
  const result = useMemo(() => parsePalace(deferred, detectFormat(deferred)), [deferred])
  const layout = useMemo(() => (result.ok ? buildLayout(result.palace) : null), [result])
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
            onChange={(e) => { setInput(e.target.value); setValidationError(null); clearBuildError() }}
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
          <button className="btn btn-primary btn-lg" disabled={!result.ok} onClick={() => result.ok && enterPalace(result.palace, input)}>
            Construir palacio
          </button>
          <button className="btn" disabled={!input.trim()} onClick={generateWithAi}>
            Generar con IA
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
