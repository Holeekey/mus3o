// Preferencia del narrador (tecla N). Vive aparte de Narrator.tsx para que la guía de Aris dentro
// de los cuadros pueda saber si hay que hablar sin montar el componente.

export const NARRATOR_KEY = 'mus3o-narrator'

export function readNarratorOn(): boolean {
  try {
    return window.localStorage.getItem(NARRATOR_KEY) === '1'
  } catch {
    return false
  }
}

export function saveNarratorOn(on: boolean): void {
  try {
    window.localStorage.setItem(NARRATOR_KEY, on ? '1' : '0')
  } catch {
    /* sin almacenamiento: solo dura la sesión */
  }
}
