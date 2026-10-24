import { addAfterEffect, useFrame, useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import * as THREE from 'three'

// Solo desarrollo: `?perf` muestra FPS, p95 del frame y contadores de gl.info. No añade dependencias
// ni re-renderiza React: escribe en un div propio una vez por segundo.

/** Contadores que otros módulos (portales) actualizan para que el overlay los muestre. */
export const perfFlags = { portalsRendering: 0 }

export const perfEnabled = () => typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('perf')

export type PerfSnapshot = {
  fps: number
  p95: number
  calls: number
  triangles: number
  geometries: number
  textures: number
  lights: number
  shadowLights: number
  portals: number
}

declare global {
  interface Window {
    __perf?: PerfSnapshot
    __three?: { gl: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.Camera }
  }
}

const countLights = (scene: THREE.Scene) => {
  let lights = 0
  let shadow = 0
  scene.traverse((o) => {
    const l = o as THREE.Light
    if (l.isLight) {
      lights++
      if (l.castShadow) shadow++
    }
  })
  return { lights, shadow }
}

export function PerfOverlay() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)

  useEffect(() => {
    window.__three = { gl, scene, camera }
  }, [gl, scene, camera])

  useEffect(() => {
    // gl.info.render se reinicia en cada render() (portales y sombras incluidos); con autoReset=false
    // se acumula el frame entero y se reinicia a mano al principio del siguiente.
    gl.info.autoReset = false
    const el = document.createElement('div')
    el.style.cssText =
      'position:fixed;top:8px;left:8px;z-index:99999;padding:6px 8px;font:11px/1.35 ui-monospace,Consolas,monospace;color:#9f9;background:rgba(0,0,0,.72);pointer-events:none;white-space:pre'
    document.body.appendChild(el)
    const times: number[] = []
    let prev = performance.now()
    let calls = 0
    let tris = 0
    let frames = 0
    const stopAfter = addAfterEffect(() => {
      const now = performance.now()
      times.push(now - prev)
      prev = now
      calls += gl.info.render.calls
      tris += gl.info.render.triangles
      frames++
    })
    const timer = window.setInterval(() => {
      const sorted = [...times].sort((a, b) => a - b)
      const p95 = sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] : 0
      const mean = times.length ? times.reduce((a, b) => a + b, 0) / times.length : 0
      const { lights, shadow } = countLights(scene)
      const snap: PerfSnapshot = {
        fps: mean ? 1000 / mean : 0,
        p95,
        calls: frames ? Math.round(calls / frames) : 0,
        triangles: frames ? Math.round(tris / frames) : 0,
        geometries: gl.info.memory.geometries,
        textures: gl.info.memory.textures,
        lights,
        shadowLights: shadow,
        portals: perfFlags.portalsRendering,
      }
      window.__perf = snap
      el.textContent =
        `${snap.fps.toFixed(0)} fps   p95 ${snap.p95.toFixed(1)} ms
` +
        `calls ${snap.calls}   tris ${snap.triangles}
` +
        `geom ${snap.geometries}   tex ${snap.textures}
` +
        `lights ${snap.lights} (shadow ${snap.shadowLights})   portal ${snap.portals ? 'ON' : 'off'}`
      times.length = 0
      calls = tris = frames = 0
    }, 1000)
    return () => {
      stopAfter()
      window.clearInterval(timer)
      el.remove()
      gl.info.autoReset = true
    }
  }, [gl, scene])

  // Prioridad negativa: corre antes que el resto y antes del render, sin desactivar el render automático.
  useFrame(() => {
    gl.info.reset()
  }, -1000)
  return null
}
