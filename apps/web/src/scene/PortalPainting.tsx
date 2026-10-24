import { Text } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { atmosphereOf } from '../diorama/atmosphere'
import { DioramaScene } from '../diorama/DioramaScene'
import { useDioramaStore } from '../diorama/dioramaStore'
import type { Diorama } from '@mus3o/shared'
import { warmDioramaModel } from '../diorama/model'
import { LitePortal } from './LitePortal'

const FONT_BODY = '/fonts/HankenGrotesk.ttf'

// Distancias (m) de la disolución cuadro → ventana y de la invitación a entrar.
export const FADE_FAR = 6
export const FADE_NEAR = 2
export const ENTER_RANGE = 1.9
const MOUNT_RANGE = 10 // más cerca que esto se monta el diorama (aún tapado por el cuadro) para tenerlo listo
const UNMOUNT_RANGE = 16 // histéresis: más lejos que esto se desmonta y libera memoria
const PORTAL_VIEW_WIDTH = 14.6 // m de diorama visibles en el plano del cuadro
const PORTAL_PLANE_Z = 5 // z del diorama que coincide con el plano del cuadro

const smoothstep = (a: number, b: number, v: number) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

export type PortalPaintingProps = {
  id?: string
  diorama: Diorama
  /** Imagen del cuadro (CORS abierto). Sin ella se muestra un tono liso. */
  imageUrl?: string
  /** Centro del cuadro. */
  position: [number, number, number]
  /** 0 = el cuadro mira a +z. */
  rotationY: number
  width: number
  height: number
  /** Colores de la sala para el marco y la cartela. */
  palette?: { trim?: string; ink?: string; wall?: string }
  roomId?: string
  title?: string
  /**
   * Cuadro ya cargado y recortado al aspecto `width / height` (lo aporta Painting). Con él no se
   * descarga `imageUrl`, y con `bare` solo se dibuja la ventana: marco y cartela los pone quien llama.
   */
  texture?: THREE.Texture | null
  bare?: boolean
}

function usePaintingTexture(url: string | undefined, aspect: number) {
  const [tex, setTex] = useState<THREE.Texture | null>(null)
  useEffect(() => {
    if (!url) return
    let dead = false
    const loader = new THREE.TextureLoader()
    loader.setCrossOrigin('anonymous')
    loader.load(
      url,
      (t) => {
        if (dead) return t.dispose()
        t.colorSpace = THREE.SRGBColorSpace
        t.anisotropy = 8
        // recorte tipo "cover" para no deformar la obra
        const img = t.image as { width: number; height: number }
        const ia = img.width / img.height
        if (ia > aspect) {
          t.repeat.set(aspect / ia, 1)
          t.offset.set((1 - aspect / ia) / 2, 0)
        } else {
          t.repeat.set(1, ia / aspect)
          t.offset.set(0, (1 - ia / aspect) / 2)
        }
        setTex(t)
      },
      undefined,
      () => {}, // sin textura: el cuadro queda liso, el resto funciona igual
    )
    return () => {
      dead = true
    }
  }, [url, aspect])
  return tex
}

function Frame({ w, h, trim, bare }: { w: number; h: number; trim: string; bare?: boolean }) {
  const bw = 0.17
  const d = 0.13
  const lip = '#2a1c12'
  const mat = <meshStandardMaterial color={trim} roughness={0.85} flatShading />
  return (
    <group>
      {!bare && <OuterFrame w={w} h={h} bw={bw} d={d} mat={mat} />}
      {/* labio interior oscuro: tapa el borde de la ventana */}
      <mesh position={[0, h / 2 - 0.015, 0.05]}>
        <boxGeometry args={[w, 0.03, 0.1]} />
        <meshStandardMaterial color={lip} roughness={1} />
      </mesh>
      <mesh position={[0, -h / 2 + 0.015, 0.05]}>
        <boxGeometry args={[w, 0.03, 0.1]} />
        <meshStandardMaterial color={lip} roughness={1} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (w / 2 - 0.015), 0, 0.05]}>
          <boxGeometry args={[0.03, h, 0.1]} />
          <meshStandardMaterial color={lip} roughness={1} />
        </mesh>
      ))}
    </group>
  )
}

function OuterFrame({ w, h, bw, d, mat }: { w: number; h: number; bw: number; d: number; mat: React.ReactElement }) {
  return (
    <group>
      {/* marco principal */}
      <mesh position={[0, h / 2 + bw / 2, d / 2]} castShadow receiveShadow>
        <boxGeometry args={[w + bw * 2, bw, d]} />
        {mat}
      </mesh>
      <mesh position={[0, -h / 2 - bw / 2, d / 2]} castShadow receiveShadow>
        <boxGeometry args={[w + bw * 2, bw, d]} />
        {mat}
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (w / 2 + bw / 2), 0, d / 2]} castShadow receiveShadow>
          <boxGeometry args={[bw, h, d]} />
          {mat}
        </mesh>
      ))}
      {/* moldura exterior más fina, para dar relieve */}
      <mesh position={[0, h / 2 + bw + 0.025, d / 2 - 0.02]} castShadow>
        <boxGeometry args={[w + bw * 2 + 0.1, 0.05, d + 0.04]} />
        {mat}
      </mesh>
      <mesh position={[0, -h / 2 - bw - 0.025, d / 2 - 0.02]} castShadow>
        <boxGeometry args={[w + bw * 2 + 0.1, 0.05, d + 0.04]} />
        {mat}
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (w / 2 + bw + 0.025), 0, d / 2 - 0.02]} castShadow>
          <boxGeometry args={[0.05, h + bw * 2, d + 0.04]} />
          {mat}
        </mesh>
      ))}
    </group>
  )
}

/**
 * Un cuadro histórico que, al acercarte, se disuelve en una maqueta viva vista por el marco.
 * La ventana es un MeshPortalMaterial (perspectiva y paralaje correctos); el cuadro es un plano
 * con la textura delante cuya opacidad baja con la distancia.
 */
export function PortalPainting({ id = 'portal-0', diorama, imageUrl, position, rotationY, width, height, palette, roomId, title, texture, bare }: PortalPaintingProps) {
  const group = useRef<THREE.Group>(null)
  const paint = useRef<THREE.MeshBasicMaterial>(null)
  const camera = useThree((s) => s.camera)
  const gl = useThree((s) => s.gl)
  const loaded = usePaintingTexture(texture ? undefined : imageUrl, width / height)
  const tex = texture ?? loaded
  const [near, setNear] = useState(false)
  const hint = useRef<string | null>(null)

  const trim = palette?.trim ?? '#b88a35'
  // La ventana enmarca ~14,6 m del diorama en el plano del cuadro; el suelo arranca en el borde inferior.
  const unit = width / PORTAL_VIEW_WIDTH
  const fogRef = useRef<THREE.Fog>(null)
  const atmo = useMemo(() => atmosphereOf(diorama), [diorama])
  // Plano de corte: la maqueta no puede asomar por delante del cuadro.
  const clip = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 0, -1), 0), [])
  useEffect(() => {
    gl.localClippingEnabled = true
  }, [gl])
  useEffect(() => warmDioramaModel(diorama), [diorama])
  useLayoutEffect(() => {
    const g = group.current
    if (!g) return
    g.updateWorldMatrix(true, false)
    const n = new THREE.Vector3(0, 0, -1).transformDirection(g.matrixWorld)
    clip.setFromNormalAndCoplanarPoint(n, new THREE.Vector3().setFromMatrixPosition(g.matrixWorld))
  }, [clip, position, rotationY])

  useEffect(() => {
    const st = useDioramaStore.getState()
    st.registerPortal({ id, diorama, center: position, rotationY, width, height, roomId })
    return () => useDioramaStore.getState().unregisterPortal(id)
  }, [id, diorama, position, rotationY, width, height, roomId])

  const _c = useMemo(() => new THREE.Vector3(), [])
  const _n = useMemo(() => new THREE.Vector3(Math.sin(rotationY), 0, Math.cos(rotationY)), [rotationY])
  const _f = useMemo(() => new THREE.Vector3(), [])
  useFrame(() => {
    const phase = useDioramaStore.getState().phase
    const rel = _c.set(camera.position.x - position[0], camera.position.y - position[1], camera.position.z - position[2])
    const dist = rel.length()
    if (paint.current) {
      const o = phase === 'room' || phase === 'entering' ? smoothstep(FADE_NEAR, FADE_FAR, dist) : 1
      paint.current.opacity = o
      paint.current.visible = o > 0.003
    }
    // La niebla de la maqueta se mide desde el plano del cuadro, no desde la cámara.
    if (fogRef.current) {
      fogRef.current.near = dist + atmo.fogNear * 0.45 * unit
      fogRef.current.far = dist + atmo.fogFar * 1.0 * unit
    }
    const wantNear = dist < (near ? UNMOUNT_RANGE : MOUNT_RANGE) && phase !== 'inside'
    if (wantNear !== near) setNear(wantNear)

    // ¿Se puede entrar? Cerca, de frente al cuadro y mirándolo.
    let h: string | null = null
    if (phase === 'room' && dist <= ENTER_RANGE + 0.6) {
      camera.getWorldDirection(_f)
      const front = rel.dot(_n)
      const facing = -(_f.x * rel.x + _f.y * rel.y + _f.z * rel.z) / Math.max(dist, 0.001)
      if (front > 0.3 && facing > 0.55 && dist <= ENTER_RANGE) h = id
    }
    if (h !== hint.current) {
      hint.current = h
      const st = useDioramaStore.getState()
      if (h) st.setHint(h)
      else if (st.hintId === id) st.setHint(null)
    }
  })

  const plaqueW = Math.min(width * 0.7, 1.5)
  return (
    <group ref={group} position={position} rotation={[0, rotationY, 0]}>
      <Frame w={width} h={height} trim={trim} bare={bare} />
      {/* ventana: el diorama solo se dibuja a menos de FADE_FAR (más lejos el cuadro opaco lo tapa) */}
      {near && (
        <LitePortal id={id} width={width} height={height} renderRange={FADE_FAR + 0.3}>
          <color attach="background" args={[atmo.skyHorizon]} />
          <fog ref={fogRef} attach="fog" args={[atmo.fog, 5, 30]} />
          <group position={[0, -height / 2 - 0.1, -PORTAL_PLANE_Z * unit]}>
            <DioramaScene diorama={diorama} unit={unit} shadowMapSize={1024} clip={clip} staticShadows />
          </group>
        </LitePortal>
      )}
      {/* el cuadro, por delante de la ventana */}
      <mesh position={[0, 0, 0.012]} renderOrder={2}>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial key={tex ? tex.uuid : 'plain'} ref={paint} map={tex} color={tex ? '#ffffff' : '#6b5a44'} transparent toneMapped={false} />
      </mesh>
      {/* cartela */}
      {!bare && (
        <>
          <mesh position={[0, -height / 2 - 0.42, 0.03]} castShadow receiveShadow>
            <boxGeometry args={[plaqueW, 0.3, 0.05]} />
            <meshStandardMaterial color="#efece5" roughness={0.9} flatShading />
          </mesh>
          <Suspense fallback={null}>
            <Text position={[0, -height / 2 - 0.42, 0.06]} font={FONT_BODY} fontSize={0.055} maxWidth={plaqueW - 0.14} textAlign="center" anchorY="middle" color={palette?.ink ?? '#1f1411'}>
              {title ?? diorama.title}
            </Text>
          </Suspense>
        </>
      )}
    </group>
  )
}
