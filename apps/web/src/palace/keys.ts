import type { Museum, Room } from '@mus3o/shared'
import type { DoorLayout } from './layout'

export type ExamResults = Record<string, 'ok' | 'fail'>

/**
 * Piezas de la sala que faltan memorizar (todas cuentan, igual que en el contador del HUD).
 * Una respuesta correcta en el examen cuenta como memorizada.
 */
export function remainingToMemorize(room: Room, memorized: Record<string, true>, exam: ExamResults): number {
  return room.pieces.filter((p) => !memorized[p.id] && exam[p.id] !== 'ok').length
}

/** Salas cuya llave ya se ganó: todas sus piezas memorizadas, o salas sin piezas. */
export function earnedRoomKeys(palace: Museum, memorized: Record<string, true>, exam: ExamResults) {
  const keys: Record<string, true> = {}
  for (const room of palace.rooms) {
    if (remainingToMemorize(room, memorized, exam) === 0) keys[room.id] = true
  }
  return keys
}

/** La puerta se abre con la llave de la sala de la que sale, o con la llave de hierro de la mazmorra. */
export function canOpenDoor(door: DoorLayout, hasKey: boolean, roomKeys: Record<string, true>): boolean {
  return hasKey || !!roomKeys[door.fromRoomId]
}
