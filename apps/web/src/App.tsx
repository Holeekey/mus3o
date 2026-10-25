import { lazy, Suspense, useEffect } from 'react'
import { applyDemoCamera, applyDemoJump, applyDemoSeed } from './memory/demo'
import { demoMuseum } from './mocks'
import { dungeonDemoMuseum } from './mocks/dungeon'
import { medicinaMuseum } from './mocks/medicina' // science-kit
import { historiaMuseum } from './mocks/historia'
import { compuestoMuseum } from './mocks/compuesto'
import { attachComposedDioramas } from './diorama/compose'
import { EXAMPLE_TEXT } from './palace/example'
import { parsePalace } from './palace/parse'
import { hydrateUserImages, useStore } from './store'
import { DEFAULT_THEME } from './theme'

// La escena 3D (three, fiber, drei) se carga aparte para no inflar el bundle de la landing.
const World = lazy(() => import('./scene/World').then((m) => ({ default: m.World })))

// ?demo entra directo al palacio de ejemplo; ?demo=ia usa el museo de muestra con modelos de IA;
// ?demo=compuesto prueba el compositor de dioramas con conceptos (legado, solo demo);
// ?demo=historia muestra el museo de historia con cuadros reales de Wikimedia;
// ?demo=dungeon usa la mazmorra del sandbox adaptada a museo.
const demo = new URLSearchParams(window.location.search).get('demo')
if (demo === 'ia') useStore.getState().enterPalace(demoMuseum)
else if (demo === 'historia') useStore.getState().enterPalace(historiaMuseum)
else if (demo === 'compuesto') useStore.getState().enterPalace(attachComposedDioramas(compuestoMuseum)) // legado: dioramas compuestos (ya no es el comportamiento por defecto)
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
import { VrOverlay } from './vr/VrOverlay'
import { TeamPage } from './ui/TeamSection'
import { TEAM_HASH, useHash } from './ui/useHash'

export default function App() {
  useEffect(() => {
    void hydrateUserImages()
  }, [])

  const screen = useStore((s) => s.screen)
  const layout = useStore((s) => s.layout)
  const hash = useHash()

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
        <VrOverlay />
        <BuildNotice />
      </div>
    )
  }
  return hash === TEAM_HASH ? <TeamPage /> : <Landing />
}
