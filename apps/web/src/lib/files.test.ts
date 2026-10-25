import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import { compactJson, compactTable, compactText, fileKindOf, readTextAttachment, UnsupportedFileError } from './files'

async function docx(paragraphs: string[]): Promise<File> {
  const zip = new JSZip()
  zip.file(
    '[Content_Types].xml',
    '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
  )
  zip.file(
    '_rels/.rels',
    '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
  )
  const body = paragraphs.map((p) => `<w:p><w:r><w:t xml:space="preserve">${p}</w:t></w:r></w:p>`).join('')
  zip.file(
    'word/document.xml',
    `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`,
  )
  return new File([await zip.generateAsync({ type: 'arraybuffer' })], 'apuntes.docx')
}

/** PDF mínimo válido: una línea de texto por página (Helvetica), con la tabla xref calculada. */
function pdf(pages: string[][], name = 'apuntes.pdf'): File {
  const objs: string[] = []
  const kids = pages.map((_, i) => `${3 + i * 2} 0 R`).join(' ')
  objs.push('<< /Type /Catalog /Pages 2 0 R >>')
  objs.push(`<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`)
  const font = 3 + pages.length * 2
  pages.forEach((lines) => {
    const ops = lines.map((l, j) => `BT /F1 12 Tf 72 ${720 - j * 20} Td (${l}) Tj ET`).join('\n')
    objs.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${font} 0 R >> >> /Contents ${objs.length + 2} 0 R >>`)
    objs.push(`<< /Length ${ops.length} >>\nstream\n${ops}\nendstream`)
  })
  objs.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>')
  let out = '%PDF-1.4\n'
  const offsets = objs.map((o, i) => {
    const at = out.length
    out += `${i + 1} 0 obj\n${o}\nendobj\n`
    return at
  })
  const xref = out.length
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
  return new File([out], name)
}

async function xlsx(rows: string[][]): Promise<File> {
  const zip = new JSZip()
  zip.file(
    '[Content_Types].xml',
    '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
  )
  zip.file(
    '_rels/.rels',
    '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
  )
  zip.file(
    'xl/workbook.xml',
    '<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Hoja1" sheetId="1" r:id="rId1"/></sheets></workbook>',
  )
  zip.file(
    'xl/_rels/workbook.xml.rels',
    '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
  )
  const cols = 'ABCDEFGH'
  const sheetRows = rows
    .map(
      (r, i) =>
        `<row r="${i + 1}">${r.map((v, j) => `<c r="${cols[j]}${i + 1}" t="inlineStr"><is><t>${v}</t></is></c>`).join('')}</row>`,
    )
    .join('')
  zip.file(
    'xl/worksheets/sheet1.xml',
    `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetRows}</sheetData></worksheet>`,
  )
  return new File([await zip.generateAsync({ type: 'arraybuffer' })], 'tabla.xlsx')
}

describe('fileKindOf', () => {
  it('recognizes every supported extension, case-insensitively', () => {
    expect(['a.docx', 'b.XLSX', 'c.csv', 'd.txt', 'e.md', 'f.json', 'g.PDF'].map(fileKindOf)).toEqual([
      'docx',
      'xlsx',
      'csv',
      'txt',
      'md',
      'json',
      'pdf',
    ])
    expect(['a.png', 'b.JPG', 'c.jpeg', 'd.webp'].map(fileKindOf)).toEqual(['image', 'image', 'image', 'image'])
  })

  it('explains how to convert legacy Office files and rejects unknown types', () => {
    expect(() => fileKindOf('viejo.doc')).toThrow('Guárdalo como .docx')
    expect(() => fileKindOf('viejo.xls')).toThrow('Guárdalo como .xlsx')
    expect(() => fileKindOf('video.mp4')).toThrow(UnsupportedFileError)
  })
})

describe('compaction', () => {
  it('normalizes spaces and removes empty and repeated lines', () => {
    expect(compactText('  Tema   1 \r\n\r\n\tConcepto  A\nconcepto a\n\n\nConcepto B  ')).toBe('Tema 1\nConcepto A\nConcepto B')
  })

  it('turns table rows into short header: value lines', () => {
    expect(
      compactTable([
        ['Planeta', 'Tipo', 'Lunas'],
        ['Marte', 'Rocoso', '2'],
        ['Júpiter', '', '95'],
        ['', '', ''],
      ]),
    ).toBe('Planeta: Marte; Tipo: Rocoso; Lunas: 2\nPlaneta: Júpiter; Lunas: 95')
  })

  it('turns JSON into path: value lines', () => {
    expect(compactJson({ tema: 'Células', partes: ['núcleo', 'membrana'], datos: { tamaño: 10, viva: true } })).toBe(
      'tema: Células\npartes: núcleo, membrana\ndatos.tamaño: 10\ndatos.viva: true',
    )
    expect(compactJson([{ nombre: 'Marte' }, { nombre: 'Venus' }])).toBe('[1].nombre: Marte\n[2].nombre: Venus')
  })
})

describe('readTextAttachment', () => {
  it('reads plain text and markdown as compact text', async () => {
    const result = await readTextAttachment(new File(['# Tema\n\n- A\n- A\n'], 'notas.md'))
    expect(result).toEqual({ name: 'notas.md', kind: 'md', text: '# Tema\n- A' })
  })

  it('reads CSV with quotes and semicolons', async () => {
    const result = await readTextAttachment(new File(['tema;concepto\n"Células; vida";Núcleo\n'], 'datos.csv'))
    expect(result.text).toBe('tema: Células; vida; concepto: Núcleo')
  })

  it('reads JSON and reports invalid JSON clearly', async () => {
    expect((await readTextAttachment(new File(['{"a":{"b":1}}'], 'x.json'))).text).toBe('a.b: 1')
    await expect(readTextAttachment(new File(['{nope'], 'x.json'))).rejects.toThrow('no es un JSON válido')
  })

  it('reads a .docx document', async () => {
    const result = await readTextAttachment(await docx(['Membrana celular', 'Bicapa lipídica: dos capas']))
    expect(result).toEqual({ name: 'apuntes.docx', kind: 'docx', text: 'Membrana celular\nBicapa lipídica: dos capas' })
  })

  it('reads a .xlsx spreadsheet', async () => {
    const result = await readTextAttachment(await xlsx([['Tema', 'Concepto'], ['Células', 'Núcleo']]))
    expect(result).toEqual({ name: 'tabla.xlsx', kind: 'xlsx', text: 'Tema: Células; Concepto: Núcleo' })
  })

  it('reads the text of every page of a .pdf', async () => {
    const result = await readTextAttachment(pdf([['Batalla de Carabobo', '24 de junio de 1821'], ['Bolivar y Paez']]))
    expect(result).toEqual({ name: 'apuntes.pdf', kind: 'pdf', text: 'Batalla de Carabobo\n24 de junio de 1821\nBolivar y Paez' })
  })

  it('explains that a PDF without text is probably a scan', async () => {
    await expect(readTextAttachment(pdf([[]], 'escaneo.pdf'))).rejects.toThrow('no tiene texto seleccionable')
  })

  it('reports a broken PDF clearly', async () => {
    await expect(readTextAttachment(new File(['no soy un pdf'], 'roto.pdf'))).rejects.toThrow('No pudimos leer')
  })

  it('rejects empty files', async () => {
    await expect(readTextAttachment(new File(['   \n'], 'vacio.txt'))).rejects.toThrow('está vacío')
  })
})
