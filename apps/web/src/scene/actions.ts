import { handleDioramaKey, useDioramaStore } from '../diorama/dioramaStore'
import { introState } from '../intro/store'
import { canListen } from '../lib/voice'
import { findDoor } from '../palace/inputKeys'
import { canOpenDoor } from '../palace/keys'
import type { PalaceLayout } from '../palace/layout'
import { pieceKind } from '../palace/pieceKind'
import { inExamScope, isDoorOpen, useStore } from '../store'
import { pointerLock } from './pointerLock'

/**
 * Acciones del jugador. El teclado (Player) y la pantalla táctil (TouchControls, KeyHint) llaman a
 * estas mismas funciones, así un botón nunca hace menos que su tecla.
 */

function focusedPiece(layout: PalaceLayout, id: string) {
  for (const r of layout.rooms) {
    const p = r.pedestals.find((x) => x.concept.id === id)
    if (p) return p.concept
  }
  return null
}

/** E sin el atajo del cuadro: abre la compuerta, recoge la llave o abre y cierra la ficha. */
export function examine(layout: PalaceLayout) {
  const s = useStore.getState()
  if (s.focusedDoorId && !isDoorOpen(s, s.focusedDoorId)) {
    const door = findDoor(layout, s.focusedDoorId)
    if (door && canOpenDoor(door, s.hasKey, s.roomKeys)) s.unlockDoor(door.id)
    return
  }
  if (s.openId) {
    s.set({ openId: null })
    return
  }
  if (!s.focusedId) return
  const piece = focusedPiece(layout, s.focusedId)
  if (piece && pieceKind(piece) === 'key') s.pickupKey()
  s.set({ openId: s.focusedId })
  // Con dictado el puntero sigue bloqueado y se responde en voz alta; sin él hay que escribir.
  if (inExamScope(s, s.focusedId) && !s.exam[s.focusedId] && !canListen()) pointerLock.unlock()
}

/** E completa: primero entra al cuadro que se mira (si hay uno), si no examina. */
export function interact(layout: PalaceLayout) {
  if (introState.active) return
  if (handleDioramaKey('KeyE')) return
  examine(layout)
}

/** M: marca o desmarca el concepto abierto o enfocado. Solo al explorar. */
export function toggleMemorize() {
  const s = useStore.getState()
  if (introState.active || s.mode !== 'explore') return
  const id = s.openId ?? s.focusedId
  if (id) s.toggleMemorized(id)
}

/** T: abre la consulta a Aris. No dentro del cuadro ni con una tarjeta de examen abierta. */
export function openAris(options: { unlock: boolean } = { unlock: true }) {
  const s = useStore.getState()
  if (introState.active || s.arisPromptOpen || useDioramaStore.getState().phase !== 'room') return
  if (s.openId && inExamScope(s, s.openId)) return
  s.setArisPromptOpen(true)
  if (options.unlock) pointerLock.unlock()
}

/** Q: vuelve del cuadro a la sala. */
export function leaveDiorama() {
  if (!introState.active) handleDioramaKey('KeyQ')
}

/** E frente a un cuadro: entra al diorama. */
export function enterDiorama() {
  if (!introState.active) handleDioramaKey('KeyE')
}
