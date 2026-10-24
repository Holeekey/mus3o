import { useLayoutEffect, useMemo } from 'react'
import { Color } from 'three'
import type { RoomLayout } from '../palace/layout'
import type { RoomPalette, Theme } from '../theme'
import { buildDecorGeometry } from './decorGeometry'

/**
 * Columnas, arcos o nichos en las esquinas de la sala: yeso con remates del color de la moldura.
 * Una sola malla con color por vértice por sala (cero si la sala no lleva decoración). Los colisionadores
 * salen de `room.decor` (ver `collidersOf` en el layout).
 */
export function RoomDecor({ room, palette, theme }: { room: RoomLayout; palette: RoomPalette; theme: Theme }) {
  const geometry = useMemo(() => {
    const plaster = new Color(theme.scene.pedestal.color).lerp(new Color(palette.wall), 0.12)
    const recess = new Color(palette.wall).multiplyScalar(0.45)
    return buildDecorGeometry(room.decor, room.height, { plaster: '#' + plaster.getHexString(), trim: palette.trim, recess: '#' + recess.getHexString() })
  }, [room.decor, room.height, palette.wall, palette.trim, theme.scene.pedestal.color])
  useLayoutEffect(() => () => geometry?.dispose(), [geometry])
  if (!geometry) return null
  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial vertexColors flatShading roughness={0.95} />
    </mesh>
  )
}
