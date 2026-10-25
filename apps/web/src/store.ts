import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { earnedRoomKeys } from './palace/keys'
import { appendRoomToLayout, buildLayout, emptyLayout, finalizeLayout, streamEdges, type PalaceLayout } from './palace/layout'
import { arisHelpContext, evaluateArisQuery, speakAris } from './palace/arisBrain'
import { askArisHelp } from './lib/api'
import { countSources, edgesAtArrival, LIMITS, MuseumSchema, type GraphEdge, type Museum, type Room } from '@mus3o/shared'
import { attachLibraryDioramas } from './diorama/library'
import { attachDioramasToArrivingRoom, attachDioramasToFinalMuseum, attachDirected, completeDioramas } from './palace/liveDioramas'
import { sourceSummary } from './palace/sourceSummary'
import { cancelBuildSession } from './build/session'
import { resetDioramaState } from './diorama/dioramaStore'
import { abortIntro, beginBuildIntro, introBuildDone, introRoomArrived } from './intro/store'
import { dueIds, palaceKey, strengthOf } from './memory/model'
import { nowMs, useMemory } from './memory/store'
import { loadUserImages, replaceUserImages } from './lib/imageStorage'

export type Screen = 'landing' | 'palace'
export type Mode = 'explore' | 'exam'
export type ExamResult = 'ok' | 'fail'

// Pose del jugador: se escribe cada frame, se lee desde el minimapa sin re-renderizar React.
export const playerPose = { x: 0, z: 0, yaw: 0 }

/**
 * Palacio que se levanta mientras la IA lo escribe:
 * - idle: palacio normal (o ninguno)
 * - building: llegan salas
 * - done: la IA terminó
 * - cut: la conexión se cortó a medias; el palacio conserva las salas que ya había
 */
export type BuildStatus = 'idle' | 'building' | 'done' | 'cut'
export type BuildInfo = {
  status: BuildStatus
  rooms: number
  /** "N de M conceptos verificados" (solo con apuntes). */
  summary: string | null
  /** Aviso discreto, p. ej. cuando la IA se cortó. */
  notice: string | null
  /** Por qué se volvió a la landing sin ninguna sala. */
  error: string | null
}
export const IDLE_BUILD: BuildInfo = { status: 'idle', rooms: 0, summary: null, notice: null, error: null }

type State = {
  screen: Screen
  mode: Mode
  palace: Museum | null
  /** Apuntes del usuario (≤ 50 KB) para mostrar el contexto de cada fuente; se quedan en su dispositivo. */
  sourceText: string | null
  /** Imágenes que subió el usuario, por `imageId` (data URL). Solo en memoria: pesan demasiado para localStorage. */
  userImages: Record<string, string>
  layout: PalaceLayout | null
  memorized: Record<string, true>
  exam: Record<string, ExamResult>
  /** Repaso: si no es null, el examen solo cubre estos conceptos (los pendientes). */
  reviewIds: string[] | null
  currentRoomId: string | null
  focusedId: string | null
  focusedDoorId: string | null
  openId: string | null
  locked: boolean
  hasKey: boolean
  unlockedDoors: Record<string, true>
  /** Exploración libre: todas las puertas abiertas, sin llaves. Preferencia del usuario. */
  freeExplore: boolean
  /** Llave de cada sala ganada al memorizar todas sus piezas. No se pierde al desmarcar. */
  roomKeys: Record<string, true>
  /** Sala cuya llave se acaba de ganar, para avisarlo en el HUD. */
  lastKeyRoomId: string | null
  arisMessage: string | null
  arisPromptOpen: boolean
  arisMuted: boolean
  build: BuildInfo

  enterPalace: (palace: Museum, sourceText?: string | null, userImages?: Record<string, string>) => void
  /** Entra ya al palacio en construcción (solar vacío, cámara aérea); las salas llegan con `addBuiltRoom`. */
  beginBuildingPalace: (meta: { title: string; sourceText?: string | null; userImages?: Record<string, string>; reducedMotion?: boolean }) => void
  setBuildTitle: (title: string) => void
  /** Una sala llegó de la IA: se ubica junto a la que la enlaza (según `edges`) sin mover las anteriores y empieza a levantarse. */
  addBuiltRoom: (room: Room, edges?: GraphEdge[]) => void
  /** La IA terminó: el palacio pasa a ser el museo completo (mismo estado que `enterPalace` con ese museo). */
  finishBuildingPalace: (museum: Museum) => void
  /** La generación falló. Sin salas vuelve a la landing con el error; con salas conserva el palacio. */
  failBuildingPalace: (error: string) => void
  clearBuildError: () => void
  resume: () => void
  exitToLanding: () => void
  setMode: (mode: Mode) => void
  /** Examen limitado a lo pendiente. Devuelve false si no hay nada que repasar. */
  startReview: () => boolean
  toggleMemorized: (id: string) => void
  pickupKey: () => void
  unlockDoor: (doorId: string) => void
  setFreeExplore: (on: boolean) => void
  recordExam: (id: string, result: ExamResult) => void
  askAris: (query: string) => void
  setArisPromptOpen: (open: boolean) => void
  closeArisDialog: () => void
  toggleArisMute: () => void
  set: (patch: Partial<Pick<State, 'currentRoomId' | 'focusedId' | 'focusedDoorId' | 'openId' | 'locked' | 'lastKeyRoomId' | 'arisMessage' | 'arisPromptOpen'>>) => void
}

type Progress = Pick<State, 'palace' | 'memorized' | 'exam' | 'roomKeys' | 'lastKeyRoomId'>

// Suma las llaves recién ganadas a las que ya se tenían y avisa la última.
function withEarnedKeys(s: Progress, memorized: Record<string, true>, exam: State['exam']) {
  if (!s.palace) return {}
  const earned = earnedRoomKeys(s.palace, memorized, exam)
  const fresh = Object.keys(earned).filter((id) => !s.roomKeys[id])
  if (fresh.length === 0) return {}
  return { roomKeys: { ...s.roomKeys, ...earned }, lastKeyRoomId: fresh[fresh.length - 1] }
}

export const MAX_SOURCE_TEXT = 50_000

/** Lo guardado puede estar manipulado: solo se acepta texto y dentro del tope. */
export const capSourceText = (v: unknown): string | null =>
  typeof v === 'string' && v.length > 0 ? v.slice(0, MAX_SOURCE_TEXT) : null

const safeStorage = createJSONStorage(() => {
  try {
    return window.localStorage
  } catch {
    return undefined as unknown as Storage
  }
})

/** Palacio que había antes de empezar a construir uno nuevo: se recupera si la IA falla sin dar ninguna sala. */
let palaceBeforeBuild: Museum | null = null

/** Palacio en construcción: las salas llegadas y las aristas provisionales conocidas hasta ahora (el grafo final llega al terminar). */
function growing(palace: Museum, rooms: Room[], edges: GraphEdge[]): Museum {
  return { ...palace, rooms, graph: { start: rooms[0]?.id ?? '', edges } }
}

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      screen: 'landing',
      mode: 'explore',
      palace: null,
      sourceText: null,
      userImages: {},
      layout: null,
      memorized: {},
      exam: {},
      reviewIds: null,
      currentRoomId: null,
      focusedId: null,
      focusedDoorId: null,
      openId: null,
      locked: false,
      hasKey: false,
      unlockedDoors: {},
      freeExplore: true,
      roomKeys: {},
      lastKeyRoomId: null,
      arisMessage: null,
      arisPromptOpen: false,
      arisMuted: false,
      build: IDLE_BUILD,

      enterPalace: (rawPalace, sourceText, userImages = {}) => {
        if (Object.keys(userImages).length > 0) {
          void replaceUserImages(userImages)
        }
        // Los museos generados por IA solo traen las directivas DIO / D_PROP de sus salas históricas; se componen primero.
        // Luego la biblioteca (hechos a mano) y, a las salas que sigan sin diorama, uno compuesto sin IA con el pigmento de su fresco.
        const palace = completeDioramas(attachLibraryDioramas(attachDirected(rawPalace)))
        set({
          palace,
          sourceText: capSourceText(sourceText),
          userImages,
          layout: buildLayout(palace),
          screen: 'palace',
          mode: 'explore',
          memorized: learnedMap(palace),
          exam: {},
          reviewIds: null,
          openId: null,
          focusedId: null,
          focusedDoorId: null,
          currentRoomId: null,
          locked: false,
          arisMessage: null,
          arisPromptOpen: false,
          hasKey: false,
          unlockedDoors: {},
          // Las salas sin nada que memorizar ya tienen su llave.
          roomKeys: earnedRoomKeys(palace, {}, {}),
          lastKeyRoomId: null,
          build: IDLE_BUILD,
        })
        // El cuadro activo del palacio anterior no puede sobrevivir al cambio.
        resetDioramaState()
      },
      beginBuildingPalace: ({ title, sourceText, userImages, reducedMotion }) => {
        if (userImages && Object.keys(userImages).length > 0) {
          void replaceUserImages(userImages)
        }
        const before = get()
        // Si ya había una construcción abierta, se corta; el palacio "anterior" es el de antes de ella.
        if (before.build.status !== 'building') palaceBeforeBuild = before.palace
        set({
          palace: growing({ title, theme: { palette: ['#3b82f6', '#0f172a'], ambience: 'cathedral' }, rooms: [], mode: 'education' } as unknown as Museum, [], []),
          sourceText: capSourceText(sourceText),
          userImages: userImages ?? {},
          layout: emptyLayout(),
          screen: 'palace',
          mode: 'explore',
          memorized: {},
          exam: {},
          reviewIds: null,
          openId: null,
          focusedId: null,
          focusedDoorId: null,
          currentRoomId: null,
          locked: false,
          arisMessage: null,
          arisPromptOpen: false,
          hasKey: false,
          unlockedDoors: {},
          roomKeys: {},
          lastKeyRoomId: null,
          build: { ...IDLE_BUILD, status: 'building' },
        })
        resetDioramaState()
        beginBuildIntro({ reducedMotion })
      },
      setBuildTitle: (title) =>
        set((s) => (s.build.status === 'building' && s.palace ? { palace: { ...s.palace, title } } : {})),
      addBuiltRoom: (incoming, edges) => {
        const s = get()
        if (s.build.status !== 'building' || !s.palace || !s.layout) return
        if (s.palace.rooms.length >= LIMITS.maxRooms || s.palace.rooms.some((r) => r.id === incoming.id)) return
        const room = attachDioramasToArrivingRoom(s.palace.rooms, incoming, s.palace.title)
        const layout = appendRoomToLayout(s.layout, room, edges)
        // La llegada se registra antes de publicar la sala: cuando React la dibuja, su levantamiento ya está en el reloj.
        introRoomArrived(layout.rooms[layout.rooms.length - 1], layout.rooms.length - 1)
        const palace = growing(s.palace, [...s.palace.rooms, room], streamEdges(layout))
        set({
          palace,
          layout,
          roomKeys: { ...s.roomKeys, ...earnedRoomKeys(palace, {}, {}) },
          build: { ...s.build, rooms: palace.rooms.length },
        })
      },
      finishBuildingPalace: (museum) => {
        if (get().build.status !== 'building') return
        // Las salas que llegaron en vivo ya están ubicadas: una que faltara se agrega igual que las demás.
        const have = new Set(get().palace?.rooms.map((r) => r.id))
        museum.rooms.forEach((room, i) => {
          if (!have.has(room.id)) get().addBuiltRoom(room, edgesAtArrival(museum, i))
        })
        const s = get()
        if (!s.palace || !s.layout) return
        const live = new Map(s.palace.rooms.map((r) => [r.id, r]))
        // Se conservan los dioramas ya mostrados; la biblioteca solo completa lo que falte.
        const palace = attachDioramasToFinalMuseum({
          ...museum,
          rooms: museum.rooms.map((r) => {
            const diorama = live.get(r.id)?.diorama
            return diorama && !r.diorama ? { ...r, diorama } : r
          }),
        })
        // Ninguna sala se mueve: se abren las puertas extra del grafo final y cada sala recibe su contenido final
        // (modelos 3D, dioramas) tal como llegó en el museo completo.
        const layout = finalizeLayout(s.layout, palace)
        const { verified, unverified } = countSources(palace)
        set({
          palace,
          layout,
          // Igual que enterPalace con este museo: el progreso y las llaves salen del contenido final.
          memorized: learnedMap(palace),
          exam: {},
          roomKeys: earnedRoomKeys(palace, {}, {}),
          lastKeyRoomId: null,
          build: { ...IDLE_BUILD, status: 'done', rooms: palace.rooms.length, summary: verified + unverified > 0 ? sourceSummary(palace) : null },
        })
        palaceBeforeBuild = null
        introBuildDone()
      },
      failBuildingPalace: (error) => {
        const s = get()
        if (s.build.status !== 'building') return
        const n = s.palace?.rooms.length ?? 0
        if (n === 0 || !s.palace || !s.layout) {
          // Nada que conservar: de vuelta a la landing, con el palacio de antes y el error a la vista.
          set({
            screen: 'landing',
            palace: palaceBeforeBuild,
            layout: null,
            memorized: {},
            roomKeys: {},
            build: { ...IDLE_BUILD, error },
          })
          palaceBeforeBuild = null
          abortIntro()
          resetDioramaState()
          return
        }
        set({
          layout: finalizeLayout(s.layout),
          memorized: learnedMap(s.palace),
          roomKeys: earnedRoomKeys(s.palace, {}, {}),
          build: { ...IDLE_BUILD, status: 'cut', rooms: n, notice: `La IA se cortó; tu palacio tiene ${n} ${n === 1 ? 'sala' : 'salas'}` },
        })
        palaceBeforeBuild = null
        introBuildDone()
      },
      clearBuildError: () => set((s) => (s.build.error ? { build: { ...s.build, error: null } } : {})),
      resume: () => set((s) => (s.palace ? { screen: 'palace', layout: s.layout ?? buildLayout(s.palace) } : {})),
      exitToLanding: () => {
        // Salir con la IA todavía escribiendo corta la conexión; sin salas se recupera el palacio anterior.
        if (get().build.status === 'building') {
          cancelBuildSession()
          const n = get().palace?.rooms.length ?? 0
          set(
            n === 0
              ? { palace: palaceBeforeBuild, layout: null, build: IDLE_BUILD }
              : { layout: finalizeLayout(get().layout ?? emptyLayout()), build: { ...IDLE_BUILD, status: 'cut', rooms: n } },
          )
          palaceBeforeBuild = null
        }
        set({
          screen: 'landing',
          mode: 'explore',
          reviewIds: null,
          exam: {},
          openId: null,
          focusedId: null,
          focusedDoorId: null,
          arisMessage: null,
          arisPromptOpen: false,
          locked: false,
        })
        abortIntro()
        resetDioramaState()
      },
      setMode: (mode) => set({ mode, openId: null, exam: {}, reviewIds: null }),
      startReview: () => {
        const { palace } = get()
        if (!palace) return false
        const mem = useMemory.getState().palaces[palaceKey(palace)] ?? {}
        const ids = dueIds(mem, allConcepts(palace).map((c) => c.id), nowMs())
        if (!ids.length) return false
        set({ mode: 'exam', openId: null, exam: {}, reviewIds: ids })
        return true
      },
      pickupKey: () => set({ hasKey: true }),
      unlockDoor: (doorId) => set((s) => ({ unlockedDoors: { ...s.unlockedDoors, [doorId]: true } })),
      setFreeExplore: (freeExplore) => set({ freeExplore }),
      toggleMemorized: (id) =>
        set((s) => {
          // La clave de memoria depende del contenido: hasta que la IA termine el palacio no hay clave definitiva.
          if (s.build.status === 'building') return {}
          const memorized = { ...s.memorized }
          const key = s.palace ? palaceKey(s.palace) : null
          const rec = key ? useMemory.getState().palaces[key]?.[id] : undefined
          // Si ya estaba memorizado pero se olvidó, M es un repaso: restaura en vez de desmarcar.
          if (memorized[id] && rec && strengthOf(rec, nowMs()) < 0.85) {
            useMemory.getState().learn(key!, id)
            return {}
          }
          if (memorized[id]) delete memorized[id]
          else {
            memorized[id] = true
            if (key) useMemory.getState().learn(key, id)
          }
          return { memorized, ...withEarnedKeys(s, memorized, s.exam) }
        }),
      recordExam: (id, result) =>
        set((s) => {
          if (s.build.status === 'building') return {}
          if (s.palace) useMemory.getState().exam(palaceKey(s.palace), id, result === 'ok')
          const exam = { ...s.exam, [id]: result }
          return { exam, ...withEarnedKeys(s, s.memorized, exam) }
        }),
      askAris: (query) => {
        const s = get()
        const ctx = {
          palace: s.palace,
          currentRoomId: s.currentRoomId,
          memorized: s.memorized,
          hasKey: s.hasKey,
          unlockedDoors: s.unlockedDoors,
          roomKeys: s.roomKeys,
          mode: s.mode,
        }
        const res = evaluateArisQuery(query, ctx)
        if (!res.needsHelp || !s.palace) {
          speakAris(res.text, s.arisMuted)
          set({ arisMessage: res.text, arisPromptOpen: false })
          return
        }
        // Las reglas no entendieron: Haiku responde corto con la sala como contexto; si falla, el respaldo guiado.
        const waiting = 'Aris: Déjame pensarlo un momento…'
        set({ arisMessage: waiting, arisPromptOpen: false })
        void askArisHelp(query, arisHelpContext(ctx)).then((answer) => {
          // Si el jugador cerró el globo o hizo otra pregunta mientras tanto, no se pisa.
          if (get().arisMessage !== waiting) return
          const text = answer ? `Aris: ${answer}` : res.text
          speakAris(text, get().arisMuted)
          set({ arisMessage: text })
        })
      },
      setArisPromptOpen: (open) => set({ arisPromptOpen: open }),
      closeArisDialog: () => set({ arisMessage: null }),
      toggleArisMute: () => set((s) => ({ arisMuted: !s.arisMuted })),
      set: (patch) => set(patch),
    }),
    {
      name: 'mus3o-v1',
      storage: safeStorage,
      // Solo el contenido y el progreso; el layout se recalcula.
      partialize: (s) => ({
        // Mientras no llega ninguna sala, el palacio guardado sigue siendo el de antes (el solar vacío no es un palacio).
        palace: s.build.status === 'building' && (s.palace?.rooms.length ?? 0) === 0 ? palaceBeforeBuild : s.palace,
        memorized: s.memorized,
        roomKeys: s.roomKeys,
        unlockedDoors: s.unlockedDoors,
        freeExplore: s.freeExplore,
        sourceText: s.sourceText,
        arisMuted: s.arisMuted,
      }),
      // Lo guardado puede estar corrupto o venir de otra versión: se valida antes de usarlo.
      merge: (persisted, current) => {
        const p = persisted as
          | { palace?: unknown; memorized?: unknown; roomKeys?: unknown; unlockedDoors?: unknown; freeExplore?: unknown; sourceText?: unknown; arisMuted?: unknown }
          | undefined
        const freeExplore = typeof p?.freeExplore === 'boolean' ? p.freeExplore : current.freeExplore
        const arisMuted = typeof p?.arisMuted === 'boolean' ? p.arisMuted : current.arisMuted
        const palace = MuseumSchema.safeParse(p?.palace)
        if (!palace.success) return { ...current, freeExplore, arisMuted }
        const record = (value: unknown) =>
          value && typeof value === 'object' ? (value as Record<string, true>) : {}
        const memorized = record(p?.memorized)
        // Las llaves guardadas se completan con las que corresponden al progreso guardado.
        const roomKeys = { ...record(p?.roomKeys), ...earnedRoomKeys(palace.data, memorized, {}) }
        return { ...current, palace: palace.data, memorized, roomKeys, unlockedDoors: record(p?.unlockedDoors), freeExplore, arisMuted, sourceText: capSourceText(p?.sourceText) }
      },
      onRehydrateStorage: () => () => {
        void hydrateUserImages()
      },
    },
  ),
)

/** Rehidrata las imágenes del usuario guardadas en IndexedDB si el palacio actual tiene referencias a ellas. */
export async function hydrateUserImages(): Promise<void> {
  try {
    const palace = useStore.getState().palace
    if (!palace) return
    const imageIds = palace.rooms
      .flatMap((r) => r.pieces)
      .map((p) => p.image?.imageId)
      .filter((id): id is string => typeof id === 'string')
    if (imageIds.length === 0) return
    const loaded = await loadUserImages(imageIds)
    if (Object.keys(loaded).length > 0) {
      useStore.setState((s) => ({ userImages: { ...s.userImages, ...loaded } }))
    }
  } catch {
    // Silencioso ante fallos
  }
}

export function allConcepts(palace: Museum | null) {
  return palace?.rooms.flatMap((r) => r.pieces) ?? []
}

/** Una puerta está abierta si se desbloqueó con la llave o si se explora libremente. */
export function isDoorOpen(s: { freeExplore: boolean; unlockedDoors: Record<string, true> }, doorId: string) {
  return s.freeExplore || !!s.unlockedDoors[doorId]
}

/** Conceptos con registro de memoria: se ven como memorizados (banda dorada) al volver a entrar. */
function learnedMap(palace: Museum): Record<string, true> {
  const mem = useMemory.getState().palaces[palaceKey(palace)] ?? {}
  const out: Record<string, true> = {}
  for (const c of allConcepts(palace)) if (mem[c.id]) out[c.id] = true
  return out
}

/** ¿Este concepto se pregunta en el examen actual? (todo, o solo lo pendiente en un repaso) */
export function inExamScope(s: Pick<State, 'mode' | 'reviewIds'>, id: string): boolean {
  return s.mode === 'exam' && (!s.reviewIds || s.reviewIds.includes(id))
}
