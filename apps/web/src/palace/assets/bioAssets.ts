import type { Part } from '@mus3o/shared'
import { box, cyl, sphere, cone } from './partHelper'

/**
 * Modelos procedurales detallados para el palacio de Biología Celular.
 */

export interface BioPalette {
  primary: string
  accent: string
  membrane: string
  nucleic: string
  protein: string
}

const DEFAULT_BIO_PALETTE: BioPalette = {
  primary: '#10b981',
  accent: '#f59e0b',
  membrane: '#ec4899',
  nucleic: '#3b82f6',
  protein: '#8b5cf6',
}

/** 1. Bicapa Fosfolipídica (Cabezas polares hidrófilas y colas apolares) */
export function phospholipidBilayer(palette: Partial<BioPalette> = {}): Part[] {
  const p = { ...DEFAULT_BIO_PALETTE, ...palette }
  const parts: Part[] = []

  // Capa exterior de cabezas de fosfato (6 esferas superiores)
  const xs = [-1.0, -0.6, -0.2, 0.2, 0.6, 1.0]
  for (const x of xs) {
    parts.push(sphere(0.16, [x, 0.8, 0], p.membrane))
    // Colas de ácidos grasos superiores
    parts.push(cyl(0.03, 0.03, 0.35, [x - 0.05, 0.52, 0], '#fb7185'))
    parts.push(cyl(0.03, 0.03, 0.35, [x + 0.05, 0.52, 0], '#fb7185'))
  }

  // Capa interior de cabezas de fosfato (6 esferas inferiores)
  for (const x of xs) {
    parts.push(sphere(0.16, [x, 0.16, 0], p.membrane))
    // Colas de ácidos grasos inferiores
    parts.push(cyl(0.03, 0.03, 0.35, [x - 0.05, 0.44, 0], '#fb7185'))
    parts.push(cyl(0.03, 0.03, 0.35, [x + 0.05, 0.44, 0], '#fb7185'))
  }

  // Molécula de colesterol intercalada estabilizadora
  parts.push(box(0.12, 0.45, 0.12, [0, 0.48, 0.12], p.accent))

  return parts
}

/** 2. Proteínas de Canal (Poro transmembrana cilíndrico formado por hélices alfa) */
export function proteinChannel(palette: Partial<BioPalette> = {}): Part[] {
  const p = { ...DEFAULT_BIO_PALETTE, ...palette }
  return [
    // Subunidad proteica alfa-hélice 1
    cyl(0.22, 0.22, 1.3, [-0.45, 0.65, 0], p.protein),
    // Subunidad proteica alfa-hélice 2
    cyl(0.22, 0.22, 1.3, [0.45, 0.65, 0], p.protein),
    // Subunidad proteica alfa-hélice 3 (posterior)
    cyl(0.22, 0.22, 1.3, [0, 0.65, -0.45], p.protein),
    // Subunidad proteica alfa-hélice 4 (anterior)
    cyl(0.22, 0.22, 1.3, [0, 0.65, 0.45], p.protein),
    // Filtro de selectividad iónica interior del poro
    cyl(0.2, 0.2, 0.2, [0, 0.65, 0], p.accent),
    // Ión en tránsito atravesando el canal
    sphere(0.12, [0, 0.95, 0], p.primary),
    // Membrana soporte circundante
    box(1.8, 0.2, 0.6, [0, 0.65, 0], p.membrane),
  ]
}

/** 3. Bomba Sodio-Potasio (Proteína transportadora con bolsillo ATP e iones) */
export function sodiumPotassiumPump(palette: Partial<BioPalette> = {}): Part[] {
  const p = { ...DEFAULT_BIO_PALETTE, ...palette }
  return [
    // Subunidad alfa catalítica (lóbulo izquierdo)
    cyl(0.35, 0.35, 1.1, [-0.3, 0.6, 0], p.protein),
    // Subunidad alfa catalítica (lóbulo derecho)
    cyl(0.35, 0.35, 1.1, [0.3, 0.6, 0], p.protein),
    // Sitio de unión a ATP intracelular
    box(0.4, 0.25, 0.35, [0, 0.15, 0.2], p.accent),
    // Molécula de ATP unida
    sphere(0.14, [0, 0.15, 0.38], '#fbbf24'),
    // 3 Iones de Sodio (Na+)
    sphere(0.09, [-0.2, 0.7, 0.15], '#38bdf8'),
    sphere(0.09, [0, 0.75, 0.15], '#38bdf8'),
    sphere(0.09, [0.2, 0.7, 0.15], '#38bdf8'),
    // 2 Iones de Potasio (K+)
    sphere(0.11, [-0.15, 0.85, -0.15], '#f43f5e'),
    sphere(0.11, [0.15, 0.85, -0.15], '#f43f5e'),
  ]
}

/** 4. ATP Sintasa (Complejo rotatorio con F0 membrana, estátor y cabeza catalítica F1) */
export function atpSynthase(palette: Partial<BioPalette> = {}): Part[] {
  const p = { ...DEFAULT_BIO_PALETTE, ...palette }
  return [
    // Anillo rotor F0 inserto en la membrana
    cyl(0.5, 0.5, 0.35, [0, 0.2, 0], p.protein, [0, 0, 0], 16),
    // Eje central rotatorio (subunidad gamma)
    cyl(0.12, 0.12, 0.75, [0, 0.65, 0], p.accent),
    // Brazo estátor lateral fijo
    cyl(0.08, 0.08, 1.2, [0.48, 0.65, 0], p.membrane),
    // Cabeza catalítica hexamérica F1
    cyl(0.55, 0.45, 0.55, [0, 1.1, 0], p.protein, [0, 0, 0], 6),
    // Molécula de ADP + Pi entrando
    sphere(0.12, [-0.45, 1.1, 0.2], '#38bdf8'),
    // Molécula de ATP sintetizada saliendo
    sphere(0.15, [0.45, 1.25, 0.2], '#fbbf24'),
    // Flujo de protones H+ motriz
    sphere(0.06, [0, 0.05, 0.3], '#00ffcc'),
  ]
}

/** 5. Ciclo de Krebs (Anillo metabólico con intermediarios de citrato y descarboxilaciones) */
export function krebsCycle(palette: Partial<BioPalette> = {}): Part[] {
  const p = { ...DEFAULT_BIO_PALETTE, ...palette }
  return [
    // Anillo metabólico circular
    cyl(0.8, 0.8, 0.08, [0, 0.5, 0], p.primary, [Math.PI / 2, 0, 0], 24),
    // Núcleo central de la matriz
    sphere(0.22, [0, 0.5, 0], '#047857'),
    // 6 Intermediarios clave en el anillo (Citrato, Isocitrato, alfa-Cetoglutarato, Succinato, Malato, Oxalacetato)
    sphere(0.14, [0, 1.3, 0], p.accent),
    sphere(0.14, [0.7, 0.9, 0], p.protein),
    sphere(0.14, [0.7, 0.1, 0], p.accent),
    sphere(0.14, [0, -0.3, 0], p.protein),
    sphere(0.14, [-0.7, 0.1, 0], p.accent),
    sphere(0.14, [-0.7, 0.9, 0], p.protein),
    // Liberación de CO2
    sphere(0.09, [0.95, 0.5, 0], '#94a3b8'),
    // Producción energética de NADH
    sphere(0.12, [-0.95, 0.5, 0], '#38bdf8'),
  ]
}

/** 6. Crestas Mitocondriales (Pliegues de membrana interna con espacio intermembrana) */
export function cristaeMitochondria(palette: Partial<BioPalette> = {}): Part[] {
  const p = { ...DEFAULT_BIO_PALETTE, ...palette }
  return [
    // Membrana mitocondrial externa lisa
    cyl(0.75, 0.75, 1.6, [0, 0.8, 0], '#047857', [0, 0, 0], 16),
    // Pliegue interno de cresta 1 (lámina transversal)
    box(0.9, 0.12, 0.6, [0.15, 0.45, 0], p.primary),
    // Pliegue interno de cresta 2 (lámina transversal opuesta)
    box(0.9, 0.12, 0.6, [-0.15, 0.8, 0], p.primary),
    // Pliegue interno de cresta 3
    box(0.9, 0.12, 0.6, [0.15, 1.15, 0], p.primary),
    // Complejos de la cadena de transporte de electrones en las crestas
    sphere(0.08, [0.4, 0.55, 0.2], p.accent),
    sphere(0.08, [-0.4, 0.9, 0.2], p.accent),
    sphere(0.08, [0.4, 1.25, 0.2], p.accent),
  ]
}

/** 7. Doble Hélice de ADN (Hebra bicatenaria en espiral con peldaños de pares de bases) */
export function dnaDoubleHelix(palette: Partial<BioPalette> = {}): Part[] {
  const p = { ...DEFAULT_BIO_PALETTE, ...palette }
  const parts: Part[] = []

  // Esqueleto azúcar-fosfato y pares de bases peldaño a peldaño
  const steps = 7
  for (let i = 0; i < steps; i++) {
    const y = 0.2 + i * 0.22
    const angle = i * 0.55
    const r = 0.5
    const x1 = Math.cos(angle) * r
    const z1 = Math.sin(angle) * r
    const x2 = -x1
    const z2 = -z1

    // Esfera hebra 1
    parts.push(sphere(0.1, [x1, y, z1], p.nucleic))
    // Esfera hebra 2
    parts.push(sphere(0.1, [x2, y, z2], p.nucleic))
    // Peldaño conector de bases nitrogenadas (A-T o G-C)
    const baseColor = i % 2 === 0 ? p.primary : p.accent
    parts.push(box(0.8, 0.06, 0.06, [0, y, 0], baseColor, [0, -angle, 0]))
  }

  return parts
}

/** 8. ARN Mensajero y Transcripción (Burbuja de transcripción con ARN Polimerasa) */
export function mrnaTranscription(palette: Partial<BioPalette> = {}): Part[] {
  const p = { ...DEFAULT_BIO_PALETTE, ...palette }
  return [
    // Complejo enzimático ARN Polimerasa
    sphere(0.55, [0, 0.7, 0], p.protein),
    // Hebra molde de ADN ingresando
    cyl(0.05, 0.05, 1.6, [-0.6, 0.7, 0], p.nucleic, [0, 0, Math.PI / 2]),
    // Hebra no molde de ADN saliendo
    cyl(0.05, 0.05, 1.6, [-0.6, 0.9, 0], p.nucleic, [0, 0, Math.PI / 2]),
    // Hebra recién sintetizada de ARNm monocatenario
    cyl(0.04, 0.04, 1.1, [0.35, 0.55, 0.3], p.accent, [0.4, 0.4, 0]),
    // Nucleótidos entrantes de ARN
    sphere(0.08, [0, 1.25, 0.2], p.accent),
    sphere(0.08, [-0.15, 1.15, 0.2], p.primary),
  ]
}

/** 9. Ribosomas y Traducción (Subunidad mayor y menor ensambladas sobre el ARNm con péptido) */
export function ribosomeTranslation(palette: Partial<BioPalette> = {}): Part[] {
  const p = { ...DEFAULT_BIO_PALETTE, ...palette }
  return [
    // Subunidad ribosomal menor (30S/40S base)
    cyl(0.45, 0.4, 0.35, [0, 0.25, 0], p.protein),
    // Hendidura de paso de la cinta de ARNm
    box(1.5, 0.04, 0.12, [0, 0.46, 0], p.accent),
    // Subunidad ribosomal mayor (50S/60S superior)
    sphere(0.65, [0, 0.95, 0], p.protein),
    // Molécula adaptadora de ARNt en el sitio P
    box(0.12, 0.3, 0.12, [0, 0.7, 0.2], p.nucleic),
    // Cadena polipeptídica naciente de aminoácidos (cadena de perlas)
    sphere(0.09, [0, 1.45, 0], p.primary),
    sphere(0.09, [0.1, 1.6, 0], p.primary),
    sphere(0.09, [0.05, 1.75, 0], p.accent),
  ]
}
