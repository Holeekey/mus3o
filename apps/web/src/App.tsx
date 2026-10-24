import { lazy, Suspense } from 'react'
import { applyDemoCamera, applyDemoJump, applyDemoSeed } from './memory/demo'
import { demoMuseum } from './mocks'
import { dungeonDemoMuseum } from './mocks/dungeon'
import { medicinaMuseum } from './mocks/medicina' // science-kit
import { historiaMuseum } from './mocks/historia'
import { EXAMPLE_TEXT } from './palace/example'
import { parsePalace } from './palace/parse'
import { useStore } from './store'
import { DEFAULT_THEME } from './theme'

// La escena 3D (three, fiber, drei) se carga aparte para no inflar el bundle de la landing.
const World = lazy(() => import('./scene/World').then((m) => ({ default: m.World })))

// ?demo entra directo al palacio de ejemplo; ?demo=ia usa el museo de muestra con modelos de IA;
// ?demo=historia muestra el museo de historia con cuadros reales de Wikimedia;
// ?demo=dungeon usa la mazmorra del sandbox adaptada a museo.
const demo = new URLSearchParams(window.location.search).get('demo')
if (demo === 'ia') useStore.getState().enterPalace(demoMuseum)
else if (demo === 'historia') useStore.getState().enterPalace(historiaMuseum)
else if (demo === 'dungeon') useStore.getState().enterPalace(dungeonDemoMuseum)
else if (demo === 'medicina') useStore.getState().enterPalace(medicinaMuseum) // science-kit
else if (demo !== null) {
  const r = parsePalace(EXAMPLE_TEXT)
  if (r.ok) useStore.getState().enterPalace(r.palace, EXAMPLE_TEXT)
}
if (demo !== null) {
  const entered = useStore.getState().palace
  if (entered) applyDemoSeed(entered)
  applyDemoCamera()
  applyDemoJump()
}
import { DioramaOverlay } from './diorama/DioramaOverlay'
import { IntroOverlay } from './intro/IntroOverlay'
import { useIntro } from './intro/store'
import { BuildNotice } from './ui/BuildNotice'
import { Hud } from './ui/Hud'
import { Landing } from './ui/Landing'

export default function App() {
  const screen = useStore((s) => s.screen)
  const layout = useStore((s) => s.layout)

  const introOn = useIntro((s) => s.phase === 'idle' || (s.phase === 'playing' && !s.reduced)) // intro: oculta el HUD hasta que el vuelo termina

  // Palacio que se levanta en vivo: el HUD espera a que el usuario salte o a que termine el vuelo.
  const waitingForBuild = useStore((s) => s.build.status === 'building' && (introOn || (s.palace?.rooms.length ?? 0) === 0))

  if (screen === 'palace' && layout) {
    return (
      <div className={introOn ? 'palace intro-on' : 'palace'}>
        <Suspense fallback={<div style={{ position: 'absolute', inset: 0, background: DEFAULT_THEME.scene.background }} />}>
          <World layout={layout} />
        </Suspense>
        {!waitingForBuild && <Hud layout={layout} />}
        <DioramaOverlay />
        <IntroOverlay />
        <BuildNotice />
      </div>
    )
  }
  return <Landing />
}
