import { Text } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { Piece } from '@mus3o/shared'
import { useWikiInfo } from '../lib/info'
import type { PalaceLayout } from '../palace/layout'
import { useStore } from '../store'
import { panelBody, sourceNote } from './panelText'
import { useVr, vrRuntime } from './runtime'
import { EXIT_BUTTON, gazeView, PANEL_BUTTONS, PANEL_H, PANEL_W } from './view'

const FONT_BODY = '/fonts/HankenGrotesk.ttf'
const FONT_TITLE = '/fonts/Gloock.ttf'

function findConcept(layout: PalaceLayout, id: string | null): Piece | null {
  if (!id) return null
  for (const r of layout.rooms) {
    const p = r.pedestals.find((x) => x.concept.id === id)
    if (p) return p.concept
  }
  return null
}

/** Botón mirable: placa con etiqueta y una barra que se llena mientras se sostiene la mirada. */
function GazeButton({ id, x, y, w, h, label }: { id: string; x: number; y: number; w: number; h: number; label: string }) {
  const fill = useRef<THREE.Mesh>(null)
  const plate = useRef<THREE.MeshBasicMaterial>(null)
  const idle = useMemo(() => new THREE.Color('#2b3040'), [])
  const lit = useMemo(() => new THREE.Color('#3d4a66'), [])
  useFrame(() => {
    const on = gazeView.key === id
    if (fill.current) {
      fill.current.scale.x = Math.max(0.0001, on ? gazeView.progress : 0)
      fill.current.position.x = -w / 2 + (w * fill.current.scale.x) / 2
    }
    plate.current?.color.copy(on ? lit : idle)
  }, 2)
  return (
    <group position={[x, y, 0.02]}>
      <mesh>
        <planeGeometry args={[w, h]} />
        <meshBasicMaterial ref={plate} color="#2b3040" toneMapped={false} />
      </mesh>
      <mesh ref={fill} position={[-w / 2, -h / 2 + 0.012, 0.004]}>
        <planeGeometry args={[w, 0.024]} />
        <meshBasicMaterial color="#7cffb0" toneMapped={false} />
      </mesh>
      <Text font={FONT_BODY} fontSize={0.07} position={[0, 0.01, 0.006]} anchorX="center" anchorY="middle" color="#f5ecd8" maxWidth={w - 0.06}>
        {label}
      </Text>
    </group>
  )
}

/** Ficha de un concepto flotando delante del usuario. Se abre al mantener la mirada en un pedestal. */
export function ConceptPanel({ layout }: { layout: PalaceLayout }) {
  const panelId = useVr((s) => s.panelId)
  const concept = findConcept(layout, panelId)
  const memorized = useStore((s) => !!(panelId && s.memorized[panelId]))
  const wiki = useWikiInfo(concept?.imageSearch)
  const group = useRef<THREE.Group>(null)
  useFrame(() => {
    const g = group.current
    if (!g) return
    const p = gazeView.panel
    g.position.set(p.x, p.y, p.z)
    g.rotation.y = p.yaw
  }, 2)
  if (!concept || !vrRuntime.active) return null
  const note = sourceNote(concept, wiki ?? null)
  const hw = PANEL_W / 2
  const hh = PANEL_H / 2
  return (
    <group ref={group}>
      <mesh>
        <planeGeometry args={[PANEL_W, PANEL_H]} />
        <meshBasicMaterial color="#14161c" transparent opacity={0.94} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0, -0.003]}>
        <planeGeometry args={[PANEL_W + 0.04, PANEL_H + 0.04]} />
        <meshBasicMaterial color="#e3b04b" toneMapped={false} />
      </mesh>
      <Text font={FONT_TITLE} fontSize={0.11} position={[-hw + 0.07, hh - 0.06, 0.01]} anchorX="left" anchorY="top" maxWidth={PANEL_W - 0.14} color="#f5ecd8">
        {concept.title}
      </Text>
      <Text font={FONT_BODY} fontSize={0.06} lineHeight={1.3} position={[-hw + 0.07, hh - 0.22, 0.01]} anchorX="left" anchorY="top" maxWidth={PANEL_W - 0.14} color="#e8e4da">
        {panelBody(concept, wiki ?? null)}
      </Text>
      {note && (
        <Text font={FONT_BODY} fontSize={0.04} position={[-hw + 0.07, -hh + 0.2, 0.01]} anchorX="left" anchorY="bottom" maxWidth={PANEL_W - 0.14} color="#b9b3a3">
          {note}
        </Text>
      )}
      <GazeButton {...PANEL_BUTTONS.memorize} label={memorized ? 'Quitar marca' : 'Marcar memorizado'} />
      <GazeButton {...PANEL_BUTTONS.close} label="Cerrar" />
    </group>
  )
}

/** Botón flotante para salir del cuadro (dentro del diorama, mirando hacia abajo). */
export function ExitButton() {
  const group = useRef<THREE.Group>(null)
  useFrame(() => {
    const g = group.current
    if (!g) return
    const e = gazeView.exit
    g.visible = vrRuntime.active && e.show
    g.position.set(e.x, e.y, e.z)
    g.rotation.y = e.yaw
  }, 2)
  return (
    <group ref={group} visible={false}>
      <GazeButton id={EXIT_BUTTON.key} x={0} y={0} w={EXIT_BUTTON.w} h={EXIT_BUTTON.h} label="Salir del cuadro" />
    </group>
  )
}
