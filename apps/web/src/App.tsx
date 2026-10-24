import { lazy, Suspense, useEffect } from 'react'
import { demoMuseum } from './mocks'
import { dungeonDemoMuseum } from './mocks/dungeon'
import { EXAMPLE_TEXT } from './palace/example'
import { parsePalace } from './palace/parse'
import { useStore } from './store'
import { DEFAULT_THEME } from './theme'

// La escena 3D (three, fiber, drei) se carga aparte para no inflar el bundle de la landing.
const World = lazy(() => import('./scene/World').then((m) => ({ default: m.World })))

// ?demo entra directo al palacio de ejemplo; ?demo=ia usa el museo de muestra con modelos de IA;
// ?demo=dungeon usa la mazmorra del sandbox adaptada a museo.
const demo = new URLSearchParams(window.location.search).get('demo')
if (demo === 'ia') useStore.getState().enterPalace(demoMuseum)
else if (demo === 'dungeon') useStore.getState().enterPalace(dungeonDemoMuseum)
else if (demo !== null) {
  const r = parsePalace(EXAMPLE_TEXT)
  if (r.ok) useStore.getState().enterPalace(r.palace)
}
import { Hud } from './ui/Hud'
import { Landing } from './ui/Landing'

export default function App() {
  const screen = useStore((s) => s.screen)
  const layout = useStore((s) => s.layout)

  useEffect(() => {
    const demoParam = new URLSearchParams(window.location.search).get('demo')
    if (demoParam === 'dungeon') {
      useStore.getState().enterPalace(dungeonDemoMuseum)
    }
  }, [])

  if (screen === 'palace' && layout) {
    return (
      <div className="palace">
        <Suspense fallback={<div style={{ position: 'absolute', inset: 0, background: DEFAULT_THEME.scene.background }} />}>
          <World layout={layout} />
        </Suspense>
        <Hud layout={layout} />
      </div>
    )
  }
  return <Landing />
}
