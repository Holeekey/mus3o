/**
 * Una sola generación en vivo a la vez. Vive aparte del store y del orquestador para que el store pueda
 * cortarla (al salir del palacio) sin importar al orquestador, que a su vez importa al store.
 */
let current: AbortController | null = null

/** Empieza una sesión nueva y corta la anterior si seguía abierta. */
export function newBuildSession(): AbortController {
  current?.abort()
  current = new AbortController()
  return current
}

/** Corta la conexión con el servidor (y con ello al modelo) de la sesión en curso. */
export function cancelBuildSession(): void {
  current?.abort()
  current = null
}
