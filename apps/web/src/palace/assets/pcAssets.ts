import type { Part } from '@mus3o/shared'
import { box, cyl, sphere, cone } from './partHelper'

/**
 * Biblioteca modular de componentes y periféricos de PC procedurales.
 * Construye modelos 3D detallados a partir de partes ortogonales, cilíndricas y esféricas
 * totalmente conformes con PartSchema.
 */

export interface PcPalette {
  pcb: string
  accent: string
  gold: string
  chip: string
  metal: string
  led: string
}

const DEFAULT_PC_PALETTE: PcPalette = {
  pcb: '#064e3b',
  accent: '#00ffcc',
  gold: '#ffd700',
  chip: '#18181b',
  metal: '#475569',
  led: '#38bdf8',
}

/** 1. Módulo de Memoria RAM (DIMM DDR con disipador, muesca y pines dorados) */
export function ramStick(palette: Partial<PcPalette> = {}): Part[] {
  const p = { ...DEFAULT_PC_PALETTE, ...palette }
  return [
    // PCB base verde/oscuro
    box(2.4, 0.65, 0.05, [0, 0.32, 0], p.pcb),
    // Pines de contacto dorados en el borde inferior
    box(2.2, 0.08, 0.06, [0, 0.04, 0], p.gold),
    // Muesca de centrado (key notch)
    box(0.08, 0.14, 0.08, [0.1, 0.05, 0], '#09090b'),
    // Chips de memoria DRAM BGA (4 módulos frontales)
    box(0.32, 0.32, 0.07, [-0.8, 0.35, 0.03], p.chip),
    box(0.32, 0.32, 0.07, [-0.3, 0.35, 0.03], p.chip),
    box(0.32, 0.32, 0.07, [0.3, 0.35, 0.03], p.chip),
    box(0.32, 0.32, 0.07, [0.8, 0.35, 0.03], p.chip),
    // Chip SPD EEPROM
    box(0.12, 0.12, 0.06, [-1.02, 0.35, 0.03], p.chip),
    // Disipador de calor superior anodizado (heat spreader)
    box(2.35, 0.22, 0.08, [0, 0.54, 0], p.accent),
    // Aleta / ranura de ventilación superior
    box(2.1, 0.04, 0.1, [0, 0.64, 0], p.metal),
    // Muescas laterales de fijación al slot
    box(0.06, 0.12, 0.06, [-1.2, 0.35, 0], '#09090b'),
    box(0.06, 0.12, 0.06, [1.2, 0.35, 0], '#09090b'),
  ]
}

/** 2. Unidad Aritmético-Lógica (ALU con die central, buses de datos y flags) */
export function aluChip(palette: Partial<PcPalette> = {}): Part[] {
  const p = { ...DEFAULT_PC_PALETTE, ...palette }
  return [
    // Sustrato cerámico / PCB del procesador
    box(1.7, 0.08, 1.7, [0, 0.04, 0], p.pcb),
    // Matriz de pines de conexión perimetrales dorados
    box(1.8, 0.04, 1.8, [0, 0.01, 0], p.gold),
    // Difusor de calor metálico del die (IHS)
    box(1.1, 0.12, 1.1, [0, 0.12, 0], p.metal),
    // Núcleo aritmético central serigrafiado
    box(0.65, 0.04, 0.65, [0, 0.19, 0], p.accent),
    // Bus A de operandos (entrada izquierda)
    box(0.4, 0.05, 0.12, [-0.65, 0.11, -0.2], p.gold),
    box(0.4, 0.05, 0.12, [-0.65, 0.11, 0.2], p.gold),
    // Bus B de operandos (entrada derecha)
    box(0.4, 0.05, 0.12, [0.65, 0.11, -0.2], p.gold),
    box(0.4, 0.05, 0.12, [0.65, 0.11, 0.2], p.gold),
    // Bus de salida de Resultados (frontal)
    box(0.5, 0.05, 0.35, [0, 0.11, 0.68], p.accent),
    // Indicadores LED de Flags (Zero, Carry, Negative, Overflow)
    sphere(0.05, [-0.25, 0.22, -0.4], '#10b981'),
    sphere(0.05, [-0.08, 0.22, -0.4], '#fbbf24'),
    sphere(0.05, [0.08, 0.22, -0.4], '#ef4444'),
    sphere(0.05, [0.25, 0.22, -0.4], p.led),
  ]
}

/** 3. Unidad de Control (UC / Decodificador con cristal de cuarzo y microcódigo) */
export function controlUnit(palette: Partial<PcPalette> = {}): Part[] {
  const p = { ...DEFAULT_PC_PALETTE, ...palette }
  return [
    // Base de la placa de control
    box(1.6, 0.08, 1.6, [0, 0.04, 0], '#0f172a'),
    // Chip decodificador de instrucciones
    box(0.85, 0.14, 0.85, [0, 0.13, 0], p.chip),
    // Núcleo decodificador
    box(0.5, 0.04, 0.5, [0, 0.21, 0], p.accent),
    // Oscilador de sincronismo de fases
    cyl(0.09, 0.09, 0.45, [0.55, 0.14, -0.45], p.metal, [0, 0, Math.PI / 2]),
    // Módulo ROM de microcódigo
    box(0.35, 0.1, 0.55, [-0.52, 0.12, -0.25], p.chip),
    // Líneas de bus de microórdenes (4 ramales luminosos)
    box(0.08, 0.03, 0.6, [-0.5, 0.09, 0.4], '#3b82f6'),
    box(0.08, 0.03, 0.6, [-0.2, 0.09, 0.4], p.accent),
    box(0.08, 0.03, 0.6, [0.2, 0.09, 0.4], '#f59e0b'),
    box(0.08, 0.03, 0.6, [0.5, 0.09, 0.4], '#10b981'),
    // Sensores de estado del ciclo de instrucción (Fetch / Decode / Exec)
    sphere(0.06, [-0.3, 0.19, 0], '#00ffcc'),
    sphere(0.06, [0, 0.19, 0.3], '#38bdf8'),
    sphere(0.06, [0.3, 0.19, 0], '#818cf8'),
  ]
}

/** 4. Banco de Registros de Trabajo (AX, BX, PC, SP con flip-flops y bus) */
export function registerFile(palette: Partial<PcPalette> = {}): Part[] {
  const p = { ...DEFAULT_PC_PALETTE, ...palette }
  return [
    // Chasis / backplane del banco de registros
    box(1.9, 0.12, 0.8, [0, 0.06, 0], '#18181b'),
    // 4 Celdas de registros (PC, IR, AX, BX)
    box(0.34, 0.48, 0.42, [-0.65, 0.32, 0], '#1e3a8a'),
    box(0.34, 0.48, 0.42, [-0.22, 0.32, 0], '#1e3a8a'),
    box(0.34, 0.48, 0.42, [0.22, 0.32, 0], '#1e3a8a'),
    box(0.34, 0.48, 0.42, [0.65, 0.32, 0], '#1e3a8a'),
    // Displays de estado binario sobre cada registro
    box(0.26, 0.06, 0.12, [-0.65, 0.58, 0], p.accent),
    box(0.26, 0.06, 0.12, [-0.22, 0.58, 0], p.led),
    box(0.26, 0.06, 0.12, [0.22, 0.58, 0], '#3b82f6'),
    box(0.26, 0.06, 0.12, [0.65, 0.58, 0], '#10b981'),
    // Riel del multiplexor de lectura/escritura frontal
    box(1.7, 0.06, 0.08, [0, 0.15, 0.28], p.gold),
    // Línea de señal de reloj compartida posterior
    cyl(0.03, 0.03, 1.7, [0, 0.15, -0.28], p.metal, [0, 0, Math.PI / 2]),
  ]
}

/** 5. Reloj del Sistema (Oscilador de cuarzo encapsulado en metal con aura de pulso) */
export function systemClock(palette: Partial<PcPalette> = {}): Part[] {
  const p = { ...DEFAULT_PC_PALETTE, ...palette }
  return [
    // Base de montaje del cristal
    box(0.9, 0.08, 0.9, [0, 0.04, 0], '#1e293b'),
    // Cuerpo metálico del cristal de cuarzo
    cyl(0.35, 0.35, 0.75, [0, 0.45, 0], p.metal),
    // Domo superior metálico
    sphere(0.35, [0, 0.82, 0], '#94a3b8'),
    // Banda resonadora central
    cyl(0.38, 0.38, 0.08, [0, 0.45, 0], p.gold),
    // Anillo exterior de emisión de pulsos
    cyl(0.55, 0.55, 0.04, [0, 0.45, 0], p.accent),
    // 2 Pines de soldadura dorados inferiores
    cyl(0.03, 0.03, 0.25, [-0.22, -0.06, 0], p.gold),
    cyl(0.03, 0.03, 0.25, [0.22, -0.06, 0], p.gold),
    // Nodo central de alta frecuencia
    sphere(0.08, [0, 0.45, 0], p.led),
  ]
}

/** 6. Caché L1 (Matriz SRAM ultra veloz con array de etiquetas y hit/miss) */
export function cacheL1(palette: Partial<PcPalette> = {}): Part[] {
  const p = { ...DEFAULT_PC_PALETTE, ...palette }
  return [
    // Bloque maestro de celdas SRAM estáticas
    box(1.4, 0.25, 1.3, [0, 0.12, 0], '#0369a1'),
    // Unidad comparadora de etiquetas (Tag Directory)
    box(0.45, 0.32, 1.1, [-0.42, 0.16, 0], '#0284c7'),
    // Banco de datos L1 Data Cache
    box(0.55, 0.28, 0.5, [0.32, 0.16, -0.28], '#38bdf8'),
    // Banco de instrucciones L1 Instruction Cache
    box(0.55, 0.28, 0.5, [0.32, 0.16, 0.28], p.accent),
    // Indicador Cache Hit (Verde esmeralda)
    sphere(0.07, [-0.42, 0.35, -0.25], '#10b981'),
    // Indicador Cache Miss (Rojo rubí)
    sphere(0.07, [-0.42, 0.35, 0.25], '#ef4444'),
    // Puente dorado de interconexión con el núcleo
    box(1.2, 0.04, 0.12, [0, 0.26, 0.52], p.gold),
  ]
}

/** 7. Almacenamiento NVMe (Unidad M.2 2280 con conector PCIe, controlador y NAND) */
export function nvmeSsd(palette: Partial<PcPalette> = {}): Part[] {
  const p = { ...DEFAULT_PC_PALETTE, ...palette }
  return [
    // PCB formato M.2 2280
    box(0.75, 0.05, 2.2, [0, 0.02, 0], p.pcb),
    // Conector dorado PCIe notch M-Key
    box(0.62, 0.06, 0.24, [0, 0.03, -0.98], p.gold),
    // Controlador Flash con heatspreader de grafeno
    box(0.48, 0.1, 0.48, [0, 0.09, -0.4], '#27272a'),
    // Chip de DRAM Caché
    box(0.28, 0.08, 0.28, [0, 0.08, 0.02], p.chip),
    // 2 Módulos 3D NAND Flash apilados
    box(0.55, 0.1, 0.55, [0, 0.09, 0.48], p.chip),
    box(0.55, 0.1, 0.55, [0, 0.09, 1.1], p.chip),
    // Muesca de tornillo semicircular de anclaje a la placa
    box(0.14, 0.06, 0.1, [0, 0.02, 1.12], p.metal),
    // LED de actividad de lectura/escritura
    sphere(0.04, [-0.22, 0.08, -0.4], p.accent),
  ]
}

/** 8. Bus de Datos (Autopista paralela de bits con conectores y pulsos) */
export function dataBus(palette: Partial<PcPalette> = {}): Part[] {
  const p = { ...DEFAULT_PC_PALETTE, ...palette }
  return [
    // Cinta bus plana conductora
    box(1.8, 0.04, 0.8, [0, 0.02, 0], '#1e293b'),
    // Conector terminal izquierdo
    box(0.18, 0.24, 0.86, [-0.85, 0.12, 0], '#0f172a'),
    // Conector terminal derecho
    box(0.18, 0.24, 0.86, [0.85, 0.12, 0], '#0f172a'),
    // 8 Pistas paralelas de transporte de datos
    box(1.6, 0.05, 0.05, [0, 0.05, -0.32], p.accent),
    box(1.6, 0.05, 0.05, [0, 0.05, -0.22], p.led),
    box(1.6, 0.05, 0.05, [0, 0.05, -0.12], p.accent),
    box(1.6, 0.05, 0.05, [0, 0.05, -0.02], p.led),
    box(1.6, 0.05, 0.05, [0, 0.05, 0.08], p.accent),
    box(1.6, 0.05, 0.05, [0, 0.05, 0.18], p.led),
    box(1.6, 0.05, 0.05, [0, 0.05, 0.28], p.accent),
    // Paquetes de datos viajando (fotones de transmisión)
    sphere(0.05, [-0.3, 0.08, -0.22], p.gold),
    sphere(0.05, [0.2, 0.08, 0.08], p.gold),
  ]
}

/** 9. Bus de Direcciones (Backbone de direccionamiento de memoria y decodificador) */
export function addressBus(palette: Partial<PcPalette> = {}): Part[] {
  const p = { ...DEFAULT_PC_PALETTE, ...palette }
  return [
    // Troncal del bus de direcciones
    box(1.7, 0.06, 0.9, [0, 0.03, 0], '#0f172a'),
    // Decodificador de direcciones de memoria A
    box(0.32, 0.12, 0.6, [-0.45, 0.1, 0], '#1e3a8a'),
    // Decodificador de direcciones de memoria B
    box(0.32, 0.12, 0.6, [0.45, 0.1, 0], '#1e3a8a'),
    // Pistas doradas maestras de direccionamiento
    box(1.5, 0.04, 0.06, [0, 0.07, -0.25], p.gold),
    box(1.5, 0.04, 0.06, [0, 0.07, 0], p.gold),
    box(1.5, 0.04, 0.06, [0, 0.07, 0.25], p.gold),
    // Nodos de selección de banco de memoria
    sphere(0.06, [-0.45, 0.18, -0.2], '#fbbf24'),
    sphere(0.06, [-0.45, 0.18, 0.2], '#fbbf24'),
    sphere(0.06, [0.45, 0.18, -0.2], '#fbbf24'),
    sphere(0.06, [0.45, 0.18, 0.2], '#fbbf24'),
    // Conector de cabecera
    box(0.14, 0.2, 0.8, [0.8, 0.12, 0], p.metal),
  ]
}

/** 10. Bus de Control (Líneas de control READ, WRITE, INTERRUPT y CLOCK) */
export function controlBus(palette: Partial<PcPalette> = {}): Part[] {
  const p = { ...DEFAULT_PC_PALETTE, ...palette }
  return [
    // Placa base de líneas de control
    box(1.6, 0.06, 1.1, [0, 0.03, 0], '#18181b'),
    // Línea READ (Verde lectura)
    box(1.3, 0.05, 0.08, [0, 0.06, -0.36], '#10b981'),
    // Línea WRITE (Rojo escritura)
    box(1.3, 0.05, 0.08, [0, 0.06, -0.12], '#ef4444'),
    // Línea INTERRUPT (Ámbar interrupción)
    box(1.3, 0.05, 0.08, [0, 0.06, 0.12], '#f59e0b'),
    // Línea CLOCK (Azul pulso reloj)
    box(1.3, 0.05, 0.08, [0, 0.06, 0.36], '#3b82f6'),
    // Compuertas buffer/driver lógicas intermedias
    box(0.2, 0.12, 0.9, [0, 0.1, 0], p.chip),
    // Nodos terminales de estroboscopio
    sphere(0.06, [0.65, 0.09, -0.36], '#10b981'),
    sphere(0.06, [0.65, 0.09, -0.12], '#ef4444'),
    sphere(0.06, [0.65, 0.09, 0.12], '#f59e0b'),
    sphere(0.06, [0.65, 0.09, 0.36], '#3b82f6'),
  ]
}

/** 11. Torre / Gabinete de PC (Chasis de escritorio con panel frontal, cristal y RGB) */
export function pcTower(palette: Partial<PcPalette> = {}): Part[] {
  const p = { ...DEFAULT_PC_PALETTE, ...palette }
  return [
    // Chasis principal de la torre
    box(0.8, 1.8, 1.4, [0, 0.9, 0], '#18181b'),
    // Bisel frontal
    box(0.82, 1.78, 0.1, [0, 0.9, 0.72], '#27272a'),
    // Rejilla frontal de ventilación / mesh
    box(0.6, 1.1, 0.12, [0, 0.7, 0.74], '#09090b'),
    // Tira de iluminación ARGB frontal
    box(0.03, 1.4, 0.12, [0.34, 0.9, 0.75], p.accent),
    // Botón de encendido frontal
    cyl(0.05, 0.05, 0.03, [-0.25, 1.62, 0.76], p.led, [Math.PI / 2, 0, 0]),
    // Panel lateral de vidrio templado
    box(0.03, 1.4, 1.1, [0.41, 0.9, 0], '#0284c7'),
    // Malla de ventilación superior
    box(0.6, 0.04, 1.0, [0, 1.81, 0], '#09090b'),
    // 4 Patas de goma antivibración
    cyl(0.06, 0.06, 0.06, [-0.32, 0.03, -0.55], '#000000'),
    cyl(0.06, 0.06, 0.06, [0.32, 0.03, -0.55], '#000000'),
    cyl(0.06, 0.06, 0.06, [-0.32, 0.03, 0.55], '#000000'),
    cyl(0.06, 0.06, 0.06, [0.32, 0.03, 0.55], '#000000'),
  ]
}

/** 12. Teclado Mecánico de PC (Con teclas escalonadas, barra espaciadora y cable) */
export function keyboard(palette: Partial<PcPalette> = {}): Part[] {
  const p = { ...DEFAULT_PC_PALETTE, ...palette }
  return [
    // Chasis base angulado
    box(1.8, 0.1, 0.7, [0, 0.05, 0], '#1f2937', [0.08, 0, 0]),
    // Reposamuñecas ergonómico
    box(1.75, 0.05, 0.25, [0, 0.03, 0.42], '#111827'),
    // Bloque alfanumérico principal
    box(1.05, 0.08, 0.45, [-0.25, 0.12, -0.02], '#374151'),
    // Barra espaciadora
    box(0.45, 0.09, 0.07, [-0.25, 0.14, 0.18], p.accent),
    // Flechas de dirección
    box(0.2, 0.08, 0.3, [0.45, 0.12, 0.05], '#4b5563'),
    // Bloque numérico
    box(0.28, 0.08, 0.45, [0.72, 0.12, -0.02], '#374151'),
    // Fila de teclas de función F1-F12
    box(1.05, 0.07, 0.07, [-0.25, 0.13, -0.26], '#2563eb'),
    // Cable USB
    cyl(0.03, 0.03, 0.4, [-0.5, 0.09, -0.45], '#09090b', [Math.PI / 2, 0, 0]),
  ]
}

/** 13. Ratón Óptico de PC (Ergonómico con rueda de scroll y sensor) */
export function mouse(palette: Partial<PcPalette> = {}): Part[] {
  const p = { ...DEFAULT_PC_PALETTE, ...palette }
  return [
    // Chasis base del ratón
    box(0.5, 0.06, 0.8, [0, 0.03, 0], '#18181b'),
    // Dorso ergonómico curvado
    sphere(0.32, [0, 0.16, -0.06], '#27272a'),
    // Botón de clic izquierdo
    box(0.22, 0.08, 0.35, [-0.12, 0.16, 0.2], '#3f3f46'),
    // Botón de clic derecho
    box(0.22, 0.08, 0.35, [0.12, 0.16, 0.2], '#3f3f46'),
    // Rueda de scroll central con iluminación
    cyl(0.06, 0.06, 0.07, [0, 0.2, 0.25], p.accent, [0, 0, Math.PI / 2]),
    // Aleta lateral de apoyo del pulgar
    box(0.1, 0.06, 0.4, [-0.28, 0.06, -0.05], '#1f2937'),
    // Sensor óptico inferior
    cyl(0.08, 0.08, 0.02, [0, 0.01, 0], '#ef4444'),
  ]
}

/** 14. Monitor de Computadora (Pantalla plana, soporte metálico y pantalla activa) */
export function monitor(palette: Partial<PcPalette> = {}): Part[] {
  const p = { ...DEFAULT_PC_PALETTE, ...palette }
  return [
    // Base metálica de sobremesa
    box(0.7, 0.04, 0.5, [0, 0.02, 0], '#334155'),
    // Columna vertical de soporte
    box(0.1, 0.75, 0.08, [0, 0.4, -0.05], '#475569'),
    // Bisagra y anclaje VESA posterior
    box(0.25, 0.25, 0.06, [0, 0.75, -0.02], '#1e293b'),
    // Marco exterior de la pantalla
    box(2.1, 1.25, 0.08, [0, 1.15, 0], '#1e293b'),
    // Panel de bisel fino
    box(2.04, 1.18, 0.04, [0, 1.15, 0.04], '#0f172a'),
    // Panel activo de pantalla
    box(1.94, 1.08, 0.02, [0, 1.15, 0.05], '#0284c7'),
    // LED de encendido en el bisel inferior
    sphere(0.03, [0.85, 0.57, 0.06], p.accent),
  ]
}

/** 15. Placa Madre / Motherboard (Socket CPU, ranuras PCIe, DIMM y disipadores) */
export function motherboard(palette: Partial<PcPalette> = {}): Part[] {
  const p = { ...DEFAULT_PC_PALETTE, ...palette }
  return [
    // PCB ATX maestro
    box(1.8, 0.06, 1.8, [0, 0.03, 0], p.pcb),
    // Socket del procesador con palanca de retención
    box(0.55, 0.08, 0.55, [-0.25, 0.08, -0.25], '#cbd5e1'),
    // Ranuras de memoria DIMM DDR (4 slots paralelos)
    box(0.08, 0.12, 1.0, [0.38, 0.1, -0.25], '#1e293b'),
    box(0.08, 0.12, 1.0, [0.48, 0.1, -0.25], '#2563eb'),
    box(0.08, 0.12, 1.0, [0.58, 0.1, -0.25], '#1e293b'),
    box(0.08, 0.12, 1.0, [0.68, 0.1, -0.25], '#2563eb'),
    // Ranuras PCIe x16 blindadas para tarjeta gráfica
    box(1.1, 0.1, 0.08, [0.05, 0.09, 0.35], p.metal),
    box(1.1, 0.1, 0.08, [0.05, 0.09, 0.65], p.metal),
    // Disipador de calor del chipset (PCH)
    box(0.45, 0.16, 0.45, [0.42, 0.12, 0.35], p.accent),
    // Bloque de puertos traseros I/O Shield
    box(0.25, 0.32, 0.9, [-0.75, 0.18, -0.3], p.metal),
    // Disipador térmico de las fases de poder (VRM)
    box(0.2, 0.25, 0.65, [-0.62, 0.16, 0.2], '#1f2937'),
    // 4 Condensadores electrolíticos sólidos
    cyl(0.06, 0.06, 0.15, [-0.15, 0.11, 0.15], '#e2e8f0'),
    cyl(0.06, 0.06, 0.15, [-0.02, 0.11, 0.15], '#e2e8f0'),
    cyl(0.06, 0.06, 0.15, [-0.15, 0.11, 0.28], '#e2e8f0'),
    cyl(0.06, 0.06, 0.15, [-0.02, 0.11, 0.28], '#e2e8f0'),
  ]
}
