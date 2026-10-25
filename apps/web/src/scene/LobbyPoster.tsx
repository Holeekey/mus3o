import { Text } from '@react-three/drei'
import { useThree, type ThreeEvent } from '@react-three/fiber'
import { Suspense, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { DOOR_W, WALL_T, type RoomLayout } from '../palace/layout'
import { openProfile, type FounderTag } from './founderAim'
import { LabelPlate } from './LabelPlate'
import { ParrotModel } from './ParrotDiorama'

const FONT = '/fonts/PublicSansVariable.ttf'
const OFFSET = 0.06 // separación del muro, como los cuadros
const CORNER_MARGIN = 0.6 // aire hasta cada esquina (y hasta el hueco de una puerta)
const BOTTOM = 0.9 // borde inferior mínimo sobre el piso
const CORNICE_CLEAR = 0.28 + 0.35 // cornisa + aire bajo ella
const FRAME = 0.12
const DEPTH = 0.78 // vitrina sustancialmente más profunda para máxima presencia 3D
const SMOKE_GLASS = '#181A1C' // gris ahumado oscuro y opaco
const BRASS = '#C9963A'
const INK = '#1E1916'
const TARGET_URL = 'https://hack.platan.us/'
const ASPECT = 1.65 // proporción panorámica para el diorama enmarcado

// Tramo libre del muro oeste a lo largo de Z (coordenadas del mundo); si tiene puerta, la mitad más larga.
function freeSpan(room: RoomLayout): [number, number] {
  const a = room.z - room.d / 2 + WALL_T / 2 + CORNER_MARGIN
  const b = room.z + room.d / 2 - WALL_T / 2 - CORNER_MARGIN
  if (!room.doors.includes('w')) return [a, b]
  const gapA = room.z - DOOR_W / 2 - CORNER_MARGIN
  const gapB = room.z + DOOR_W / 2 + CORNER_MARGIN
  return gapA - a >= b - gapB ? [a, gapA] : [gapB, b]
}

function useDioramaPointer(interactive: boolean) {
  const canvas = useThree((s) => s.gl.domElement)
  const hovering = useRef(false)

  const setHover = (on: boolean) => {
    if (hovering.current === on) return
    hovering.current = on
    canvas.style.cursor = on ? 'pointer' : ''
  }

  useEffect(() => {
    if (!interactive) setHover(false)
  }, [interactive])
  useEffect(() => () => setHover(false), [])

  if (!interactive) return {}

  return {
    onClick: (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation()
      openProfile(TARGET_URL)
    },
    onPointerOver: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation()
      setHover(true)
    },
    onPointerOut: () => setHover(false),
  }
}

/**
 * Marco de vitrina de cristal gris ahumado oscuro y opaco con ribetes dorados finos.
 */
function TransparentVitrineFrame({ w, h, outerW, outerH }: { w: number; h: number; outerW: number; outerH: number }) {
  const frameMat = <meshStandardMaterial color={SMOKE_GLASS} roughness={0.35} metalness={0.15} />

  return (
    <group>
      {/* Molduras perimetrales */}
      <mesh position={[0, (h + FRAME) / 2, DEPTH / 2]}>
        <boxGeometry args={[outerW, FRAME, DEPTH]} />
        {frameMat}
      </mesh>
      <mesh position={[0, -(h + FRAME) / 2, DEPTH / 2]}>
        <boxGeometry args={[outerW, FRAME, DEPTH]} />
        {frameMat}
      </mesh>
      <mesh position={[-(w + FRAME) / 2, 0, DEPTH / 2]}>
        <boxGeometry args={[FRAME, h, DEPTH]} />
        {frameMat}
      </mesh>
      <mesh position={[(w + FRAME) / 2, 0, DEPTH / 2]}>
        <boxGeometry args={[FRAME, h, DEPTH]} />
        {frameMat}
      </mesh>

      {/* Finos soportes y ribetes dorados para definir la estructura */}
      <mesh position={[0, h / 2 - 0.008, DEPTH / 2]}>
        <boxGeometry args={[w, 0.016, DEPTH]} />
        <meshStandardMaterial color={BRASS} roughness={0.3} metalness={0.8} />
      </mesh>
      <mesh position={[0, -h / 2 + 0.008, DEPTH / 2]}>
        <boxGeometry args={[w, 0.016, DEPTH]} />
        <meshStandardMaterial color={BRASS} roughness={0.3} metalness={0.8} />
      </mesh>
      <mesh position={[-(w / 2 - 0.008), 0, DEPTH / 2]}>
        <boxGeometry args={[0.016, h, DEPTH]} />
        <meshStandardMaterial color={BRASS} roughness={0.3} metalness={0.8} />
      </mesh>
      <mesh position={[(w / 2 - 0.008), 0, DEPTH / 2]}>
        <boxGeometry args={[0.016, h, DEPTH]} />
        <meshStandardMaterial color={BRASS} roughness={0.3} metalness={0.8} />
      </mesh>

      {/* Cristal frontal de la vitrina en gris ahumado translúcido */}
      <mesh position={[0, 0, DEPTH - 0.005]}>
        <planeGeometry args={[w, h]} />
        <meshPhysicalMaterial
          color={SMOKE_GLASS}
          transparent
          opacity={0.4}
          roughness={0.08}
          transmission={0.6}
          thickness={0.05}
          ior={1.52}
          depthWrite={false}
        />
      </mesh>
    </group>
  )
}

function ParrotDioramaBox({ room, interactive }: { room: RoomLayout; interactive: boolean }) {
  const events = useDioramaPointer(interactive)

  const [z0, z1] = freeSpan(room)
  const top = room.height - CORNICE_CLEAR

  const maxW = z1 - z0 - FRAME * 2
  const maxH = top - BOTTOM - FRAME * 2
  const w = Math.min(maxW, maxH * ASPECT)
  const h = w / ASPECT
  const outerW = w + FRAME * 2
  const outerH = h + FRAME * 2
  const x = room.x - room.w / 2 + WALL_T / 2 + OFFSET
  const z = (z0 + z1) / 2
  const y = (BOTTOM + top) / 2

  const tag = useMemo<FounderTag>(
    () => ({
      name: 'Platanus Hack [26]',
      profile: TARGET_URL,
    }),
    [],
  )

  // Escala imponente y posición notablemente más baja en el cuadro
  const parrotScale = h * 3.25
  const parrotY = -h * 0.38

  return (
    // Muro oeste: mira hacia +x, al interior de la sala.
    <group position={[x, y, z]} rotation={[0, Math.PI / 2, 0]} userData={{ founder: tag }} {...events}>
      {/* Marco y caja vitrina de cristal gris transparente */}
      <TransparentVitrineFrame w={w} h={h} outerW={outerW} outerH={outerH} />

      {/* Panel posterior oscuro de la vitrina */}
      <mesh position={[0, 0, 0.005]}>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial color={SMOKE_GLASS} roughness={0.6} />
      </mesh>

      {/* Tipografía flotante del hackathon en la parte superior */}
      <group position={[0, h * 0.37, 0.04]}>
        <Text
          font={FONT}
          fontSize={0.35}
          color="#E1FF00"
          anchorX="center"
          anchorY="middle"
          letterSpacing={0.06}
        >
          PLATANUS HACK [26]
        </Text>
        <Text
          position={[0, -0.31, 0]}
          font={FONT}
          fontSize={0.18}
          color="#FFFFFF"
          fillOpacity={0.88}
          anchorX="center"
          anchorY="middle"
          letterSpacing={0.18}
        >
          VENEZUELA
        </Text>
      </group>

      {/* Iluminación propia de diorama: foco superior y luz puntual cálida */}
      <ambientLight intensity={1.3} />
      <pointLight position={[0, h * 0.3, DEPTH + 0.5]} color="#FFF1D0" intensity={20} distance={5} />
      <spotLight
        position={[0, h * 0.55, DEPTH + 1.2]}
        target-position={[0, 0, 0.28]}
        color="#FFF6DE"
        intensity={26}
        angle={Math.PI / 3}
        penumbra={0.6}
      />

      {/* Modelo 3D de la Guacamaya: contenido dentro de la vitrina con paralaje suave */}
      <group position={[0, parrotY, 0.28]}>
        <ParrotModel scale={parrotScale} lookAtPointer={true} />
      </group>

      {/* Créditos del asset en la esquina inferior derecha del marco */}
      <Text
        position={[w / 2 - 0.08, -h / 2 + 0.08, 0.04]}
        font={FONT}
        fontSize={0.065}
        color="#FFFFFF"
        fillOpacity={0.55}
        anchorX="right"
        anchorY="bottom"
        letterSpacing={0.04}
      >
        Asset © Platanus Hack [26] · Derechos reservados
      </Text>

      {/* Placa de museo explicativa bajo la vitrina */}
      <group position={[0, -outerH / 2 - 0.28, 0.02]}>
        <LabelPlate font={FONT} fontSize={0.13} maxWidth={outerW} surface={BRASS} ink={INK}>
          Platanus Hack [26]
        </LabelPlate>
      </group>
    </group>
  )
}

/** Cuadro diorama interactivo de la Guacamaya en el muro oeste del lobby. */
export function LobbyPoster({ room, interactive = false }: { room: RoomLayout; interactive?: boolean }) {
  return (
    <Suspense fallback={null}>
      <ParrotDioramaBox room={room} interactive={interactive} />
    </Suspense>
  )
}
