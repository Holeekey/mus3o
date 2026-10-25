import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { Suspense, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useDioramaStore } from '../diorama/dioramaStore'
import { isListeningNow, isSpeakingNow } from '../lib/voice'
import { useStore } from '../store'
import { ARIS_OFFSET, arisVisible } from './arisAnchor'
import { arisActivity, isArisPending, profileFacing } from './arisPose'

const MODEL_PATH = '/models/aris-v2/model.glb'

// Objetos reutilizables en memoria para evitar allocations en el render loop (0 GC)
const _targetPos = new THREE.Vector3()
const _forward = new THREE.Vector3()
const _right = new THREE.Vector3()
const _velocity = new THREE.Vector3()
const _lookTarget = new THREE.Vector3()
const _dummy = new THREE.Object3D()
const _profile = { x: 0, z: 0 }

const DOT_COUNT = 3

function ArisModelInner() {
  const { scene } = useGLTF(MODEL_PATH)
  const clonedScene = useMemo(() => scene.clone(), [scene])
  // Altura del modelo (en sus unidades) para colocar el indicador de "pensando" sobre la cabeza
  const size = useMemo(() => {
    const box = new THREE.Box3().setFromObject(clonedScene)
    return { top: box.max.y, height: Math.max(0.1, box.max.y - box.min.y) }
  }, [clonedScene])
  const dotsRef = useRef<THREE.Group>(null)
  const dotRefs = useRef<(THREE.Mesh | null)[]>([])

  const groupRef = useRef<THREE.Group>(null)
  const currentPos = useRef(new THREE.Vector3())
  const lastPos = useRef(new THREE.Vector3())
  const initialized = useRef(false)

  // Control de lado (hombro derecho/izquierdo)
  const sideSign = useRef(1)
  const sideTimer = useRef(0)

  // Control de transiciones de sala (holograma que desaparece y reaparece)
  const lastRoomId = useRef<string | null>(null)
  const hologramScale = useRef(1)
  const isTransitioning = useRef(false)

  // Curioseo ("da vueltitas viendo todo")
  const curiousYaw = useRef(0)

  useFrame((state, delta) => {
    const group = groupRef.current
    if (!group) return

    // Dentro de un cuadro (y al entrar/salir) Aris se oculta; al volver reaparece junto al jugador.
    const visible = arisVisible(useDioramaStore.getState().phase)
    group.visible = visible
    if (!visible) {
      initialized.current = false
      return
    }

    const dt = Math.min(delta, 0.1)
    const t = state.clock.getElapsedTime()
    const camera = state.camera
    const currentRoom = useStore.getState().currentRoomId

    // 1. Inicialización en el primer frame en el campo de visión del jugador
    if (!initialized.current) {
      camera.getWorldDirection(_forward)
      _forward.y = 0
      _forward.normalize()
      _right.set(-_forward.z, 0, _forward.x)

      currentPos.current
        .copy(camera.position)
        .addScaledVector(_forward, ARIS_OFFSET.forward)
        .addScaledVector(_right, sideSign.current * ARIS_OFFSET.side)
      currentPos.current.y = camera.position.y - ARIS_OFFSET.down

      lastPos.current.copy(currentPos.current)
      group.position.copy(currentPos.current)
      lastRoomId.current = currentRoom
      initialized.current = true
      return
    }

    // 2. Detección de cambio de sala: solo si ya estaba en una sala válida previa
    if (lastRoomId.current === null) {
      lastRoomId.current = currentRoom
    } else if (currentRoom && currentRoom !== lastRoomId.current) {
      lastRoomId.current = currentRoom
      isTransitioning.current = true
    }

    if (isTransitioning.current) {
      // Reducción rápida de escala (desaparición holográfica)
      hologramScale.current = Math.max(0, hologramScale.current - dt * 6)
      if (hologramScale.current <= 0.01) {
        // Teletransportación instantánea al campo de visión del jugador en la nueva sala
        camera.getWorldDirection(_forward)
        _forward.y = 0
        _forward.normalize()
        _right.set(-_forward.z, 0, _forward.x)

        currentPos.current
          .copy(camera.position)
          .addScaledVector(_forward, ARIS_OFFSET.forward)
          .addScaledVector(_right, sideSign.current * ARIS_OFFSET.side)
        currentPos.current.y = camera.position.y - ARIS_OFFSET.down

        lastPos.current.copy(currentPos.current)
        group.position.copy(currentPos.current)
        isTransitioning.current = false
      }
    } else {
      // Reaparición elástica suave
      hologramScale.current = Math.min(1, hologramScale.current + dt * 4.5)
    }

    // 3. Alternancia periódica de lado (cambia suavemente entre derecha e izquierda)
    sideTimer.current += dt
    if (sideTimer.current > 14) {
      sideSign.current *= -1
      sideTimer.current = 0
    }

    // 4. Cálculo del punto de anclaje DENTRO de la pantalla (FOV 70°)
    camera.getWorldDirection(_forward)
    _forward.y = 0
    _forward.normalize()
    _right.set(-_forward.z, 0, _forward.x)

    _targetPos
      .copy(camera.position)
      .addScaledVector(_forward, ARIS_OFFSET.forward) // Adelante en el campo visual
      .addScaledVector(_right, sideSign.current * ARIS_OFFSET.side) // Al lateral visible de la pantalla
    _targetPos.y = camera.position.y - ARIS_OFFSET.down

    // 5. Seguimiento con Lerp elástico (framerate-independent exponential decay)
    const followFactor = 1 - Math.exp(-6.0 * dt)
    currentPos.current.lerp(_targetPos, followFactor)

    // 6. Micro-animaciones: Flotación (Bobbing), Respiración y animación de habla
    // Qué está haciendo: escucharte (micrófono abierto), pensar (pregunta enviada, aún sin voz) o hablar (suena la voz;
    // silenciada, mientras el globo está visible).
    const st = useStore.getState()
    const activity = arisActivity({
      listening: isListeningNow(),
      pending: isArisPending(st.arisPendingSince, Date.now()),
      speaking: isSpeakingNow() || (st.arisMuted && !!st.arisMessage && st.arisPendingSince === null),
    })
    const bobbing = Math.sin(t * 2.4) * 0.07
    const breathing = Math.sin(t * 3.2) * 0.025
    const talkBob = activity === 'speaking' ? Math.sin(t * 9) * 0.035 : 0

    // Indicador de carga: tres puntos que saltan en onda sobre la cabeza mientras procesa
    const dots = dotsRef.current
    if (dots) {
      const thinking = activity === 'thinking'
      dots.visible = thinking
      if (thinking) {
        for (let i = 0; i < DOT_COUNT; i++) {
          const dot = dotRefs.current[i]
          if (!dot) continue
          const wave = 0.5 + 0.5 * Math.sin(t * 6 - i * 0.9)
          dot.position.y = wave * size.height * 0.07
          dot.scale.setScalar(0.65 + 0.55 * wave)
        }
      }
    }

    group.position.x = currentPos.current.x
    group.position.y = currentPos.current.y + bobbing + talkBob
    group.position.z = currentPos.current.z

    // 7. Estimación de velocidad para alternar entre modo vuelo y curioseo en reposo
    _velocity.copy(currentPos.current).sub(lastPos.current).divideScalar(dt)
    lastPos.current.copy(currentPos.current)
    const speed = _velocity.length()

    // 8. Mirada y orientación según la actividad:
    // - escuchándote o procesando tu pregunta: siempre de frente a ti
    // - hablando o explicando un concepto: de perfil (~90°), ni de frente ni de espaldas
    // - en reposo: casi siempre mirándote, con curioseo ocasional
    const cycleTime = t % 8.0
    const looksAtUser = cycleTime < 6.0

    if (activity === 'listening' || activity === 'thinking') {
      _lookTarget.copy(camera.position)
      _dummy.position.copy(group.position)
      _dummy.lookAt(_lookTarget)
      group.quaternion.slerp(_dummy.quaternion, 1 - Math.exp(-6 * dt))
    } else if (activity === 'speaking') {
      profileFacing(
        camera.position.x - group.position.x,
        camera.position.z - group.position.z,
        _right.x,
        _right.z,
        sideSign.current,
        _profile,
      )
      _lookTarget.set(group.position.x + _profile.x, group.position.y, group.position.z + _profile.z)
      _dummy.position.copy(group.position)
      _dummy.lookAt(_lookTarget)
      group.quaternion.slerp(_dummy.quaternion, 1 - Math.exp(-4.5 * dt))
    } else if (speed > 0.8) {
      // En desplazamiento rápido: se orienta hacia el vector de avance
      _lookTarget.copy(currentPos.current).add(_velocity)
      _lookTarget.y = group.position.y
      _dummy.position.copy(group.position)
      _dummy.lookAt(_lookTarget)
      group.quaternion.slerp(_dummy.quaternion, 1 - Math.exp(-6 * dt))
    } else if (looksAtUser) {
      // Mayoría del tiempo: contacto visual directo con el usuario (cámara)
      _lookTarget.copy(camera.position)
      _dummy.position.copy(group.position)
      _dummy.lookAt(_lookTarget)
      group.quaternion.slerp(_dummy.quaternion, 1 - Math.exp(-4.5 * dt))
    } else {
      // Curioseo ocasional (25% del tiempo): mira hacia adelante hacia donde explora el jugador
      _lookTarget.copy(camera.position).addScaledVector(_forward, 4)
      _lookTarget.y += Math.sin(t * 1.8) * 0.25
      _dummy.position.copy(group.position)
      _dummy.lookAt(_lookTarget)
      group.quaternion.slerp(_dummy.quaternion, 1 - Math.exp(-2.5 * dt))
    }

    // 9. Aplicación de escala con breathing y factor holográfico de sala
    const baseScale = 0.5 * hologramScale.current
    const sx = baseScale * (1 - breathing)
    const sy = baseScale * (1 + breathing)
    const sz = baseScale * (1 - breathing)
    group.scale.set(sx, sy, sz)
  })

  return (
    <group ref={groupRef}>
      {/* Rotación 180° en Y para alinear los ojos (+Z en glTF) con el eje de visión (-Z en Three.js lookAt) */}
      <primitive object={clonedScene} rotation={[0, Math.PI, 0]} castShadow receiveShadow />
      {/* Indicador de "pensando": tres puntos sobre la cabeza, solo visibles mientras procesa */}
      <group ref={dotsRef} position={[0, size.top + size.height * 0.22, 0]} visible={false}>
        {Array.from({ length: DOT_COUNT }, (_, i) => (
          <mesh
            key={i}
            ref={(m) => {
              dotRefs.current[i] = m
            }}
            position={[(i - 1) * size.height * 0.12, 0, 0]}
          >
            <sphereGeometry args={[size.height * 0.035, 12, 12]} />
            <meshBasicMaterial color="#9fe8ff" toneMapped={false} />
          </mesh>
        ))}
      </group>
    </group>
  )
}

export function ArisCompanion() {
  return (
    <Suspense fallback={null}>
      <ArisModelInner />
    </Suspense>
  )
}

useGLTF.preload(MODEL_PATH)
