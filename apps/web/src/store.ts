import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { earnedRoomKeys } from './palace/keys'
import { buildLayout, type PalaceLayout } from './palace/layout'
import { evaluateArisQuery, speakAris } from './palace/arisBrain'
import { MuseumSchema, type Museum } from '@mus3o/shared'

export type Screen = 'landing' | 'palace'
export type Mode = 'explore' | 'exam'
export type ExamResult = 'ok' | 'fail'

// Pose del jugador: se escribe cada frame, se lee desde el minimapa sin re-renderizar React.
export const playerPose = { x: 0, z: 0, yaw: 0 }

type State = {
  screen: Screen
  mode: Mode
  palace: Museum | null
  layout: PalaceLayout | null
  memorized: Record<string, true>
  exam: Record<string, ExamResult>
  currentRoomId: string | null
  focusedId: string | null
  focusedDoorId: string | null
  openId: string | null
  locked: boolean
  hasKey: boolean
  unlockedDoors: Record<string, true>
  /** Llave de cada sala ganada al memorizar todas sus piezas. No se pierde al desmarcar. */
  roomKeys: Record<string, true>
  /** Sala cuya llave se acaba de ganar, para avisarlo en el HUD. */
  lastKeyRoomId: string | null
  arisMessage: string | null
  arisPromptOpen: boolean

  enterPalace: (palace: Museum) => void
  resume: () => void
  exitToLanding: () => void
  setMode: (mode: Mode) => void
  toggleMemorized: (id: string) => void
  pickupKey: () => void
  unlockDoor: (doorId: string) => void
  recordExam: (id: string, result: ExamResult) => void
  askAris: (query: string) => void
  setArisPromptOpen: (open: boolean) => void
  closeArisDialog: () => void
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

const safeStorage = createJSONStorage(() => {
  try {
    return window.localStorage
  } catch {
    return undefined as unknown as Storage
  }
})

export const useStore = create<State>()(
  persist(
    (set) => ({
      screen: 'landing',
      mode: 'explore',
      palace: null,
      layout: null,
      memorized: {},
      exam: {},
      currentRoomId: null,
      focusedId: null,
      focusedDoorId: null,
      openId: null,
      locked: false,
      hasKey: false,
      unlockedDoors: {},
      roomKeys: {},
      lastKeyRoomId: null,
      arisMessage: null,
      arisPromptOpen: false,

      enterPalace: (palace) =>
        set({
          palace,
          layout: buildLayout(palace),
          screen: 'palace',
          mode: 'explore',
          memorized: {},
          exam: {},
          openId: null,
          focusedId: null,
          focusedDoorId: null,
          hasKey: false,
          unlockedDoors: {},
          // Las salas sin nada que memorizar ya tienen su llave.
          roomKeys: earnedRoomKeys(palace, {}, {}),
          lastKeyRoomId: null,
        }),
      resume: () => set((s) => (s.palace ? { screen: 'palace', layout: s.layout ?? buildLayout(s.palace) } : {})),
      exitToLanding: () => set({ screen: 'landing', openId: null, focusedId: null, focusedDoorId: null }),
      setMode: (mode) => set({ mode, openId: null, exam: {} }),
      pickupKey: () => set({ hasKey: true }),
      unlockDoor: (doorId) => set((s) => ({ unlockedDoors: { ...s.unlockedDoors, [doorId]: true } })),
      toggleMemorized: (id) =>
        set((s) => {
          const memorized = { ...s.memorized }
          if (memorized[id]) delete memorized[id]
          else memorized[id] = true
          return { memorized, ...withEarnedKeys(s, memorized, s.exam) }
        }),
      recordExam: (id, result) =>
        set((s) => {
          const exam = { ...s.exam, [id]: result }
          return { exam, ...withEarnedKeys(s, s.memorized, exam) }
        }),
      askAris: (query) =>
        set((s) => {
          const res = evaluateArisQuery(query, {
            palace: s.palace,
            currentRoomId: s.currentRoomId,
            memorized: s.memorized,
            hasKey: s.hasKey,
            unlockedDoors: s.unlockedDoors,
            roomKeys: s.roomKeys,
            mode: s.mode,
          })
          speakAris(res.text)
          return { arisMessage: res.text, arisPromptOpen: false }
        }),
      setArisPromptOpen: (open) => set({ arisPromptOpen: open }),
      closeArisDialog: () => set({ arisMessage: null }),
      set: (patch) => set(patch),
    }),
    {
      name: 'mus3o-v1',
      storage: safeStorage,
      // Solo el contenido y el progreso; el layout se recalcula.
      partialize: (s) => ({
        palace: s.palace,
        memorized: s.memorized,
        roomKeys: s.roomKeys,
      }),
      // Lo guardado puede estar corrupto o venir de otra versión: se valida antes de usarlo.
      merge: (persisted, current) => {
        const p = persisted as { palace?: unknown; memorized?: unknown; roomKeys?: unknown } | undefined
        const palace = MuseumSchema.safeParse(p?.palace)
        if (!palace.success) return current
        const memorized =
          p?.memorized && typeof p.memorized === 'object' ? (p.memorized as Record<string, true>) : {}
        const roomKeys =
          p?.roomKeys && typeof p.roomKeys === 'object' ? (p.roomKeys as Record<string, true>) : {}
        return { ...current, palace: palace.data, memorized, roomKeys }
      },
    },
  ),
)

export function allConcepts(palace: Museum | null) {
  return palace?.rooms.flatMap((r) => r.pieces) ?? []
}
