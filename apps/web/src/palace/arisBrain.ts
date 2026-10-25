import type { Museum } from '@mus3o/shared'
import { PalaceGraphNavigator } from '@mus3o/dungeon-core'
import { playArisVoice } from './arisAudio'

export type ArisResponse = {
  text: string
  targetCoords?: [number, number] // [x, z] en el mundo si aplica para guiar la mirada
  /** Las reglas no entendieron la pregunta: el texto es solo el respaldo guiado y se puede pedir ayuda a Haiku. */
  needsHelp?: boolean
}

type BrainContext = {
  palace: Museum | null
  currentRoomId: string | null
  memorized: Record<string, true>
  hasKey: boolean
  unlockedDoors: Record<string, true>
  roomKeys?: Record<string, true>
  mode: 'explore' | 'exam'
}

// Distancia de Levenshtein simple para tolerancia a errores tipográficos (0 KB)
function levenshtein(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 2) return 99
  const d: number[][] = []
  for (let i = 0; i <= a.length; i++) d[i] = [i]
  for (let j = 0; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost)
    }
  }
  return d[a.length][b.length]
}

function matchesAny(tokens: string[], targets: string[], maxDist = 1): boolean {
  return tokens.some((token) =>
    targets.some((target) => {
      if (token === target) return true
      // Subcadenas solo si la menor tiene 4+ letras: "ola" no debe saludar dentro de "escolástica".
      if (Math.min(token.length, target.length) >= 4 && (token.includes(target) || target.includes(token))) return true
      return token.length >= 4 && target.length >= 4 && levenshtein(token, target) <= maxDist
    })
  )
}


const STOPWORDS = new Set(['sobre', 'para', 'como', 'cómo', 'esta', 'este', 'esto', 'esos', 'esas', 'cual', 'cuál', 'quien', 'quién', 'donde', 'dónde', 'tiene', 'significa', 'dime', 'cuentame', 'cuéntame', 'explicame', 'explícame', 'habla', 'palacio', 'museo', 'sala', 'concepto', 'pieza', 'pedestal', 'pedestales', 'del', 'los', 'las', 'una', 'que', 'qué', 'por', 'con', 'son', 'fue'])

const normalize = (t: string) => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

/** Palabras con contenido de un título o nombre de sala (sin tildes ni palabras vacías). */
function significantTokens(text: string): string[] {
  return normalize(text)
    .split(/[^a-z0-9ñ]+/)
    .filter((t) => t.length >= 4 && !STOPWORDS.has(t))
}

/** Cuántas palabras de `name` aparecen en la consulta (igual, prefijo o a un typo de distancia). */
function nameScore(queryTokens: string[], name: string): number {
  const sig = significantTokens(name)
  if (sig.length === 0) return 0
  const hits = sig.filter((w) => queryTokens.some((t) => t === w || (t.length >= 4 && (w.startsWith(t) || t.startsWith(w))) || (w.length >= 5 && t.length >= 5 && levenshtein(t, w) <= 1))).length
  return hits >= Math.ceil(sig.length / 2) ? hits / sig.length + hits : 0
}

function bestMatch<T>(items: T[], nameOf: (i: T) => string, queryTokens: string[], prefer?: (i: T) => boolean): T | null {
  let best: T | null = null
  let bestScore = 0
  for (const item of items) {
    const score = nameScore(queryTokens, nameOf(item)) + (prefer?.(item) ? 0.01 : 0)
    if (score > bestScore) {
      best = item
      bestScore = score
    }
  }
  return bestScore >= 1 ? best : null
}

/** Recorta a una frase o a `max` caracteres para que el globo de Aris sea legible. */
function brief(text: string, max = 160): string {
  const t = text.replace(/\s+/g, ' ').trim()
  if (t.length <= max) return t
  const cut = t.slice(0, max)
  const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('; '))
  return end > 40 ? cut.slice(0, end + 1) : cut.replace(/\s+\S*$/, '') + '…'
}

export function evaluateArisQuery(query: string, ctx: BrainContext): ArisResponse {
  const q = query.toLowerCase().trim()
  const rawTokens = q.split(/[\s,?.!¿¡;:]+/).filter(Boolean)
  const queryTokens = normalize(q).split(/[^a-z0-9ñ]+/).filter(Boolean)
  const { palace, currentRoomId, memorized, hasKey, unlockedDoors, mode } = ctx

  if (!palace || palace.rooms.length === 0) {
    return { text: 'Aris: Aún estamos levantando los cimientos del museo. ¡Enseguida estará listo!' }
  }

  const currentRoom = palace.rooms.find((r) => r.id === currentRoomId) ?? palace.rooms[0]
  const currentIndex = palace.rooms.findIndex((r) => r.id === currentRoom.id)
  const currentPieces = currentRoom.pieces || []
  const unmemorizedInRoom = currentPieces.filter((p) => !memorized[p.id])
  const allPieces = palace.rooms.flatMap((r) => r.pieces)
  const totalCount = allPieces.length
  const memorizedTotal = allPieces.filter((p) => memorized[p.id]).length

  // 1. SALUDOS / PRESENTACIÓN ("hoa", "hola", "buenas", "hey", "aris", "quién eres")
  if (matchesAny(rawTokens, ['hola', 'hoa', 'ola', 'buenas', 'buenos', 'hey', 'saludos', 'quien', 'aris'])) {
    return {
      text: 'Aris: ¡Hola! Soy Aris, tu compañero de estudio en este museo. Puedo orientarte hacia la siguiente sala, recordarte qué conceptos te faltan memorizar o darte pistas. ¿Qué quieres explorar?',
    }
  }

  // 2. AGRADECIMIENTOS / SOCIAL ("gracias", "genial", "crack", "bien")
  if (matchesAny(rawTokens, ['gracias', 'genial', 'crack', 'excelente', 'bueno', 'perfecto', 'vale'])) {
    return {
      text: 'Aris: ¡A ti! Me alegra acompañarte. Recuerda que puedes preguntarme en cualquier momento si tienes dudas durante tu recorrido.',
    }
  }

  // 3. PROGRESO / SCORE ("cómo voy", "progreso", "cuánto llevo", "score", "avance")
  if (matchesAny(rawTokens, ['progreso', 'score', 'cuanto', 'cuánto', 'avance', 'puntos', 'porcentaje', 'estadistica'])) {
    const pct = Math.round((memorizedTotal / Math.max(totalCount, 1)) * 100)
    return {
      text: `Aris: Tu avance en el museo es del ${pct}% (${memorizedTotal} de ${totalCount} conceptos dominados). En la sala actual "${currentRoom.name}" te faltan ${unmemorizedInRoom.length} pedestales por aprender.`,
    }
  }

  // 4. UBICACIÓN / DÓNDE ESTOY ("dónde estoy", "qué sala es", "lugar")
  if (
    matchesAny(rawTokens, ['donde', 'dónde', 'ubicacion', 'ubicación', 'lugar']) &&
    (q.includes('estoy') || q.includes('estamos') || q.includes('sala') || q.includes('aqui') || q.includes('aquí'))
  ) {
    return {
      text: `Aris: Estás en la Sala ${currentIndex + 1} de ${palace.rooms.length}: "${currentRoom.name}". Cuenta con ${currentPieces.length} pedestales conceptuales distribuidos en el anillo de la sala.`,
    }
  }

  // 5. NAVEGACIÓN / LLAVE / COMPUERTA / PUERTA ("llave", "puerta", "reja", "bloquead")
  const { roomKeys } = ctx
  if (matchesAny(rawTokens, ['llave', 'puerta', 'compuerta', 'reja', 'candado', 'bloquead', 'abrir', 'cerrad'])) {
    const hasRoomKey = !!roomKeys?.[currentRoom.id]
    if (hasKey || hasRoomKey) {
      return {
        text: `Aris: ¡Tienes acceso para abrir la compuerta! ${hasRoomKey ? 'Ganaste la llave de esta sala al memorizar sus piezas.' : 'Tienes la Llave de Hierro en tu inventario.'} Acércate a la puerta y presiona E (o toca 👁️) para desbloquearla.`,
      }
    } else {
      return {
        text: 'Aris: Para abrir la compuerta tienes dos caminos: memorizar todas las piezas de esta sala para ganar su llave de acceso, o encontrar la Llave de Hierro en el suelo.',
      }
    }
  }

  // 5b. CONCEPTO O SALA POR NOMBRE ("qué es el Senado", "háblame de Julio César", "dónde está la sala del Foro")
  const piece = bestMatch(allPieces, (p) => p.title, queryTokens, (p) => currentPieces.some((c) => c.id === p.id))
  if (piece) {
    const room = palace.rooms.find((r) => r.pieces.some((p) => p.id === piece.id))
    const wantsCue = matchesAny(rawTokens, ['recordar', 'recuerdo', 'truco', 'mnemotecnia', 'asociar', 'asociacion', 'asociación'])
    const body = wantsCue && piece.mnemonicCue ? piece.mnemonicCue : piece.text || piece.fact
    return {
      text: `Aris: "${piece.title}" está en "${room?.name ?? currentRoom.name}"${memorized[piece.id] ? ' (ya lo memorizaste)' : ''}. ${brief(body)}`,
    }
  }
  const namedRoom = bestMatch(palace.rooms, (r) => r.name, queryTokens, (r) => r.id === currentRoom.id)
  if (namedRoom) {
    const idx = palace.rooms.findIndex((r) => r.id === namedRoom.id)
    const done = namedRoom.pieces.filter((p) => memorized[p.id]).length
    let routeHint = ''
    if (namedRoom.id !== currentRoom.id) {
      const pathResult = PalaceGraphNavigator.findPath(palace, currentRoom.id, namedRoom.id)
      if (pathResult) {
        routeHint = ` ${PalaceGraphNavigator.describePath(pathResult, namedRoom.name)}`
      }
    }
    return {
      text: `Aris: "${namedRoom.name}" es la Sala ${idx + 1} de ${palace.rooms.length}, con ${namedRoom.pieces.length} conceptos (${done} memorizados). ${brief(namedRoom.description || '', 110)}${routeHint}`.trim(),
    }
  }

  // 5c. LISTAS Y CONTEOS ("qué conceptos hay", "cuántas salas", "lista las piezas")
  if (matchesAny(rawTokens, ['conceptos', 'piezas', 'pedestales', 'lista', 'listar', 'hay', 'objetos'])) {
    const names = currentPieces.map((p) => `${memorized[p.id] ? '✓ ' : ''}${p.title}`).join(', ')
    return { text: `Aris: En "${currentRoom.name}" hay ${currentPieces.length} conceptos: ${brief(names, 220)}.` }
  }
  if (matchesAny(rawTokens, ['salas', 'habitaciones', 'camaras', 'cámaras', 'mapa', 'minimapa']) && q.includes('cu')) {
    return { text: `Aris: El museo "${palace.title}" tiene ${palace.rooms.length} salas y ${totalCount} conceptos en total. Estás en la Sala ${currentIndex + 1}.` }
  }

  // 5d. CONTROLES / CÓMO SE JUEGA ("controles", "teclas", "cómo me muevo", "cómo marco memorizado")
  if (matchesAny(rawTokens, ['controles', 'teclas', 'tecla', 'mover', 'muevo', 'caminar', 'correr', 'jugar', 'manejo', 'marco', 'marcar', 'usar', 'uso'])) {
    return {
      text: 'Aris: WASD para moverte, Shift para correr, el mouse para mirar, E para examinar un concepto o abrir una puerta, M para marcarlo como memorizado y T para hablar conmigo.',
    }
  }

  // 5e. QUÉ ES ESTO / MÉTODO ("qué es un palacio de la memoria", "método de loci", "para qué sirve")
  if (matchesAny(rawTokens, ['loci', 'metodo', 'método', 'mnemotecnia', 'sirve', 'funciona', 'palacio', 'museo']) && !q.includes('progreso')) {
    return {
      text: 'Aris: Un museo de la memoria asocia cada idea con un lugar y un objeto 3D. Al recorrer las salas en orden y recordar la imagen de cada pedestal, recuerdas el concepto. Luego el repaso espaciado y el examen miden qué retienes.',
    }
  }

  // 6. QUÉ FALTA MEMORIZAR ("falta", "pendiente", "queda", "memorizar", "olvidé")
  if (matchesAny(rawTokens, ['falta', 'pendiente', 'memoriz', 'queda', 'olvid', 'aprender', 'incompleto'])) {
    if (unmemorizedInRoom.length > 0) {
      const nextPiece = unmemorizedInRoom[0]
      return {
        text: `Aris: En esta sala aún te falta dominar "${nextPiece.title}". Acércate a su pedestal y márcalo con la tecla M (o el botón ✓) cuando lo hayas fijado en tu memoria.`,
      }
    } else {
      const remainingGlobal = allPieces.filter((p) => !memorized[p.id])
      if (remainingGlobal.length === 0) {
        return {
          text: 'Aris: ¡Completaste todo el museo! Has memorizado cada concepto. Ya estás preparado para afrontar el Modo Examen.',
        }
      }
      return {
        text: `Aris: ¡Dominas el 100% de esta sala! Ya aprendiste los conceptos de "${currentRoom.name}". Sigue el pasillo hacia la siguiente habitación.`,
      }
    }
  }

  // 7. SIGUIENTE PASO / RUTA ("siguiente", "sigue", "después", "adónde", "ruta", "camino")
  if (matchesAny(rawTokens, ['siguiente', 'sigue', 'despues', 'después', 'proximo', 'próximo', 'adonde', 'adónde', 'ruta', 'camino'])) {
    if (currentIndex < palace.rooms.length - 1) {
      const nextRoom = palace.rooms[currentIndex + 1]
      return {
        text: `Aris: Tu siguiente destino es la Sala ${currentIndex + 2}: "${nextRoom.name}". Camina por el pasillo conectado para continuar el orden del recorrido.`,
      }
    } else {
      return {
        text: 'Aris: Estás en la última cámara del museo. Puedes repasar los pedestales o ingresar al Modo Examen para validar tu retención.',
      }
    }
  }

  // 8. RESUMEN / EXPLICACIÓN DE SALA ("resumen", "trata", "explica", "tema")
  if (matchesAny(rawTokens, ['resumen', 'trata', 'explica', 'tema', 'contenido'])) {
    const totalInRoom = currentPieces.length
    const mastered = currentPieces.filter((p) => memorized[p.id]).length
    return {
      text: `Aris: En "${currentRoom.name}" estudiamos este tema a través de ${totalInRoom} pedestales (llevas ${mastered} memorizados). ${currentRoom.description || 'Recorre cada objeto para asimilar el concepto.'}`,
    }
  }

  // 9. PISTAS / EXAMEN ("pista", "ayuda", "examen", "recordar")
  if (matchesAny(rawTokens, ['pista', 'ayuda', 'examen', 'test', 'recordar'])) {
    if (mode === 'exam') {
      return {
        text: 'Aris: En Modo Examen los títulos están ocultos. Si tienes dudas en un pedestal, presiona "Ver pista" para descubrir la primera letra y su longitud.',
      }
    } else {
      return {
        text: 'Aris: Un consejo mnemotécnico: asocia la forma 3D y el color del pedestal con la idea principal del texto. Esa asociación espacial fija el recuerdo.',
      }
    }
  }

  // 10. Sin letras suficientes (ruido, un símbolo, "asdf") no vale la pena gastar una consulta a Haiku.
  const worthAsking = queryTokens.filter((t) => t.length >= 3).length >= 1 && /[a-zñ]{3}/.test(normalize(q))

  // 11. Fallback guiado e interactivo con ejemplos reales
  return {
    text: 'Aris: No estoy seguro de entenderte del todo, pero puedes consultarme:\n• "¿Qué me falta memorizar?"\n• "¿Adónde voy ahora?"\n• "¿Dónde está la llave?"\n• "¿Cómo va mi progreso?"',
    needsHelp: worthAsking,
  }
}

/** Lo único que Aris le pasa a Haiku: la sala actual y los títulos de sus conceptos (nunca los apuntes). */
export function arisHelpContext(ctx: Pick<BrainContext, 'palace' | 'currentRoomId'>) {
  const room = ctx.palace?.rooms.find((r) => r.id === ctx.currentRoomId) ?? ctx.palace?.rooms[0]
  return {
    palaceTitle: ctx.palace?.title,
    roomName: room?.name,
    topics: (room?.pieces ?? []).slice(0, 12).map((p) => p.title.slice(0, 80)),
  }
}

// Síntesis de voz robótica nativa con feedback procedural (0 KB de librerías)
export function speakAris(text: string, muted?: boolean) {
  playArisVoice(text, { muted })
}
