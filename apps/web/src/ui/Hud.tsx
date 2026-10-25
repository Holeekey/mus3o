import { useEffect, useMemo, useRef, useState } from 'react'
import { canOpenDoor, remainingToMemorize } from '../palace/keys'
import type { PalaceLayout } from '../palace/layout'
import { pieceKind } from '../palace/pieceKind'
import type { Piece as Concept } from '@mus3o/shared'
import { creditLine, prefetchPalaceImages, userImageAsResolved, useResolvedImage } from '../lib/images'
import { closeCard, interact, toggleMemorize } from '../scene/actions'
import { pointerLock } from '../scene/pointerLock'
import { useDueCount, useRoomMemory } from '../memory/hooks'
import { conceptIdList } from '../palace/conceptIds'
import { inExamScope, isDoorOpen, useStore } from '../store'
import { roomPalettes, DEFAULT_THEME, type RoomPalette } from '../theme'
import { FreeExploreToggle } from './FreeExploreToggle'
import { DioramaMinimap } from '../diorama/DioramaMinimap'
import { useDioramaStore } from '../diorama/dioramaStore'
import { ArisDialog, ArisPrompt } from './ArisDialog'
import { ArisVoicePill } from './ArisVoicePill'
import { arisConversation } from '../palace/arisConversationRuntime'
import { useCardScroll } from './cardScroll'
import { ConceptInfo } from './ConceptInfo'
import { ExamCard } from './ExamCard'
import { Minimap } from './Minimap'
import { Narrator } from './Narrator'
import { KeyHint } from './KeyHint'
import { TouchControls } from './TouchControls'
import { VrButton } from '../vr/VrButton'
import { useIsTouch } from './useIsTouch'
import { useResumeKeys } from './resume'
import { useLegendShown } from './legend'
import { routeHintText, routeNext } from '../palace/route'

function wallVars(p: RoomPalette) {
  return { '--wall': p.wall, '--wall-ink': p.ink } as React.CSSProperties
}

function findConcept(layout: PalaceLayout, id: string | null) {
  for (const r of layout.rooms) {
    const k = r.pedestals.findIndex((x) => x.concept.id === id)
    if (k !== -1) return { concept: r.pedestals[k].concept, room: r, order: r.firstOrder + k }
  }
  return null
}

// Tiempo que se ve el aviso del recorrido al entrar a una sala o al cerrar una ficha.
const ROUTE_HINT_MS = 5_000

function ConceptCard({ concept, palette, roomName }: { concept: Concept; palette: RoomPalette; roomName: string }) {
  const memorized = useStore((s) => !!s.memorized[concept.id])
  const userSrc = useStore((s) => (concept.image ? s.userImages[concept.image.imageId] : undefined))
  const resolved = useResolvedImage(userSrc ? undefined : concept.imageSearch)
  const image = userSrc ? userImageAsResolved(userSrc, concept.title) : resolved
  const touch = useIsTouch()
  const inner = useRef<HTMLDivElement>(null)
  const more = useCardScroll(inner)
  const locked = useStore((s) => s.locked)
  return (
    <aside className="card" style={wallVars(palette)}>
      <div className="card-header-bar">
        <p className="card-tag">{roomName}</p>
        <button type="button" className="card-close" onClick={closeCard} aria-label="Cerrar ficha">
          ✕
        </button>
      </div>
      <div ref={inner} className={more ? 'card-inner has-more' : 'card-inner'}>
        <h2>{concept.title}</h2>
        {concept.text && <p className="card-body">{concept.text}</p>}
        {concept.mnemonicCue ? (
          <div className="card-cue">
            <span className="card-cue-badge">Anclaje Mnemotécnico</span>
            <p className="card-cue-text">{concept.mnemonicCue}</p>
          </div>
        ) : concept.fact ? (
          <p className="card-meta">{concept.fact}</p>
        ) : null}
        {concept.dynamicAsset?.license === 'CC-BY' && (
          <p className="card-meta">
            Modelo 3D «{concept.dynamicAsset.title}» por {concept.dynamicAsset.author || 'autor desconocido'} ·{' '}
            <a href={concept.dynamicAsset.sourceUrl} target="_blank" rel="noreferrer noopener">
              CC-BY vía Poly Pizza
            </a>
          </p>
        )}
        {image && (
          <figure className="card-figure">
            <img src={image.src} alt={image.title} width={image.width} height={image.height} decoding="async" />
            <figcaption>{creditLine(image)}</figcaption>
          </figure>
        )}
        {/* Mientras se resuelve, reserva el lugar para que la ficha no salte. */}
        {image === undefined && <div className="card-figure card-figure-loading" aria-hidden />}
        <ConceptInfo concept={concept} image={image} />
      </div>
      {/* Pie fijo: el estado y las teclas siempre se ven, aunque el contenido sea largo. */}
      <div className="card-footer">
        {more && (
          <button
            type="button"
            className="card-more-hint"
            onClick={() => inner.current?.scrollBy({ top: inner.current.clientHeight * 0.8, behavior: 'smooth' })}
          >
            ↓ Sigue leyendo
          </button>
        )}
        <div className="card-actions">
          <span className={memorized ? 'pill pill-gold' : 'pill'}>{memorized ? 'Memorizado' : 'Sin memorizar'}</span>
          <span className="keys">
            {touch ? (
              <button type="button" className="btn btn-ghost" onClick={toggleMemorize}>
                {memorized ? 'desmarcar' : 'marcar como memorizado'}
              </button>
            ) : (
              <>
                <kbd>M</kbd> marcar · <kbd>E</kbd> cerrar
                {locked ? <> · <kbd>Esc</kbd> usar el mouse</> : <> · clic fuera o <kbd>Enter</kbd> para seguir</>}
              </>
            )}
          </span>
        </div>
      </div>
    </aside>
  )
}

export function Hud({ layout }: { layout: PalaceLayout }) {
  const palace = useStore((s) => s.palace)
  const buildSummary = useStore((s) => s.build.summary) // palacio generado con IA: "N de M verificados"
  // Precarga las imágenes de todo el palacio para que las fichas se abran al instante.
  useEffect(() => {
    if (palace) void prefetchPalaceImages(palace)
  }, [palace])
  const mode = useStore((s) => s.mode)
  const locked = useStore((s) => s.locked)
  const memorized = useStore((s) => s.memorized)
  const exam = useStore((s) => s.exam)
  const currentRoomId = useStore((s) => s.currentRoomId)
  const inDiorama = useDioramaStore((s) => s.phase === 'inside' || s.phase === 'leaving')
  const arisAvailable = useDioramaStore((s) => s.phase === 'room')

  // La conversación por voz arranca sola la primera vez que se entra al museo (el clic de entrada es el gesto que
  // permite audio y micrófono) y se apaga al salir de la pantalla.
  useEffect(() => {
    if (locked && arisAvailable) arisConversation.autoStart()
  }, [locked, arisAvailable])
  useEffect(() => () => arisConversation.stop(), [])
  const focusedId = useStore((s) => s.focusedId)
  const focusedDoorId = useStore((s) => s.focusedDoorId)
  const hasKey = useStore((s) => s.hasKey)
  const unlockedDoors = useStore((s) => s.unlockedDoors)
  const freeExplore = useStore((s) => s.freeExplore)
  const setFreeExplore = useStore((s) => s.setFreeExplore)
  const doorOpen = (id: string) => isDoorOpen({ freeExplore, unlockedDoors }, id)
  const roomKeys = useStore((s) => s.roomKeys)
  const lastKeyRoomId = useStore((s) => s.lastKeyRoomId)
  const setState = useStore((s) => s.set)
  const openId = useStore((s) => s.openId)
  const setMode = useStore((s) => s.setMode)
  const reviewIds = useStore((s) => s.reviewIds)
  const startReview = useStore((s) => s.startReview)
  const exitToLanding = useStore((s) => s.exitToLanding)
  const touch = useIsTouch()

  const room = layout.rooms.find((r) => r.id === currentRoomId) ?? layout.rooms[0]
  const conceptCount = conceptIdList(palace).length
  const total = reviewIds?.length ?? conceptCount
  const memorizedCount = Object.keys(memorized).length
  const answered = Object.values(exam)
  const score = answered.filter((r) => r === 'ok').length
  const palettes = roomPalettes(DEFAULT_THEME, layout.rooms.map((r) => r.title))
  const palette = palettes[room.index]
  const open = findConcept(layout, openId)
  const focused = findConcept(layout, focusedId)
  const focusedKind = focused ? pieceKind(focused.concept) : 'standard'
  const examFinished = mode === 'exam' && answered.length === total && total > 0
  const roomIds = useMemo(() => room.pedestals.map((p) => p.concept.id), [room])
  const roomMem = useRoomMemory(roomIds)
  const due = useDueCount()
  const roomDone = roomIds.filter((id) => memorized[id]).length
  const legendShown = useLegendShown(locked && !open && !touch)

  // Recorrido de estudio: al entrar a una sala o al cerrar una ficha, un aviso breve señala el siguiente tótem.
  const next = routeNext(layout.rooms, currentRoomId, memorized)
  const [routeHint, setRouteHint] = useState(false)
  const lastOpen = useRef(openId)
  useEffect(() => {
    const closed = lastOpen.current !== null && openId === null
    lastOpen.current = openId
    if (!closed) return
    setRouteHint(true)
  }, [openId])
  // También al entrar (o volver de la pausa): si no, el aviso de la primera sala se perdería tras la pausa inicial.
  useEffect(() => {
    if (locked) setRouteHint(true)
  }, [currentRoomId, locked])
  // Al terminar una sala, el aviso de la llave va primero; al irse, el recorrido indica la sala siguiente.
  const hadKeyNotice = useRef(false)
  useEffect(() => {
    if (hadKeyNotice.current && !lastKeyRoomId) setRouteHint(true)
    hadKeyNotice.current = !!lastKeyRoomId
  }, [lastKeyRoomId])
  useEffect(() => {
    if (!routeHint) return
    const timer = setTimeout(() => setRouteHint(false), ROUTE_HINT_MS)
    return () => clearTimeout(timer)
  }, [routeHint, currentRoomId, openId, locked, lastKeyRoomId])
  const routeText =
    routeHint && locked && mode === 'explore' && !open && !focusedId && !focusedDoorId && !lastKeyRoomId && next
      ? routeHintText(next)
      : null
  const [moreOptions, setMoreOptions] = useState(false)

  // Aviso de llave ganada: se muestra unos segundos.
  useEffect(() => {
    if (!lastKeyRoomId) return
    const timer = setTimeout(() => setState({ lastKeyRoomId: null }), 4000)
    return () => clearTimeout(timer)
  }, [lastKeyRoomId, setState])

  const reading = !!open && !inExamScope({ mode, reviewIds }, open.concept.id)
  // Pausa o ficha leída con el mouse: Enter, Espacio o un clic fuera retoman el palacio.
  useResumeKeys(!locked && (!open || reading))

  const focusedDoor = layout.doors.find((d) => d.id === focusedDoorId)
  const doorLocked = !!focusedDoor && !doorOpen(focusedDoor.id)
  const doorOpenable = !!focusedDoor && canOpenDoor(focusedDoor, hasKey, roomKeys)
  const doorRoom = palace?.rooms.find((r) => r.id === focusedDoor?.fromRoomId)
  const doorMissing = doorRoom ? remainingToMemorize(doorRoom, memorized, exam) : 0
  const keyRoomName = (id: string | null) => palace?.rooms.find((r) => r.id === id)?.name ?? ''
  // La llave de la sala actual se muestra mientras le quede alguna compuerta por abrir.
  const currentRoomKey =
    !!roomKeys[room.id] && layout.doors.some((d) => d.fromRoomId === room.id && !doorOpen(d.id))

  return (
    <div className="hud">
      <div className="plaque" style={wallVars(palette)}>
        <p className="plaque-meta">Sala {room.index + 1} de {layout.rooms.length} · {palette.name}</p>
        <p className="plaque-title">{room.title}</p>
        <p className="plaque-memory">
          {roomMem.learned ? `Memoria de la sala: ${Math.round(roomMem.strength * 100)}%` : 'Sala sin estudiar todavía'}
        </p>
        {/* El progreso vive en el cartel de la sala: una caja menos sobre la escena. */}
        <p className="plaque-progress">
          {mode === 'explore' ? (
            <>
              {roomDone} de {roomIds.length} memorizadas
              {/* El total se oculta en teléfonos angostos: el cartel no debe comerse la escena. */}
              <span className="plaque-total"> · {memorizedCount} de {conceptCount} en total</span>
            </>
          ) : (
            `Examen: ${score} de ${answered.length} correctas · faltan ${total - answered.length}`
          )}
        </p>
        <div className="plaque-bar" aria-hidden>
          <i style={{ width: `${mode === 'explore' ? (roomIds.length ? (roomDone / roomIds.length) * 100 : 0) : total ? (answered.length / total) * 100 : 0}%` }} />
        </div>
      </div>

      <div className="hud-right">
        {inDiorama ? <DioramaMinimap /> : <Minimap layout={layout} />}
        {hasKey && (
          <div className="key-badge">
            🗝️ Llave en inventario
          </div>
        )}
        {!hasKey && currentRoomKey && <div className="key-badge">🗝️ Llave de {room.title}</div>}
        {due > 0 && <p className="hud-due hud-due-on">Repasos pendientes: {due}</p>}
      </div>

      {locked && <div className="crosshair" />}
      {routeText && <p className="hint hint-route">→ {routeText}</p>}
      {lastKeyRoomId && (
        <p className="hint hint-gold">🗝️ ¡Memorizaste toda la sala! Obtuviste la llave de {keyRoomName(lastKeyRoomId)}</p>
      )}
      {locked && doorLocked && !lastKeyRoomId && (
        <p className={`hint ${doorOpenable ? 'hint-gold' : 'hint-warn'}`}>
          {doorOpenable ? (
            <KeyHint k="E" onTap={() => interact(layout)}>
              Usar llave para abrir compuerta
            </KeyHint>
          ) : (
            <>
              🔒 Compuerta bloqueada: memoriza {doorMissing} {doorMissing === 1 ? 'pieza más' : 'piezas más'} de{' '}
              {doorRoom?.name} para obtener su llave
            </>
          )}
        </p>
      )}
      {locked && (!focusedDoorId || doorOpen(focusedDoorId)) && focusedId && !openId && (
        <p className="hint">
          <KeyHint k="E" onTap={() => interact(layout)}>
            {focusedKind === 'key'
              ? hasKey
                ? 'Examinar Llave de Hierro'
                : 'Recoger Llave de Hierro'
              : inExamScope({ mode, reviewIds }, focusedId) && !exam[focusedId]
                ? 'Responder'
                : 'Examinar concepto'}
          </KeyHint>
        </p>
      )}

      {reading && !locked && !touch && <div className="card-backdrop" onClick={() => pointerLock.lock()} aria-hidden />}
      {open && (reading ? (
        <ConceptCard concept={open.concept} palette={palettes[open.room.index]} roomName={`${open.room.title} · ${open.order} de ${conceptCount}`} />
      ) : (
        <ExamCard key={open.concept.id} concept={open.concept} palette={palettes[open.room.index]} />
      ))}

      <Narrator layout={layout} />

      {/* Lo mínimo para arrancar; la lista completa está en la pausa. */}
      {legendShown && (
        <p className="hud-legend">
          <kbd>W A S D</kbd> moverte · <kbd>Mouse</kbd> mirar · <kbd>E</kbd> examinar · <kbd>Esc</kbd> pausa
        </p>
      )}

      {locked && arisAvailable && !open && (
        <button
          type="button"
          className="aris-trigger-btn"
          onClick={() => {
            useStore.getState().setArisPromptOpen(true)
            pointerLock.unlock()
          }}
          title="Escribir a Aris (Shift+T)"
        >
          <span>🤖 Aris</span>
          <kbd>Shift+T</kbd>
        </button>
      )}

      <ArisDialog />
      <ArisVoicePill />
      <ArisPrompt />

      <TouchControls layout={layout} />

      {/* Con una ficha abierta no hay pausa: el puntero suelto sirve para leerla, desplazarla y abrir sus enlaces. */}
      {!locked && !open && (
        <div className="pause" onClick={(e) => e.target === e.currentTarget && pointerLock.lock()}>
          <div className="pause-panel">
            {/* En pantallas bajas y anchas (teléfono horizontal) van en dos columnas: texto y controles. */}
            <div className="pause-info">
              <p className="pause-sub">{palace?.title}</p>
              {buildSummary && <p className="pause-sub">{buildSummary}</p>}
              <h1>{examFinished ? `Resultado: ${score} de ${total}` : reviewIds ? 'Repaso' : mode === 'exam' ? 'Modo examen' : 'Tu museo está levantado'}</h1>
              <p className="muted">
                {mode === 'exam'
                  ? reviewIds
                    ? 'Solo se preguntan los conceptos que se están olvidando. Acércate a cada pedestal roto y di qué había.'
                    : 'Los carteles están ocultos. Acércate a cada pedestal y di qué concepto había.'
                  : 'Camina por las salas, examina cada pedestal y marca lo que ya recuerdas.'}
              </p>
              {touch ? (
                <p className="pause-keys">
                  Arrastra a la izquierda para moverte y desliza a la derecha para mirar · 👁️ examinar · ✓ memorizar · 🤖 Aris
                  {mode === 'exam' && (
                    <>
                      <br />
                      Responde en voz alta o toca «Escribir»
                    </>
                  )}
                </p>
              ) : (
                <p className="pause-keys">
                  <kbd>Enter</kbd> o clic fuera del panel para volver
                  <br />
                  <kbd>W A S D</kbd> moverte · <kbd>Shift</kbd> correr · <kbd>Mouse</kbd> mirar
                  <br />
                  <kbd>E</kbd> examinar · <kbd>M</kbd> memorizar · <kbd>T</kbd> hablar con Aris · <kbd>N</kbd> narrador
                  {mode === 'exam' && (
                    <>
                      <br />
                      Responde en voz alta · <kbd>Y</kbd> para escribir
                    </>
                  )}
                </p>
              )}
            </div>
            <div className="pause-controls">
              <div className="pause-actions">
                <button className="btn btn-primary" onClick={() => pointerLock.lock()}>
                  {mode === 'exam' ? 'Empezar examen' : 'Entrar al museo'}
                </button>
                <button className="btn btn-ghost" onClick={() => setMode(mode === 'exam' ? 'explore' : 'exam')}>
                  {mode === 'exam' ? 'Volver a explorar' : 'Empezar modo examen'}
                </button>
                {due > 0 && (
                  <button
                    className="btn btn-primary"
                    onClick={() => {
                      if (startReview()) pointerLock.lock()
                    }}
                  >
                    Repasar lo pendiente ({due})
                  </button>
                )}
                <VrButton />
              </div>
              {/* Lo secundario queda plegado: la pausa se lee de un vistazo. */}
              <button type="button" className="pause-more" aria-expanded={moreOptions} onClick={() => setMoreOptions((v) => !v)}>
                {moreOptions ? 'Menos opciones ▴' : 'Más opciones ▾'}
              </button>
              {!moreOptions && <p className="muted pause-more-hint">Salir del museo · exploración libre</p>}
              {moreOptions && (
                <>
                  <div className="pause-actions pause-more-actions">
                    <button className="btn btn-ghost" onClick={exitToLanding}>Salir del museo</button>
                  </div>
                  <FreeExploreToggle checked={freeExplore} onChange={setFreeExplore} />

                  <div className="memory-panel">
                    {due === 0 && <p className="muted memory-note">Nada que repasar por ahora. Marca conceptos con {touch ? '✓' : 'M'} para que el museo los recuerde.</p>}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
