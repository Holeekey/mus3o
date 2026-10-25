import type { Part } from '@mus3o/shared'
import { box, cyl, sphere, cone } from './partHelper'

/**
 * Modelos procedurales detallados para el palacio de Imperio Romano y Filosofía.
 */

export interface RomanPalette {
  marble: string
  gold: string
  bronze: string
  leather: string
  stone: string
  steel: string
}

const DEFAULT_ROMAN_PALETTE: RomanPalette = {
  marble: '#e8e2d6',
  gold: '#d97706',
  bronze: '#b45309',
  leather: '#991b1b',
  stone: '#57534e',
  steel: '#cbd5e1',
}

/** 1. Columna Corintia (Plinto de base, fuste acanalado y capitel con volutas de acanto) */
export function corinthianColumn(palette: Partial<RomanPalette> = {}): Part[] {
  const p = { ...DEFAULT_ROMAN_PALETTE, ...palette }
  return [
    // Plinto cuadrangular de la base
    box(1.1, 0.2, 1.1, [0, 0.1, 0], p.stone),
    // Moldura toro inferior de la base
    cyl(0.5, 0.5, 0.12, [0, 0.26, 0], p.marble, [0, 0, 0], 16),
    // Fuste monumental de la columna
    cyl(0.38, 0.42, 1.6, [0, 1.1, 0], p.marble, [0, 0, 0], 16),
    // Collarín inferior del capitel
    cyl(0.42, 0.38, 0.1, [0, 1.95, 0], p.gold, [0, 0, 0], 16),
    // Tambor de hojas de acanto del capitel
    cyl(0.55, 0.42, 0.35, [0, 2.15, 0], p.marble, [0, 0, 0], 12),
    // Ábaco cuadrangular superior de remate
    box(1.0, 0.15, 1.0, [0, 2.4, 0], p.marble),
  ]
}

/** 2. Rostra de los Oradores (Tribuna pública de oratoria con espolones navales de bronce) */
export function rostraSpeakers(palette: Partial<RomanPalette> = {}): Part[] {
  const p = { ...DEFAULT_ROMAN_PALETTE, ...palette }
  return [
    // Plataforma escalonada de piedra del Foro
    box(1.8, 0.4, 1.3, [0, 0.2, 0], p.stone),
    // Parapeto / baranda frontal de oratoria
    box(1.6, 0.5, 0.15, [0, 0.65, 0.55], p.marble),
    // Podio atril del orador central
    box(0.4, 0.7, 0.3, [0, 0.75, 0.2], p.stone),
    // Espolón naval de barco capturado 1 (rostrum de bronce izquierdo)
    cone(0.2, 0.65, [-0.6, 0.28, 0.8], p.bronze, [-Math.PI / 2, 0, 0]),
    // Espolón naval de barco capturado 2 (rostrum de bronce derecho)
    cone(0.2, 0.65, [0.6, 0.28, 0.8], p.bronze, [-Math.PI / 2, 0, 0]),
    // Corona de orador
    sphere(0.12, [0, 1.15, 0.2], p.gold),
  ]
}

/** 3. Derecho Romano / Ius Civile (Tablas de bronce de la ley y rollo con sello imperial) */
export function romanLaw(palette: Partial<RomanPalette> = {}): Part[] {
  const p = { ...DEFAULT_ROMAN_PALETTE, ...palette }
  return [
    // Tabla I de la Ley de las Doce Tablas (bronce tallado)
    box(0.65, 1.0, 0.08, [-0.38, 0.55, 0], p.bronze, [0, 0.15, 0]),
    // Tabla II de la Ley de las Doce Tablas
    box(0.65, 1.0, 0.08, [0.38, 0.55, 0], p.bronze, [0, -0.15, 0]),
    // Rollo de papiro con jurisprudencia
    cyl(0.08, 0.08, 1.1, [0, 0.12, 0.35], p.marble, [0, 0, Math.PI / 2]),
    // Sello imperial de cera púrpura/roja
    cyl(0.12, 0.12, 0.04, [0, 0.12, 0.38], p.leather, [Math.PI / 2, 0, 0]),
    // Cinta de atadura del rollo
    box(0.08, 0.1, 0.2, [0, 0.12, 0.35], p.gold),
    // Base de apoyo en mármol
    box(1.6, 0.1, 0.8, [0, 0.05, 0.1], p.stone),
  ]
}

/** 4. Curia Iulia (Fachada del Senado Romano con frontón triangular y puertas de bronce) */
export function curiaIulia(palette: Partial<RomanPalette> = {}): Part[] {
  const p = { ...DEFAULT_ROMAN_PALETTE, ...palette }
  return [
    // Podio de escalinata de acceso
    box(1.8, 0.15, 1.2, [0, 0.08, 0], p.stone),
    // Fachada de opus latericium / ladrillo romano
    box(1.6, 1.4, 0.9, [0, 0.85, 0], '#9a3412'),
    // Puertas gemelas monumentales de bronce
    box(0.65, 0.9, 0.05, [0, 0.6, 0.46], p.bronze),
    // Moldura del dintel de mármol
    box(0.85, 0.1, 0.1, [0, 1.1, 0.46], p.marble),
    // Frontón triangular del techo
    cone(0.9, 0.6, [0, 1.85, 0], p.marble, [0, 0, 0], 4),
  ]
}

/** 5. Fasces Consulares (Haz de varas de abedul atadas con correas de cuero y hacha) */
export function fasces(palette: Partial<RomanPalette> = {}): Part[] {
  const p = { ...DEFAULT_ROMAN_PALETTE, ...palette }
  const parts: Part[] = []

  // Haz de varas (cilindros perimetrales y central)
  const count = 6
  for (let i = 0; i < count; i++) {
    const angle = (i * Math.PI * 2) / count
    const x = Math.cos(angle) * 0.2
    const z = Math.sin(angle) * 0.2
    parts.push(cyl(0.04, 0.04, 1.7, [x, 0.85, z], '#a16207'))
  }
  // Vara central
  parts.push(cyl(0.04, 0.04, 1.7, [0, 0.85, 0], '#a16207'))

  // Correas de cuero rojo que atan el haz
  parts.push(cyl(0.26, 0.26, 0.08, [0, 0.35, 0], p.leather))
  parts.push(cyl(0.26, 0.26, 0.08, [0, 0.85, 0], p.leather))
  parts.push(cyl(0.26, 0.26, 0.08, [0, 1.35, 0], p.leather))

  // Cuchilla del hacha lictoria que sobresale del haz
  parts.push(box(0.5, 0.35, 0.05, [0.38, 1.25, 0], p.steel))

  return parts
}

/** 6. Meditaciones de Marco Aurelio (Códice estoico encuadernado, tintero y pluma) */
export function meditationsAurelius(palette: Partial<RomanPalette> = {}): Part[] {
  const p = { ...DEFAULT_ROMAN_PALETTE, ...palette }
  return [
    // Base de mesa de lectura
    box(1.4, 0.1, 0.9, [0, 0.05, 0], p.stone),
    // Códice encuadernado en cuero
    box(0.9, 0.16, 0.7, [-0.1, 0.16, 0], '#451a03'),
    // Hojas de pergamino interiores
    box(0.84, 0.12, 0.66, [-0.08, 0.16, 0], p.marble),
    // Tintero romano de bronce
    cyl(0.12, 0.14, 0.22, [0.45, 0.2, -0.2], p.bronze),
    // Cálamo / pluma de escritura
    cyl(0.02, 0.02, 0.5, [0.42, 0.35, -0.15], p.gold, [-0.3, 0, 0.2]),
    // Rama de laurel de la victoria estoica
    cyl(0.03, 0.03, 0.7, [-0.1, 0.26, 0.2], '#15803d', [0, 0, Math.PI / 3]),
  ]
}

/** 7. Scutum Legionario (Escudo curvo de la legión romana con umbo de bronce y alas) */
export function romanScutum(palette: Partial<RomanPalette> = {}): Part[] {
  const p = { ...DEFAULT_ROMAN_PALETTE, ...palette }
  return [
    // Cuerpo curvado principal del escudo (madera laminada contrachapada roja)
    cyl(0.65, 0.65, 1.4, [0, 0.75, 0], p.leather, [0, 0, 0], 16),
    // Umbo central de bronce semiesférico
    sphere(0.18, [0, 0.75, 0.66], p.gold),
    // Placa de refuerzo del umbo
    box(0.4, 0.4, 0.04, [0, 0.75, 0.64], p.bronze),
    // Ribete de latón del borde superior
    box(0.9, 0.05, 0.1, [0, 1.45, 0.3], p.gold),
    // Ribete de latón del borde inferior
    box(0.9, 0.05, 0.1, [0, 0.05, 0.3], p.gold),
    // Insignia imperial de alas y rayos de Júpiter
    box(0.6, 0.08, 0.04, [0, 1.05, 0.64], p.gold),
    box(0.6, 0.08, 0.04, [0, 0.45, 0.64], p.gold),
  ]
}

/** 8. Gladius Hispaniensis (Espada de infantería romana con hoja recta, guarda y pomo) */
export function gladiusHispaniensis(palette: Partial<RomanPalette> = {}): Part[] {
  const p = { ...DEFAULT_ROMAN_PALETTE, ...palette }
  return [
    // Hoja recta de acero con doble filo
    box(0.18, 1.1, 0.04, [0, 0.85, 0], p.steel),
    // Punta cónica penetrante de la espada
    cone(0.12, 0.3, [0, 1.5, 0], p.steel),
    // Guarda ovalada de madera dura
    cyl(0.24, 0.24, 0.08, [0, 0.3, 0], '#78350f', [0, 0, 0], 12),
    // Empuñadura acanalada de hueso / madera
    cyl(0.06, 0.06, 0.3, [0, 0.15, 0], p.marble, [0, 0, 0], 8),
    // Pomo esférico de contrapeso
    sphere(0.11, [0, -0.05, 0], '#78350f'),
  ]
}

/** 9. Calzadas y Vía Apia (Capa de piedras basálticas poligonales, bordillo y miliario) */
export function viaAppia(palette: Partial<RomanPalette> = {}): Part[] {
  const p = { ...DEFAULT_ROMAN_PALETTE, ...palette }
  return [
    // Lecho de cimentación de grava (statumen / rudus)
    box(1.8, 0.1, 1.4, [0, 0.05, 0], '#292524'),
    // Pavimento de grandes losas basálticas poligonales (summum dorsum)
    box(1.6, 0.1, 1.2, [0, 0.15, 0], p.stone),
    // Bordillo lateral elevado izquierdo (crepido)
    box(0.12, 0.22, 1.4, [-0.85, 0.15, 0], p.marble),
    // Bordillo lateral elevado derecho (crepido)
    box(0.12, 0.22, 1.4, [0.85, 0.15, 0], p.marble),
    // Columna miliario romano indicador de millas
    cyl(0.18, 0.2, 0.9, [-0.6, 0.65, -0.3], p.marble),
    // Cabeza redondeada del miliario
    sphere(0.18, [-0.6, 1.1, -0.3], p.marble),
  ]
}
