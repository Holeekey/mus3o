import { demoMuseum } from './mocks'
import { EXAMPLE_TEXT } from './palace/example'
import { parsePalace } from './palace/parse'
import { World } from './scene/World'
import { useStore } from './store'

// ?demo entra directo al palacio de ejemplo; ?demo=ia usa el museo de muestra con modelos de IA.
const demo = new URLSearchParams(window.location.search).get('demo')
if (demo === 'ia') useStore.getState().enterPalace(demoMuseum)
else if (demo !== null) {
  const r = parsePalace(EXAMPLE_TEXT)
  if (r.ok) useStore.getState().enterPalace(r.palace)
}
import { Hud } from './ui/Hud'
import { Landing } from './ui/Landing'

export default function App() {
  const screen = useStore((s) => s.screen)
  const layout = useStore((s) => s.layout)

  if (screen === 'palace' && layout) {
    return (
      <div className="palace">
        <World layout={layout} />
        <Hud layout={layout} />
      </div>
    )
  }
  return <Landing />
}
