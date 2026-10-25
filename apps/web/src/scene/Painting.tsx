import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { CanvasTexture, Color, SRGBColorSpace, TextureLoader, type Texture } from 'three'
import { type Diorama, type ImageSearch } from '@mus3o/shared'
import { capTextureSize } from '../lib/capTexture'
import { usePhotoDiorama } from '../diorama/usePhotoDiorama'
import { creditLine, userImageAsResolved, useResolvedImage } from '../lib/images'
import { useIntro } from '../intro/store'
import { buildFrameGeometry } from './frameGeometry'
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
        capTextureSize(texture)
        texture.colorSpace = SRGBColorSpace
        texture.anisotropy = 4
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

/** Lienzo de yeso con el título de la sala: es el cuadro-portal mientras no hay imagen (o si nunca la hay). */
function usePlasterCanvas(enabled: boolean, title: string, plaster: string, trim: string, ink: string, font: string): Texture | null {
  const tex = useMemo(() => {
    if (!enabled || typeof document === 'undefined') return null
    const c = document.createElement('canvas')
    c.width = 1024
    c.height = 768
    const g = c.getContext('2d')
    if (!g) return null
    g.fillStyle = plaster
    g.fillRect(0, 0, c.width, c.height)
    g.strokeStyle = trim
    g.lineWidth = 6
    g.strokeRect(40, 40, c.width - 80, c.height - 80)
    g.lineWidth = 2
    g.strokeRect(58, 58, c.width - 116, c.height - 116)
    g.fillStyle = ink
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    // Título en varias líneas, a ~26 caracteres por línea.
    const words = title.trim().split(/\s+/)
    const lines: string[] = []
    for (const w of words) {
      const last = lines[lines.length - 1]
      if (last !== undefined && (last + ' ' + w).length <= 22) lines[lines.length - 1] = last + ' ' + w
      else lines.push(w)
    }
    const shown = lines.slice(0, 4)
    const size = shown.length > 2 ? 78 : 96
    g.font = `600 ${size}px ${font}`
    const top = c.height / 2 - ((shown.length - 1) * size * 1.15) / 2 - 24
    shown.forEach((l, i) => g.fillText(l, c.width / 2, top + i * size * 1.15, c.width - 200))
    g.globalAlpha = 0.55
    g.font = `500 34px ${font}`
    g.fillText('◇   mus3o   ◇', c.width / 2, c.height - 120)
    const t = new CanvasTexture(c)
    t.colorSpace = SRGBColorSpace
    t.anisotropy = 4
    return t
  }, [enabled, title, plaster, trim, ink, font])
  useEffect(() => () => tex?.dispose(), [tex])
  return tex
}

/** Cuadro enmarcado con su placa. No dibuja nada hasta que la imagen carga. */
export function Painting({
  slot,
  search,
  userImage,
  palette,
  theme,
  diorama: libraryDiorama,
  roomId,
  title,
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
  /** Título de la sala: rotula el lienzo de yeso cuando el cuadro aún no tiene imagen. */
  title?: string
}) {
  const resolved = useResolvedImage(userImage ? undefined : search)
  const image = userImage ? userImageAsResolved(userImage.src, userImage.title) : resolved
  // Diorama de la biblioteca (hecho a mano) manda; si no hay, el cuadro principal pide recrear su foto real.
  // Si la foto no es una escena (retrato, diagrama...) o no hay IA, el cuadro queda normal, sin portal.
  const photoDiorama = usePhotoDiorama({ enabled: Boolean(slot.main && !libraryDiorama && !userImage), image, roomId, roomTitle: title })
  const diorama = libraryDiorama ?? photoDiorama ?? undefined
  const texture = useTexture(image?.src)
  const isIntroPlaying = useIntro((s) => s.phase === 'playing')
  const activeTexture = isIntroPlaying ? null : texture
  // Toda sala con diorama es entrable: sin imagen (o hasta que cargue) el cuadro es un lienzo de yeso con el título.
  const plaster = usePlasterCanvas(Boolean(diorama) && !isIntroPlaying && !activeTexture, title ?? diorama?.title ?? '', theme.scene.pedestal.color, palette.trim, palette.ink, theme.ui.fonts.display)
  const portalTexture = activeTexture ?? plaster
  const showImagePlate = Boolean(image && texture && !isIntroPlaying)
  const matColor = useMemo(() => new Color(theme.scene.object.color).multiplyScalar(0.92), [theme])

  const hasTexture = Boolean(image && texture)
  const imgAspect = texture?.image
    ? (texture.image as { width: number; height: number }).width /
      (texture.image as { width: number; height: number }).height
    : 4 / 3
  const aspect = Number.isFinite(imgAspect) && imgAspect > 0 ? imgAspect : 4 / 3
  const maxW = slot.maxWidth - 2 * (FRAME_T + MAT)
  const maxH = slot.maxHeight - 2 * (FRAME_T + MAT)
  const w = Math.min(maxW, maxH * aspect)
  const h = w / aspect
  const ow = w + 2 * MAT // abertura del marco
  const oh = h + 2 * MAT
  const roughness = theme.scene.object.roughness
  const frame = palette.trim

  // Las ocho piezas del marco son una sola geometría (una malla, un draw call).
  const frameGeo = useMemo(() => buildFrameGeometry(ow, oh, FRAME_T, FRAME_DEPTH, WALL_Z), [ow, oh])
  useEffect(() => () => frameGeo.dispose(), [frameGeo])
  const bottom = -oh / 2 - FRAME_T

  // Centro de la obra en el mundo (mismo plano que el cuadro plano), para el portal.
  const pz = WALL_Z + 0.0505
  const portalPos: [number, number, number] = [slot.x + Math.sin(slot.rotationY) * (pz + 0.002), slot.y, slot.z + Math.cos(slot.rotationY) * (pz + 0.002)]
  const flat = (
    <mesh position={[0, 0, WALL_Z + 0.0505]} receiveShadow>
      <planeGeometry args={[w, h]} />
      {/* key distinta por variante: three.js compila el shader sin textura si se reutiliza el
          material del placeholder y solo se le asigna `map` después (el lienzo queda negro). */}
      {hasTexture && activeTexture ? (
        <meshStandardMaterial key={activeTexture.uuid} map={activeTexture} roughness={1} />
      ) : (
        <meshStandardMaterial key="placeholder" color={matColor} roughness={0.95} />
      )}
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
      <mesh geometry={frameGeo} castShadow receiveShadow>
        <meshStandardMaterial color={frame} roughness={0.9} flatShading />
      </mesh>
      {(showImagePlate || (diorama && !isIntroPlaying)) && (
        <Suspense fallback={null}>
          {/* Cartela de yeso bajo el cuadro: legible sobre cualquier pared. Sin imagen, rotula la sala. */}
          <group position={[0, bottom - 0.22, WALL_Z + 0.03]}>
            <LabelPlate
              font={FONT_BODY}
              fontSize={slot.main ? 0.085 : 0.07}
              maxWidth={Math.max(slot.maxWidth, 1.6)}
              cullDistance={10}
              surface={theme.ui.tokens.surface}
              ink={theme.ui.tokens.ink}
            >
              {showImagePlate && image ? creditLine(image) : (title ?? diorama?.title ?? '')}
            </LabelPlate>
          </group>
        </Suspense>
      )}
    </group>
    {diorama && !isIntroPlaying && portalTexture && (
      <Suspense fallback={<group position={[slot.x, slot.y, slot.z]} rotation={[0, slot.rotationY, 0]}>{flat}</group>}>
        <PortalPainting
          id={`portal:${roomId ?? slot.side}`}
          diorama={diorama}
          texture={portalTexture}
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
