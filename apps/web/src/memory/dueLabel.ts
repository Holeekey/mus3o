/** Texto del chip de repasos pendientes ("3 repasos pendientes"); `null` si no hay ninguno. */
export function dueLabel(count: number): string | null {
  if (count <= 0) return null
  return `${count} ${count === 1 ? 'repaso pendiente' : 'repasos pendientes'}`
}
