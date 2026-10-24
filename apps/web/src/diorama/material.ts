import * as THREE from 'three'

// Un único material (y su gemelo para el mapa de sombras) mueve todo el diorama: el viento
// vive en la GPU, leído de aWind (x = balanceo, y = ondulación de tela), sin coste de CPU.
// Mate, color por vértice, sombreado plano. Sin brillo ni emisión.

export type TimeUniform = { value: number }

const WIND_GLSL = /* glsl */ `
  vec3 transformed = vec3( position );
  vec2 ip = vec2( 0.0 );
  #ifdef USE_INSTANCING
    ip = instanceMatrix[ 3 ].xz;
  #endif
  float ph = ip.x * 0.37 + ip.y * 0.51;
  float sw = aWind.x;
  float wv = aWind.y;
  transformed.x += sin( uTime * 1.25 + ph ) * sw + sin( uTime * 2.3 + ph * 1.7 ) * sw * 0.3;
  transformed.z += cos( uTime * 1.05 + ph * 1.3 ) * sw * 0.7;
  float w = ( position.x + position.z ) * 3.2 - uTime * 4.6 + ph;
  transformed.z += sin( w ) * wv + sin( w * 2.1 + 1.3 ) * wv * 0.25;
  transformed.x += cos( w * 1.1 ) * wv * 0.3;
  transformed.y += cos( w * 0.9 ) * wv * 0.18;
`

function patch(m: THREE.Material, time: TimeUniform, key: string) {
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = time
    shader.vertexShader = 'attribute vec2 aWind;\nuniform float uTime;\n' + shader.vertexShader.replace('#include <begin_vertex>', WIND_GLSL)
  }
  m.customProgramCacheKey = () => key
}

export function makeDioramaMaterials(time: TimeUniform) {
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95, metalness: 0 })
  patch(material, time, 'diorama-wind')
  const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking })
  patch(depth, time, 'diorama-wind-depth')
  return { material, depth }
}
