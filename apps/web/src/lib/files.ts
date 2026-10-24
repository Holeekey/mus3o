import mammoth from 'mammoth'
import readXlsxFile from 'read-excel-file/universal'
import type { InputImage, Source } from '@mus3o/shared'

/**
 * Lectura de archivos adjuntos en el navegador, sin IA: el texto se extrae y se compacta aquí
 * para que el modelo reciba lo mínimo. Los archivos nunca viajan al servidor, solo su texto.
 */

export type TextKind = Source['kind']
export type FileKind = TextKind | 'image'

export class UnsupportedFileError extends Error {}

const EXTENSIONS: Record<string, FileKind> = {
  docx: 'docx',
  xlsx: 'xlsx',
  csv: 'csv',
  txt: 'txt',
  md: 'md',
  markdown: 'md',
  json: 'json',
  png: 'image',
  jpg: 'image',
  jpeg: 'image',
  webp: 'image',
}

// Formatos de Office viejos (binarios): no se pueden leer bien en el navegador.
const LEGACY: Record<string, string> = { doc: '.docx', xls: '.xlsx' }

export function fileKindOf(name: string): FileKind {
  const ext = name.toLowerCase().split('.').pop() ?? ''
  if (LEGACY[ext]) {
    throw new UnsupportedFileError(`"${name}" usa un formato antiguo. Guárdalo como ${LEGACY[ext]} y vuelve a subirlo.`)
  }
  const kind = EXTENSIONS[ext]
  if (!kind) throw new UnsupportedFileError(`"${name}" no es un formato compatible.`)
  return kind
}

/** Espacios normalizados, sin líneas vacías ni repetidas (sin distinguir mayúsculas). */
export function compactText(text: string): string {
  const seen = new Set<string>()
  const lines: string[] = []
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/\s+/g, ' ').trim()
    const key = line.toLowerCase()
    if (!line || seen.has(key)) continue
    seen.add(key)
    lines.push(line)
  }
  return lines.join('\n')
}

const cell = (value: unknown) => (value === null || value === undefined ? '' : String(value).replace(/\s+/g, ' ').trim())

/** La primera fila con contenido son los encabezados; cada fila queda como `encabezado: valor; ...`. */
export function compactTable(rows: unknown[][]): string {
  const filled = rows.map((r) => r.map(cell)).filter((r) => r.some(Boolean))
  if (filled.length === 0) return ''
  const [headers, ...data] = filled
  if (data.length === 0) return compactText(headers.filter(Boolean).join(' | '))
  const lines = data.map((row) =>
    row
      .map((value, i) => (value ? (headers[i] ? `${headers[i]}: ${value}` : value) : ''))
      .filter(Boolean)
      .join('; '),
  )
  return compactText(lines.join('\n'))
}

/** Aplana el JSON en líneas `ruta: valor`; las listas de valores simples van en una línea. */
export function compactJson(value: unknown): string {
  const lines: string[] = []
  const isPrimitive = (v: unknown) => v === null || ['string', 'number', 'boolean'].includes(typeof v)
  const walk = (node: unknown, path: string) => {
    if (isPrimitive(node)) {
      if (node !== null && cell(node)) lines.push(path ? `${path}: ${cell(node)}` : cell(node))
      return
    }
    if (Array.isArray(node)) {
      if (node.every(isPrimitive)) {
        const values = node.map(cell).filter(Boolean)
        if (values.length) lines.push(path ? `${path}: ${values.join(', ')}` : values.join(', '))
        return
      }
      node.forEach((item, i) => walk(item, `${path}[${i + 1}]`))
      return
    }
    for (const [key, child] of Object.entries(node as Record<string, unknown>)) {
      walk(child, path ? `${path}.${key}` : key)
    }
  }
  walk(value, '')
  return compactText(lines.join('\n'))
}

/** Separa una línea de CSV respetando comillas. */
function splitCsvLine(line: string, delimiter: string): string[] {
  const out: string[] = []
  let current = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"'
        i++
      } else quoted = !quoted
    } else if (ch === delimiter && !quoted) {
      out.push(current)
      current = ''
    } else current += ch
  }
  out.push(current)
  return out
}

function parseCsv(text: string): string[][] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim())
  const first = lines[0] ?? ''
  const delimiter = (first.match(/;/g)?.length ?? 0) > (first.match(/,/g)?.length ?? 0) ? ';' : ','
  return lines.map((l) => splitCsvLine(l, delimiter))
}

async function extractDocx(file: File): Promise<string> {
  const data = await file.arrayBuffer()
  // El build de navegador de mammoth lee `arrayBuffer`; el de Node (tests) lee `buffer`.
  const input = { arrayBuffer: data, buffer: data } as unknown as { arrayBuffer: ArrayBuffer }
  const { value } = await mammoth.extractRawText(input)
  return value
}

async function extractXlsx(file: File): Promise<string> {
  const sheets = await readXlsxFile(await file.arrayBuffer())
  const parts = sheets.map(({ sheet, data }) => {
    const table = compactTable(data as unknown[][])
    return sheets.length > 1 && table ? `${sheet}\n${table}` : table
  })
  return parts.filter(Boolean).join('\n')
}

/** Lee un archivo de texto (docx, xlsx, csv, txt, md, json) y devuelve su texto ya compactado. */
export async function readTextAttachment(file: File): Promise<Source> {
  const kind = fileKindOf(file.name)
  if (kind === 'image') throw new UnsupportedFileError(`"${file.name}" es una imagen, no un texto.`)

  let text: string
  try {
    if (kind === 'docx') text = compactText(await extractDocx(file))
    else if (kind === 'xlsx') text = await extractXlsx(file)
    else if (kind === 'csv') text = compactTable(parseCsv(await file.text()))
    else if (kind === 'json') text = compactJson(JSON.parse(await file.text()))
    else text = compactText(await file.text())
  } catch (err) {
    if (err instanceof UnsupportedFileError) throw err
    if (kind === 'json') throw new UnsupportedFileError(`"${file.name}" no es un JSON válido.`)
    throw new UnsupportedFileError(`No pudimos leer "${file.name}". ¿Está dañado o protegido?`)
  }
  if (!text) throw new UnsupportedFileError(`"${file.name}" está vacío.`)
  return { name: file.name.slice(0, 120), kind, text }
}

const MAX_IMAGE_SIDE = 1024

/** Imagen adjunta lista para la IA (`images[]`) y su vista previa local. */
export type ImageAttachment = { image: InputImage; previewUrl: string }

/** Redimensiona la imagen a 1024 px como máximo y la pasa a JPEG (solo navegador). */
export async function readImageAttachment(file: File, id: string): Promise<ImageAttachment> {
  if (fileKindOf(file.name) !== 'image') throw new UnsupportedFileError(`"${file.name}" no es una imagen.`)
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    throw new UnsupportedFileError(`No pudimos leer la imagen "${file.name}".`)
  }
  const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(bitmap.width * scale))
  canvas.height = Math.max(1, Math.round(bitmap.height * scale))
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new UnsupportedFileError(`No pudimos procesar la imagen "${file.name}".`)
  // Fondo blanco: las transparencias de un PNG no quedan negras en el JPEG.
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const previewUrl = canvas.toDataURL('image/jpeg', 0.85)
  const data = previewUrl.slice(previewUrl.indexOf(',') + 1)
  return { image: { id, name: file.name.slice(0, 120), mediaType: 'image/jpeg', data }, previewUrl }
}
