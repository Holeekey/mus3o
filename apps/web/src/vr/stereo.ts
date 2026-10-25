import * as THREE from 'three'
import { lensShift, usesDistortion, type Calib } from './calib'

// Estéreo lado a lado para el modo cardboard, con corrección de lente (distorsión de barril) y centro de imagen por lente.
// Si no hay corrección (k1 = k2 = 0 y lens = 0) se dibuja directo a la pantalla, sin pasada extra.

const stereo = new THREE.StereoCamera()
stereo.aspect = 0.5
const _size = new THREE.Vector2()

const VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`

// Cada mitad de pantalla (un ojo) se rehace desde la textura de ese ojo: d = posición respecto al centro de la lente en
// unidades de media altura; el radio de origen crece con r² y r⁴ (barril), y `zoom` deja el borde vertical justo en la textura.
const FRAG = /* glsl */ `
uniform sampler2D tex;
uniform vec2 k;        // k1, k2
uniform float shift;   // desplazamiento del centro de la lente hacia el centro de la pantalla (fracción de la mitad)
uniform float aspect;  // ancho / alto de una mitad
uniform float zoom;
varying vec2 vUv;
void main() {
  bool right = vUv.x >= 0.5;
  vec2 uv = vec2(right ? (vUv.x - 0.5) * 2.0 : vUv.x * 2.0, vUv.y);
  float cx = 0.5 + (right ? -shift : shift);
  vec2 d = (uv - vec2(cx, 0.5)) * vec2(aspect * 2.0, 2.0);
  float r2 = dot(d, d);
  d *= (1.0 + k.x * r2 + k.y * r2 * r2) * zoom;
  vec2 src = vec2(0.5) + d / vec2(aspect * 2.0, 2.0);
  if (src.x < 0.0 || src.x > 1.0 || src.y < 0.0 || src.y > 1.0) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
  src.x = right ? 0.5 + src.x * 0.5 : src.x * 0.5;
  gl_FragColor = vec4(texture2D(tex, src).rgb, 1.0);
  #include <colorspace_fragment>
}
`

let rt: THREE.WebGLRenderTarget | null = null
let post: { scene: THREE.Scene; cam: THREE.OrthographicCamera; mat: THREE.ShaderMaterial } | null = null

function ensure(w: number, h: number) {
  if (!rt) {
    rt = new THREE.WebGLRenderTarget(w, h, { depthBuffer: true, samples: 2 })
    // sRGB en la textura: el hardware codifica al escribir y decodifica al leer, sin perder precisión en sombras con 8 bits.
    rt.texture.colorSpace = THREE.SRGBColorSpace
    rt.texture.minFilter = rt.texture.magFilter = THREE.LinearFilter
  } else if (rt.width !== w || rt.height !== h) rt.setSize(w, h)
  if (!post) {
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: { tex: { value: rt.texture }, k: { value: new THREE.Vector2() }, shift: { value: 0 }, aspect: { value: 1 }, zoom: { value: 1 } },
      depthTest: false,
      depthWrite: false,
    })
    const scene = new THREE.Scene()
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat)
    quad.frustumCulled = false
    scene.add(quad)
    post = { scene, cam: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), mat }
  }
  post.mat.uniforms.tex.value = rt.texture
}

export function disposeStereo(): void {
  rt?.dispose()
  post?.mat.dispose()
  rt = null
  post = null
}

/** Escala que deja el borde vertical de cada ojo justo en el borde de la textura tras la distorsión. */
export const edgeZoom = (k1: number, k2: number) => 1 / (1 + k1 + k2)

/** Dos vistas lado a lado. La matriz del mundo se calcula una vez y no dos. `cssWidth`: ancho de la pantalla en píxeles CSS. */
export function renderStereo(gl: THREE.WebGLRenderer, scene: THREE.Scene, cam: THREE.PerspectiveCamera, c: Calib, cssWidth: number): void {
  gl.getDrawingBufferSize(_size)
  const w = _size.x
  const h = _size.y
  stereo.eyeSep = c.ipd
  scene.updateMatrixWorld()
  cam.updateMatrixWorld()
  stereo.update(cam)
  const auto = scene.matrixWorldAutoUpdate
  scene.matrixWorldAutoUpdate = false
  const distort = usesDistortion(c)
  if (distort) {
    ensure(w, h)
    gl.setRenderTarget(rt)
  }
  gl.setScissorTest(true)
  gl.setScissor(0, 0, w / 2, h)
  gl.setViewport(0, 0, w / 2, h)
  gl.render(scene, stereo.cameraL)
  gl.setScissor(w / 2, 0, w / 2, h)
  gl.setViewport(w / 2, 0, w / 2, h)
  gl.render(scene, stereo.cameraR)
  gl.setScissorTest(false)
  scene.matrixWorldAutoUpdate = auto
  if (distort && post) {
    gl.setRenderTarget(null)
    gl.setViewport(0, 0, w, h)
    const u = post.mat.uniforms
    ;(u.k.value as THREE.Vector2).set(c.k1, c.k2)
    u.shift.value = lensShift(c, cssWidth)
    u.aspect.value = w / 2 / h
    u.zoom.value = edgeZoom(c.k1, c.k2)
    const autoClear = gl.autoClear
    gl.autoClear = true
    gl.render(post.scene, post.cam)
    gl.autoClear = autoClear
  }
}
