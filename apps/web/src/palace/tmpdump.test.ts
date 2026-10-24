import { it } from 'vitest'
import { appendFileSync, writeFileSync } from 'node:fs'
const OUT = 'C:/Users/gabod/AppData/Local/Temp/dump.txt'
writeFileSync(OUT, '')
import { buildLayout } from './layout'
import { attachLibraryDioramas } from '../diorama/library'
import { historiaMuseum } from '../mocks/historia'
import { medicinaMuseum } from '../mocks/medicina'
import { demoMuseum } from '../mocks'
it('dump', () => {
  for (const [n, m] of [['historia', historiaMuseum], ['medicina', medicinaMuseum], ['demo', demoMuseum]] as const) {
    const l = buildLayout(attachLibraryDioramas(m))
    for (const r of l.rooms) appendFileSync(OUT, ['ROOM', n, r.title, '|', r.x.toFixed(1), r.z.toFixed(1), r.w.toFixed(1), r.d.toFixed(1), '|', r.centerpiece?.kind ?? 'none', r.pedestals.length, 'diorama', !!r.diorama].join(' ') + '\n')
  }
})
