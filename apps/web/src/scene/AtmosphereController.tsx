import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { Color, type Fog } from 'three'
import type { PalaceLayout } from '../palace/layout'
import { useStore } from '../store'
import type { Theme } from '../theme'

export function AtmosphereController({
  layout,
  theme,
}: {
  layout: PalaceLayout
  theme: Theme
}) {
  const { scene } = useThree()
  const currentRoomId = useStore((s) => s.currentRoomId)

  const targetFog = useRef(new Color(theme.scene.fog.color))
  const targetBackground = useRef(new Color(theme.scene.background))

  useEffect(() => {
    if (!currentRoomId) {
      targetFog.current.set(theme.scene.fog.color)
      targetBackground.current.set(theme.scene.background)
      return
    }

    const currentRoom = layout.rooms.find((r) => r.id === currentRoomId)
    if (currentRoom?.palette?.fogColor) {
      targetFog.current.set(currentRoom.palette.fogColor)
      targetBackground.current.set(currentRoom.palette.fogColor)
    } else {
      targetFog.current.set(theme.scene.fog.color)
      targetBackground.current.set(theme.scene.background)
    }
  }, [currentRoomId, layout, theme])

  useFrame((_, delta) => {
    const alpha = Math.min(1, delta * 2.2)

    if (scene.fog && 'color' in scene.fog) {
      ;(scene.fog as Fog).color.lerp(targetFog.current, alpha)
    }

    if (scene.background && typeof scene.background === 'object' && 'isColor' in scene.background) {
      ;(scene.background as Color).lerp(targetBackground.current, alpha)
    }
  })

  return null
}
