import type { Museum } from '@mus3o/shared'

export type ArisResponse = {
  text: string
  targetCoords?: [number, number] // [x, z] en el mundo si aplica para guiar la mirada
}

type BrainContext = {
  palace: Museum | null
  currentRoomId: string | null
  memorized: Record<string, true>
  hasKey: boolean
  unlockedDoors: Record<string, true>
  mode: 'explore' | 'exam'
}

export function evaluateArisQuery(query: string, ctx: BrainContext): ArisResponse {
  const q = query.toLowerCase().trim()
  const { palace, currentRoomId, memorized, hasKey, unlockedDoors, mode } = ctx

  if (!palace || palace.rooms.length === 0) {
    return { text: 'Aris: Aún estamos construyendo el palacio. ¡Pronto estará listo!' }
  }

  const currentRoom = palace.rooms.find((r) => r.id === currentRoomId) ?? palace.rooms[0]
  const currentPieces = currentRoom.pieces || []
  const unmemorizedInRoom = currentPieces.filter((p) => !memorized[p.id])

  // 1. INTENT_NAVIGATION_GUIDE / LLAVE / PUERTA
  if (q.includes('llave') || q.includes('puerta') || q.includes('bloquead') || q.includes('abrir') || q.includes('guíame') || q.includes('guiame')) {
    if (!hasKey) {
      return {
        text: 'Aris: La compuerta de la mazmorra está bloqueada. Busca la Llave de Hierro en el suelo de una de las cámaras para abrirla.',
      }
    } else {
      return {
        text: 'Aris: ¡Ya tienes la Llave de Hierro en tu inventario! Acércate a la compuerta enrejada y presiona E para desbloquearla.',
      }
    }
  }

  // 2. INTENT_FIND_UNMEMORIZED (Qué falta memorizar)
  if (q.includes('falta') || q.includes('pendiente') || q.includes('memoriz') || q.includes('olvid') || q.includes('queda')) {
    if (unmemorizedInRoom.length > 0) {
      const nextPiece = unmemorizedInRoom[0]
      return {
        text: `Aris: En esta sala te falta dominar "${nextPiece.title}". Acércate a su pedestal y presiona M cuando lo recuerdes.`,
      }
    } else {
      // Revisar si faltan en otras salas
      const allPieces = palace.rooms.flatMap((r) => r.pieces)
      const remainingGlobal = allPieces.filter((p) => !memorized[p.id])
      if (remainingGlobal.length === 0) {
        return {
          text: 'Aris: ¡Increíble! Has memorizado todos los conceptos del palacio. Estás listo para el Modo Examen.',
        }
      }
      return {
        text: `Aris: ¡Excelente trabajo! Ya memorizaste todo en "${currentRoom.name}". Continúa hacia la siguiente sala por el pasillo.`,
      }
    }
  }

  // 3. INTENT_NEXT_PREREQUISITE / SIGUIENTE PASO
  if (q.includes('siguiente') || q.includes('sigue') || q.includes('después') || q.includes('despues') || q.includes('adonde') || q.includes('adónde') || q.includes('ruta') || q.includes('camino')) {
    const currentIndex = palace.rooms.findIndex((r) => r.id === currentRoom.id)
    if (currentIndex < palace.rooms.length - 1) {
      const nextRoom = palace.rooms[currentIndex + 1]
      return {
        text: `Aris: Tu siguiente destino es la Sala ${currentIndex + 2}: "${nextRoom.name}". Sigue el corredor conectado para continuar el recorrido.`,
      }
    } else {
      return {
        text: 'Aris: Has llegado a la última sala del palacio. Puedes repasar pedestales o activar el Modo Examen para poner a prueba tu memoria.',
      }
    }
  }

  // 4. INTENT_SHOW_ROOM_SUMMARY / RESUMEN DE SALA
  if (q.includes('resumen') || q.includes('trata') || q.includes('explica') || q.includes('aquí') || q.includes('aqui') || q.includes('tema')) {
    const totalInRoom = currentPieces.length
    const mastered = currentPieces.filter((p) => memorized[p.id]).length
    return {
      text: `Aris: Estamos en "${currentRoom.name}". Alberga ${totalInRoom} conceptos (llevas ${mastered} memorizados). ${currentRoom.description || 'Explora cada pedestal para dominar este tema.'}`,
    }
  }

  // 5. INTENT_EXAM_HINT / MODO EXAMEN
  if (q.includes('pista') || q.includes('ayuda') || q.includes('examen') || q.includes('recordar')) {
    if (mode === 'exam') {
      return {
        text: 'Aris: En Modo Examen los rótulos están ocultos. Si te atascas en un pedestal, usa el botón "Ver pista" para ver la primera letra y longitud.',
      }
    } else {
      return {
        text: 'Aris: Mi consejo: observa la forma 3D y el color del pedestal. Asociar visualmente el símbolo al concepto crea un ancla mnémica imborrable.',
      }
    }
  }

  // Fallback simpático con sugerencias
  return {
    text: 'Aris: No estoy seguro de entenderte. Prueba preguntarme: "¿Qué falta memorizar?", "¿Adónde voy ahora?", "¿De qué trata esta sala?" o "¿Dónde está la llave?".',
  }
}

// Síntesis de voz robótica nativa (0 KB de librerías)
export function speakAris(text: string) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return

  try {
    window.speechSynthesis.cancel() // Cancela cualquier locución previa
    // Limpiar el prefijo "Aris:" para la voz
    const cleanText = text.replace(/^Aris:\s*/i, '')
    const utterance = new SpeechSynthesisUtterance(cleanText)
    utterance.lang = 'es-ES'
    utterance.pitch = 1.35 // Tono ligeramente agudo para carácter de robot/mascota
    utterance.rate = 1.05
    window.speechSynthesis.speak(utterance)
  } catch {
    // Si el navegador bloquea el audio autoplay o falla TTS, no interrumpe el juego
  }
}
