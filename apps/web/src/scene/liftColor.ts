/**
 * La IA suele dibujar los objetos con tonos muy oscuros que se pierden contra la piedra de la sala. Sube la luminosidad
 * de los colores demasiado oscuros mezclándolos con yeso claro; los que ya se leen bien no cambian.
 */
const MIN_LUMA = 0.32
const CHALK: [number, number, number] = [0xd8, 0xd0, 0xc0]

function parse(hex: string): [number, number, number] | null {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})([0-9a-f]{2})?$/i.exec(hex.trim())
  if (!m) return null
  const h = m[1].length === 3 ? m[1].replace(/./g, (c) => c + c) : m[1]
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

export function liftColor(hex: string): string {
  const rgb = parse(hex)
  if (!rgb) return hex
  const luma = (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255
  if (luma >= MIN_LUMA) return hex
  const t = Math.min(((MIN_LUMA - luma) / MIN_LUMA) * 0.75, 0.75)
  const out = rgb.map((c, i) => Math.round(c + (CHALK[i] - c) * t))
  return `#${out.map((c) => c.toString(16).padStart(2, '0')).join('')}`
}
