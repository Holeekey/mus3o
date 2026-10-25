import * as THREE from 'three'
import { eyeShiftNdc, type Calib } from './calib'

// Estéreo lado a lado para el modo cardboard. Cada ojo se dibuja directo a su mitad de la pantalla (viewport + scissor, sin textura intermedia).
// La separación entre lentes se logra desplazando el punto principal de la proyección (off-axis), así la imagen siempre llena su mitad.

const stereo = new THREE.StereoCamera()
stereo.aspect = 0.5
const _size = new THREE.Vector2()

// StereoCamera cachea sus matrices y solo las recalcula si cambian sus parámetros: no se mutan sus proyecciones.
// Cada ojo tiene una cámara propia a la que se copia la proyección y se aplica el desplazamiento absoluto en cada frame.
const eyeL = new THREE.PerspectiveCamera()
const eyeR = new THREE.PerspectiveCamera()
for (const e of [eyeL, eyeR]) {
  e.matrixAutoUpdate = false
  e.matrixWorldAutoUpdate = false
}

/**
 * Desplaza el punto principal `dx` (NDC horizontal): P' = T(dx)·P. En una perspectiva x_ndc = P00·x/w + P02·z/w con w = -z,
 * o sea x_ndc = P00·x/w − P02: restar dx a P02 (elements[8], fila 0 columna 2 en column-major) mueve la imagen +dx hacia la derecha.
 */
export function shiftPrincipalPoint(m: THREE.Matrix4, dx: number): void {
  m.elements[8] -= dx
}

function aim(eye: THREE.PerspectiveCamera, src: THREE.PerspectiveCamera, dx: number) {
  eye.matrixWorld.copy(src.matrixWorld)
  // StereoCamera solo actualiza matrixWorldInverse al dibujar (con un frame de retraso): se calcula aqui desde matrixWorld.
  eye.matrixWorldInverse.copy(eye.matrixWorld).invert()
  eye.projectionMatrix.copy(src.projectionMatrix)
  shiftPrincipalPoint(eye.projectionMatrix, dx)
  eye.projectionMatrixInverse.copy(eye.projectionMatrix).invert()
}

/** Dos vistas lado a lado. La matriz del mundo se calcula una vez y no dos. `cssWidth`: ancho de la pantalla en píxeles CSS. */
export function renderStereo(gl: THREE.WebGLRenderer, scene: THREE.Scene, cam: THREE.PerspectiveCamera, c: Calib, cssWidth: number): void {
  // setViewport/setScissor van en píxeles CSS (three los multiplica por el pixelRatio): no usar el tamaño del buffer.
  gl.getSize(_size)
  const w = _size.x
  const h = _size.y
  stereo.eyeSep = c.ipd
  scene.updateMatrixWorld()
  cam.updateMatrixWorld()
  stereo.update(cam)
  // El ojo izquierdo desplaza su imagen hacia el centro de la pantalla (derecha, +) y el derecho hacia la izquierda (−).
  const shift = eyeShiftNdc(c, cssWidth)
  aim(eyeL, stereo.cameraL, shift)
  aim(eyeR, stereo.cameraR, -shift)
  const auto = scene.matrixWorldAutoUpdate
  scene.matrixWorldAutoUpdate = false
  gl.setScissorTest(true)
  gl.setScissor(0, 0, w / 2, h)
  gl.setViewport(0, 0, w / 2, h)
  gl.render(scene, eyeL)
  gl.setScissor(w / 2, 0, w / 2, h)
  gl.setViewport(w / 2, 0, w / 2, h)
  gl.render(scene, eyeR)
  gl.setScissorTest(false)
  scene.matrixWorldAutoUpdate = auto
}
