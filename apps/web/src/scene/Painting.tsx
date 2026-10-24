import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { Color, SRGBColorSpace, TextureLoader, type Texture } from 'three'
import { type Diorama, type ImageSearch } from '@mus3o/shared'
import { creditLine, userImageAsResolved, useResolvedImage } from '../lib/images'
import { LabelPlate } from './LabelPlate'
import type { PaintingSlot, UserImage } from '../palace/layout'
import type { RoomPalette, Theme } from '../theme'

// El cuadro-portal arrastra el código del diorama (geometría procedural, terreno): solo se
// descarga si la sala tiene diorama.
const PortalPainting = lazy(() => import('./PortalPainting').then((m) => ({ default: m.PortalPainting })))

const FONT_BODY = '/fonts/HankenGrotesk.ttf'
const FRAME_T = 0.07 // ancho de la moldura
const FRAME_DEPTH = 0.11
const MAT = 0.05 // ancho del passe-partout
const WALL_Z = -0.06 // el muro queda atrás del grupo (el slot está 0.06 m separado)

const loader = new TextureLoader().setCrossOrigin('anonymous')

function useTexture(src?: string): Texture | null {
  const [state, setState] = useState<{ src: string; texture: Texture } | null>(null)
  useEffect(() => {
    if (!src) return
    let alive = true
    let loaded: Texture | null = null
    loader.load(
      src,
      (texture) => {
        texture.colorSpace = SRGBColorSpace
        texture.anisotropy = 8
        loaded = texture
        if (alive) setState({ src, texture })
        else texture.dispose()
      },
      undefined,
      () => {},
    )
    return () => {
      alive = false
      loaded?.dispose()
    }
  }, [src])
  return src && state?.src === src ? state.texture : null
}

/** Cuadro enmarcado con su placa. No dibuja nada hasta que la imagen carga. */
export function Painting({
  slot,
  search,
  userImage,
  palette,
  theme,
  diorama,
  roomId,
}: {
  slot: PaintingSlot
  search?: ImageSearch
  /** Imagen subida por el usuario: tiene prioridad sobre la búsqueda. */
  userImage?: UserImage
  palette: RoomPalette
  theme: Theme
  /** Si lo hay, el cuadro es un portal: al acercarse se disuelve en este diorama. */
  diorama?: Diorama
  roomId?: string
}) {
  const resolved = useResolvedImage(userImage ? undefined : search)
  const image = userImage ? userImageAsResolved(userImage.src, userImage.title) : resolved
  const texture = useTexture(image?.src)
  const matColor = useMemo(() => new Color(theme.scene.object.color).multiplyScalar(0.92), [theme])
  if (!image || !texture) return null

  const aspect = (texture.image as { width: number; height: number }).width / (texture.image as { width: number; height: number }).height
  const maxW = slot.maxWidth - 2 * (FRAME_T + MAT)
  const maxH = slot.maxHeight - 2 * (FRAME_T + MAT)
  const w = Math.min(maxW, maxH * aspect)
  const h = w / aspect
  const ow = w + 2 * MAT // abertura del marco
  const oh = h + 2 * MAT
  const roughness = theme.scene.object.roughness
  const frame = palette.trim

  const bars: [number, number, number, number][] = [
    [0, oh / 2 + FRAME_T / 2, ow + 2 * FRAME_T, FRAME_T],
    [0, -oh / 2 - FRAME_T / 2, ow + 2 * FRAME_T, FRAME_T],
    [-ow / 2 - FRAME_T / 2, 0, FRAME_T, oh],
    [ow / 2 + FRAME_T / 2, 0, FRAME_T, oh],
  ]
  const bottom = -oh / 2 - FRAME_T

  // Centro de la obra en el mundo (mismo plano que el cuadro plano), para el portal.
  const pz = WALL_Z + 0.0505
  const portalPos: [number, number, number] = [slot.x + Math.sin(slot.rotationY) * (pz + 0.002), slot.y, slot.z + Math.cos(slot.rotationY) * (pz + 0.002)]
  const flat = (
    <mesh position={[0, 0, WALL_Z + 0.0505]} receiveShadow>
      <planeGeometry args={[w, h]} />
      <meshStandardMaterial map={texture} roughness={1} />
    </mesh>
  )

  return (
    <>
    <group position={[slot.x, slot.y, slot.z]} rotation={[0, slot.rotationY, 0]}>
      {/* Passe-partout: yeso un poco más profundo que el objeto. */}
      <mesh position={[0, 0, WALL_Z + 0.025]} castShadow receiveShadow>
        <boxGeometry args={[ow, oh, 0.05]} />
        <meshStandardMaterial color={matColor} roughness={roughness} flatShading />
      </mesh>
      {!diorama && flat}
      {bars.map(([x, y, bw, bh], i) => (
        <group key={i} position={[x, y, WALL_Z + FRAME_DEPTH / 2]}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[bw, bh, FRAME_DEPTH]} />
            <meshStandardMaterial color={frame} roughness={0.9} flatShading />
          </mesh>
          {/* Filete biselado: una pestaña más delgada y saliente. */}
          <mesh position={[0, 0, FRAME_DEPTH / 2 + 0.01]} castShadow>
            <boxGeometry args={[bw * (bw > bh ? 0.97 : 0.55), bh * (bw > bh ? 0.55 : 0.97), 0.02]} />
            <meshStandardMaterial color={frame} roughness={0.9} flatShading />
          </mesh>
        </group>
      ))}
      <Suspense fallback={null}>
        {/* Cartela de yeso bajo el cuadro: legible sobre cualquier pared. */}
        <group position={[0, bottom - 0.22, WALL_Z + 0.03]}>
          <LabelPlate
            font={FONT_BODY}
            fontSize={slot.main ? 0.085 : 0.07}
            maxWidth={Math.max(slot.maxWidth, 1.6)}
            surface={theme.ui.tokens.surface}
            ink={theme.ui.tokens.ink}
          >
            {creditLine(image)}
          </LabelPlate>
        </group>
      </Suspense>
    </group>
    {diorama && (
      <Suspense fallback={<group position={[slot.x, slot.y, slot.z]} rotation={[0, slot.rotationY, 0]}>{flat}</group>}>
        <PortalPainting
          id={`portal:${roomId ?? slot.side}`}
          diorama={diorama}
          texture={texture}
          bare
          position={portalPos}
          rotationY={slot.rotationY}
          width={w}
          height={h}
          roomId={roomId}
        />
      </Suspense>
    )}
    </>
  )
}
