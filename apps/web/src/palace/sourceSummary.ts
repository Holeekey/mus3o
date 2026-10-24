import { countSources, type Museum } from '@mus3o/shared'

/** "17 de 17 conceptos verificados en tus apuntes" o "15 de 17 · 2 sin fuente". */
export function sourceSummary(palace: Museum): string {
  const { total, verified, unverified } = countSources(palace)
  return unverified === 0
    ? `${verified} de ${total} conceptos verificados en tus apuntes`
    : `${verified} de ${total} · ${unverified} sin fuente`
}
