import { Canvas } from '@react-three/fiber'
import { lazy, Suspense, useMemo } from 'react'
import type { PalaceLayout } from '../palace/layout'
import { useStore } from '../store'
import { DEFAULT_THEME, roomPalettes, type Theme } from '../theme'
import { palaceKey } from '../memory/model'
import { IntroCamera } from '../intro/IntroCamera'
import { HideDuringIntro, Reveal } from '../intro/Reveal'
import { beginIntro } from '../intro/store'
import { corridorKey } from '../intro/timeline'
import { AssetDoorway, AssetFloor, AssetWall } from './DungeonAssets'
import { ArisCompanion } from './ArisCompanion'
import { AtmosphereController } from './AtmosphereController'
import { DecayField } from './Decay'
import { Player } from './Player'
import { Room } from './Room'

// El mundo de los dioramas (entrar al cuadro) se descarga aparte y solo si alguna sala tiene uno.
const DioramaRuntime = lazy(() => import('../diorama/DioramaRuntime').then((m) => ({ default: m.DioramaRuntime })))

// Un sol de mediodía cuya cámara de sombra cubre todo el palacio.
function Sun({ layout, theme }: { layout: PalaceLayout; theme: Theme }) {
  const { sun, shadows } = theme.scene
  const { minX, maxX, minZ, maxZ } = layout.bounds
  const cx = (minX + maxX) / 2
  const cz = (minZ + maxZ) / 2
  const half = Math.hypot(maxX - minX, maxZ - minZ) / 2 + 4
  const [sx, sy, sz] = sun.position
  const len = Math.hypot(sx, sy, sz)
  const dist = half * 2 + 20
  return (
    <>
      <directionalLight
        color={sun.color}
        intensity={sun.intensity}
        position={[cx + (sx / len) * dist, (sy / len) * dist, cz + (sz / len) * dist]}
        castShadow={shadows}
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.04}
        shadow-camera-left={-half}
        shadow-camera-right={half}
        shadow-camera-top={half}
        shadow-camera-bottom={-half}
        shadow-camera-near={1}
        shadow-camera-far={dist * 2 + 20}
      >
        <object3D attach="target" position={[cx, 0, cz]} />
      </directionalLight>
    </>
  )
}

// ?intro=0 la desactiva, ?intro=1 la fuerza; ?introAt=<s> congela el reloj (capturas).
function startIntro(layout: PalaceLayout) {
  const q = new URLSearchParams(window.location.search)
  const flag = q.get('intro')
  const at = Number(q.get('introAt'))
  const palace = useStore.getState().palace
  beginIntro(layout, {
    key: palace ? palaceKey(palace) : layout.rooms.map((r) => r.id).join('|'),
    force: flag === '1' ? 'on' : flag === '0' ? 'off' : null,
    reducedMotion: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
    frozenAt: q.get('introAt') !== null && Number.isFinite(at) ? at : null,
  })
}

export function World({ layout, theme = DEFAULT_THEME }: { layout: PalaceLayout; theme?: Theme }) {
  const { scene } = theme
  useMemo(() => startIntro(layout), [layout]) // INTRO: debe decidirse antes del primer frame
  const unlockedDoors = useStore((s) => s.unlockedDoors)
  const freeExplore = useStore((s) => s.freeExplore)
  const palettes = useMemo(
    () => roomPalettes(theme, layout.rooms.map((r) => r.title)),
    [theme, layout],
  )
  const hasDiorama = useMemo(() => layout.rooms.some((r) => r.diorama), [layout])
  return (
    <Canvas camera={{ fov: 70, near: 0.1, far: 300 }} dpr={[1, 2]} shadows={scene.shadows} flat>
      <color attach="background" args={[scene.background]} />
      <fog attach="fog" args={[scene.fog.color, scene.fog.near, scene.fog.far]} />
      <hemisphereLight args={[scene.ambient.sky, scene.ambient.ground, scene.ambient.intensity]} />
      <Sun layout={layout} theme={theme} />
      <AtmosphereController layout={layout} theme={theme} />
      <DecayField layout={layout} theme={theme} />
      {layout.rooms.map((r, i) => (
        <Room key={r.id} room={r} palette={palettes[i]} theme={theme} />
      ))}
      {layout.corridors.map((c, i) => {
        const isHorizontal = c.floor.w > c.floor.d
        const rotY = isHorizontal ? Math.PI / 2 : 0
        const endA: [number, number, number] = isHorizontal
          ? [c.floor.x - c.floor.w / 2, 0, c.floor.z]
          : [c.floor.x, 0, c.floor.z - c.floor.d / 2]
        const endB: [number, number, number] = isHorizontal
          ? [c.floor.x + c.floor.w / 2, 0, c.floor.z]
          : [c.floor.x, 0, c.floor.z + c.floor.d / 2]
        // La compuerta va en el extremo del pasillo que da a la sala de salida (donde está su collider).
        const door = layout.doors.find((d) => d.corridorIndex === i)
        const nearA = !door || Math.hypot(door.x - endA[0], door.z - endA[2]) <= Math.hypot(door.x - endB[0], door.z - endB[2])
        const doorPosA = nearA ? endA : endB
        const doorPosB = nearA ? endB : endA
        const isOpen = freeExplore || (door ? !!unlockedDoors[door.id] : true)

        return (
          <Reveal key={i} id={corridorKey(i)} mode="rise" /* INTRO */>
          <group>
            <AssetFloor box={c.floor} color={scene.corridor.floor} />
            {c.walls.map((w, j) => (
              <AssetWall key={j} box={w} color={scene.corridor.wall} />
            ))}
            {/* Puerta interactiva con físicas y animación al inicio del pasillo */}
            {/* Una sola luz por pasillo (en la compuerta) para no multiplicar el costo de iluminación */}
            <AssetDoorway position={doorPosA} rotation={[0, rotY, 0]} isOpen={isOpen} light />
            {/* Arco abierto al final del pasillo que conecta con la siguiente cámara */}
            <AssetDoorway position={doorPosB} rotation={[0, rotY, 0]} isOpen={true} />
          </group>
          </Reveal>
        )
      })}
      <IntroCamera layout={layout} />
      <Player layout={layout} />
      {hasDiorama && (
        <Suspense fallback={null}>
          <DioramaRuntime layout={layout} theme={theme} />
        </Suspense>
      )}
      <HideDuringIntro>
        <ArisCompanion />
      </HideDuringIntro>
    </Canvas>
  )
}
