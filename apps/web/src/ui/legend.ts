import { useEffect, useState } from 'react'

/** Tiempo que se ven los controles al entrar si nadie se mueve. */
export const INTRO_MS = 15_000
/** Quieto este tiempo, los controles vuelven a aparecer (quizás no sabe cómo seguir). */
export const IDLE_MS = 30_000

const MOVE_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'])

/** ¿Se muestra la píldora de controles? `lastMoveAt` es null mientras no se haya movido desde que entró. */
export function legendShown(now: number, enteredAt: number, lastMoveAt: number | null): boolean {
  if (lastMoveAt === null) return now - enteredAt < INTRO_MS
  return now - lastMoveAt >= IDLE_MS
}

/** Controles a la vista solo cuando hacen falta: al entrar y tras un rato quieto; se ocultan al caminar. */
export function useLegendShown(active: boolean): boolean {
  const [state, setState] = useState({ enteredAt: 0, lastMoveAt: null as number | null, now: 0 })
  useEffect(() => {
    if (!active) return
    const start = performance.now()
    setState({ enteredAt: start, lastMoveAt: null, now: start })
    const onKey = (e: KeyboardEvent) => {
      if (MOVE_KEYS.has(e.code)) setState((s) => ({ ...s, lastMoveAt: performance.now(), now: performance.now() }))
    }
    const tick = window.setInterval(() => setState((s) => ({ ...s, now: performance.now() })), 1_000)
    window.addEventListener('keydown', onKey)
    return () => {
      window.clearInterval(tick)
      window.removeEventListener('keydown', onKey)
    }
  }, [active])
  return active && legendShown(state.now, state.enteredAt, state.lastMoveAt)
}
