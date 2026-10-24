// Contrato de tema visual. La escena 3D y la UI leen todo desde aquí:
// agregar un tema nuevo es escribir otro objeto `Theme`, sin tocar componentes.

/** Colores de una sala. Cada sala se pinta entera de un color pleno: es lo que la hace recordable. */
export type RoomPalette = {
  name: string // nombre del pigmento, se puede mostrar en la UI ("Rojo pompeyano")
  wall: string
  floor: string
  trim: string // cornisa y zócalo
  ink: string // texto legible sobre `wall` (contraste ≥ 4.5:1)
}

export type Theme = {
  id: string
  name: string

  /** Paletas de sala. El color de cada sala sale de hash(nombre de la sala): estable para el mismo tema. */
  rooms: RoomPalette[]

  scene: {
    background: string
    fog: { color: string; near: number; far: number }
    /** Material de pedestales, monumentos y objetos generados (yeso, piedra…). */
    object: { color: string; roughness: number }
    pedestal: { color: string; segments: number }
    corridor: { wall: string; floor: string }
    sun: { color: string; intensity: number; position: [number, number, number] }
    ambient: { sky: string; ground: string; intensity: number }
    shadows: boolean
    /** Detalles arquitectónicos que el tema dibuja en cada sala. */
    architecture: { cornice: boolean; plinth: boolean; wallThickness: number }
  }

  ui: {
    fonts: { display: string; body: string }
    /** Tokens CSS que se aplican en :root (sin el prefijo --). */
    tokens: Record<string, string>
  }
}
