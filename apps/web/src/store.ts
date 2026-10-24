import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { buildLayout, type PalaceLayout } from './palace/layout'
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
  /** Exploración libre: todas las puertas abiertas, sin llaves. Preferencia del usuario. */
  freeExplore: boolean

  enterPalace: (palace: Museum) => void
  resume: () => void
  exitToLanding: () => void
  setMode: (mode: Mode) => void
  toggleMemorized: (id: string) => void
  pickupKey: () => void
  unlockDoor: (doorId: string) => void
  setFreeExplore: (on: boolean) => void
  recordExam: (id: string, result: ExamResult) => void
  set: (patch: Partial<Pick<State, 'currentRoomId' | 'focusedId' | 'focusedDoorId' | 'openId' | 'locked'>>) => void
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
      freeExplore: true,

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
      setFreeExplore: (freeExplore) => set({ freeExplore }),
      toggleMemorized: (id) =>
        set((s) => {
          const memorized = { ...s.memorized }
          if (memorized[id]) delete memorized[id]
          else memorized[id] = true
          return { memorized }
        }),
      recordExam: (id, result) => set((s) => ({ exam: { ...s.exam, [id]: result } })),
      set: (patch) => set(patch),
    }),
    {
      name: 'mus3o-v1',
      storage: safeStorage,
      // Solo el contenido y el progreso; el layout se recalcula.
      partialize: (s) => ({ palace: s.palace, memorized: s.memorized, freeExplore: s.freeExplore }),
      // Lo guardado puede estar corrupto o venir de otra versión: se valida antes de usarlo.
      merge: (persisted, current) => {
        const p = persisted as { palace?: unknown; memorized?: unknown; freeExplore?: unknown } | undefined
        const freeExplore = typeof p?.freeExplore === 'boolean' ? p.freeExplore : current.freeExplore
        const palace = MuseumSchema.safeParse(p?.palace)
        if (!palace.success) return { ...current, freeExplore }
        const memorized =
          p?.memorized && typeof p.memorized === 'object' ? (p.memorized as Record<string, true>) : {}
        return { ...current, palace: palace.data, memorized, freeExplore }
      },
    },
  ),
)

export function allConcepts(palace: Museum | null) {
  return palace?.rooms.flatMap((r) => r.pieces) ?? []
}

/** Una puerta está abierta si se desbloqueó con la llave o si se explora libremente. */
export function isDoorOpen(s: { freeExplore: boolean; unlockedDoors: Record<string, true> }, doorId: string) {
  return s.freeExplore || !!s.unlockedDoors[doorId]
}
