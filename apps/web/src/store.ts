import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
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
  set: (patch: Partial<Pick<State, 'currentRoomId' | 'focusedId' | 'focusedDoorId' | 'openId' | 'locked' | 'arisMessage' | 'arisPromptOpen'>>) => void
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
          return { memorized }
        }),
      recordExam: (id, result) => set((s) => ({ exam: { ...s.exam, [id]: result } })),
      askAris: (query) =>
        set((s) => {
          const res = evaluateArisQuery(query, {
            palace: s.palace,
            currentRoomId: s.currentRoomId,
            memorized: s.memorized,
            hasKey: s.hasKey,
            unlockedDoors: s.unlockedDoors,
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
      partialize: (s) => ({ palace: s.palace, memorized: s.memorized }),
      // Lo guardado puede estar corrupto o venir de otra versión: se valida antes de usarlo.
      merge: (persisted, current) => {
        const p = persisted as { palace?: unknown; memorized?: unknown } | undefined
        const palace = MuseumSchema.safeParse(p?.palace)
        if (!palace.success) return current
        const memorized =
          p?.memorized && typeof p.memorized === 'object' ? (p.memorized as Record<string, true>) : {}
        return { ...current, palace: palace.data, memorized }
      },
    },
  ),
)

export function allConcepts(palace: Museum | null) {
  return palace?.rooms.flatMap((r) => r.pieces) ?? []
}
