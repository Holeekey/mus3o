import { useAnimations, useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'

const MODEL_PATH = '/models/parrot-filigree.glb'

// Colores distintivos del hackathon Platanus Hack [26]
const FEATHER_GREEN = new THREE.Color('#E1FF00') // Verde lima / acid neon icónico
const BODY_GREEN = new THREE.Color('#228B22') // Verde bosque esmeralda para el cuerpo

type ParrotModelProps = {
  scale?: number
  interactive?: boolean
}

export function ParrotModel({ scale = 4.2, interactive = true }: ParrotModelProps) {
  const animRef = useRef<THREE.Group>(null)
  const { scene, animations } = useGLTF(MODEL_PATH)
  const { actions } = useAnimations(animations, scene)

  // Aplicamos el color verde distintivo del hackathon a las plumas y cuerpo
  useEffect(() => {
    scene.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh
        if (mesh.material) {
          const mat = mesh.material as THREE.MeshStandardMaterial
          if (mat.name === 'feather') {
            mat.color.copy(FEATHER_GREEN)
            mat.roughness = 0.25
            mat.metalness = 0.3
            mat.needsUpdate = true
          } else if (mat.name === 'body') {
            mat.color.copy(BODY_GREEN)
            mat.roughness = 0.4
            mat.metalness = 0.1
            mat.needsUpdate = true
          }
        }
      }
    })
  }, [scene])

  // Configuración de animaciones: 'intro' una vez, encadenando a 'loop' continuo
  useEffect(() => {
    const intro = actions['intro']
    const loop = actions['loop']

    if (intro && loop) {
      intro.reset().setLoop(THREE.LoopOnce, 1).play()
      intro.clampWhenFinished = true

      const mixer = intro.getMixer()
      const onFinished = (e: { action: THREE.AnimationAction }) => {
        if (e.action === intro) {
          loop.reset().fadeIn(0.4).play()
        }
      }
      mixer.addEventListener('finished', onFinished)

      return () => {
        mixer.removeEventListener('finished', onFinished)
        intro.stop()
        loop.stop()
      }
    } else if (loop) {
      loop.reset().play()
      return () => {
        loop.stop()
      }
    }
  }, [actions])

  // Micro-movimiento sutil de respiración y paralaje reactivo
  useFrame((state, delta) => {
    const anim = animRef.current
    if (!anim) return

    const t = state.clock.elapsedTime
    // Flotación y balanceo orgánico leve
    anim.position.y = Math.sin(t * 1.8) * 0.03
    anim.position.x = Math.cos(t * 0.9) * 0.015

    if (interactive) {
      const targetRotY = Math.PI / 4 + state.pointer.x * 0.2
      const targetRotX = -state.pointer.y * 0.12
      anim.rotation.y = THREE.MathUtils.damp(anim.rotation.y, targetRotY, 4, delta)
      anim.rotation.x = THREE.MathUtils.damp(anim.rotation.x, targetRotX, 4, delta)
    }
  })

  // Centrado según el bounding box nativo del modelo
  return (
    <group ref={animRef} rotation={[0, Math.PI / 4, 0]}>
      <primitive object={scene} scale={scale} position={[0, 0, 0]} />
    </group>
  )
}

useGLTF.preload(MODEL_PATH)
