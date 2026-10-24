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
    expect(['a.docx', 'b.XLSX', 'c.csv', 'd.txt', 'e.md', 'f.json'].map(fileKindOf)).toEqual([
      'docx',
      'xlsx',
      'csv',
      'txt',
      'md',
      'json',
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

  it('rejects empty files', async () => {
    await expect(readTextAttachment(new File(['   \n'], 'vacio.txt'))).rejects.toThrow('está vacío')
  })
})
