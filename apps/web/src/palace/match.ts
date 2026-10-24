const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

function levenshtein(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0]
    prev[0] = i
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j]
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1))
      diag = tmp
    }
  }
  return prev[b.length]
}

/**
 * Formas aceptables de un título: el completo, sin paréntesis y cada parte separada por
 * coma, barra o punto y coma. "Pedro Camejo, Negro Primero" → completo, "Pedro Camejo",
 * "Negro Primero". Al dictar casi nadie dice el título entero.
 */
export function answerAliases(title: string): string[] {
  const out = new Set<string>()
  const add = (s: string) => {
    const t = s.replace(/\s+/g, ' ').trim()
    if (normalize(t).length >= 2) out.add(t)
  }
  add(title)
  const noParens = title.replace(/\([^)]*\)/g, ' ')
  add(noParens)
  for (const part of noParens.split(/[,/;]/)) add(part)
  return [...out]
}

function matchesOne(answer: string, expected: string): boolean {
  const a = normalize(answer)
  const e = normalize(expected)
  if (!a || !e) return false
  if (a === e) return true
  // En siglas cortas (ATP vs ADN) una letra cambia el concepto: se exige exactitud.
  const tolerance = e.length < 5 ? 0 : Math.max(1, Math.floor(e.length * 0.2))
  if (levenshtein(a, e) <= tolerance) return true
  return a.length >= e.length * 0.6 && e.includes(a)
}

// Tolera tildes, mayúsculas, errores de tipeo menores y respuestas parciales del título.
export function isCorrectAnswer(answer: string, title: string): boolean {
  return answerAliases(title).some((alias) => matchesOne(answer, alias))
}

/** El reconocimiento de voz devuelve varias hipótesis: basta con que una acierte. */
export function isCorrectAny(answers: string[], title: string): boolean {
  return answers.some((a) => isCorrectAnswer(a, title))
}
