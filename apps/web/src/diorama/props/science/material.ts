import * as THREE from 'three'
import type { TimeUniform } from '../../material'
import { BEAT, PHASE0 } from './util'

// Material de los props científicos con animación en GPU. Igual que el del diorama (mate, color por
// vértice, sombreado plano, sin brillo) pero lee `aAnim = (modo, a, b, c)` por vértice:
//   1  valva: pétalo que se abre hacia el ventrículo siguiendo el latido (a = radio del anillo, b = centro y)
//   2  cuerda tendinosa: sigue a la valva por arriba y queda fija abajo (a = R, b = cy, c = z fija)
//   3  giro lento sobre Y (ADN): a = rad/s
//   4  latido: escala todo el órgano alrededor de (0, b, 0): a = amplitud
//   5  respiración (pulmones): a = amplitud, b = centro y
//   6  contracción de pared: empuja hacia +z; a = amplitud, b = extensión, c = centro y
// Con flatShading las normales salen de las derivadas de pantalla, así que la luz sigue bien al deformar.

const GLSL = /* glsl */ `
  vec3 transformed = vec3( position );
  float mode = aAnim.x;
  if ( mode > 0.5 ) {
    float hp = fract( uTime / ${BEAT.toFixed(6)} + ${PHASE0.toFixed(3)} );
    float open = smoothstep( 0.40, 0.55, hp ) * ( 1.0 - smoothstep( 0.80, 1.0, hp ) );
    float tl = ( hp - 0.03 ) / 0.06;
    float td = ( hp - 0.40 ) / 0.07;
    float tw = ( hp - 1.03 ) / 0.06;
    float thump = exp( -tl * tl ) + 0.55 * exp( -td * td ) + exp( -tw * tw );
    if ( mode < 2.5 ) {
      float R = aAnim.y;
      float cy = aAnim.z;
      vec2 q = position.xy - vec2( 0.0, cy );
      float r = length( q );
      float d = max( R - r, 0.0 );
      vec2 dir = q / max( r, 1e-4 );
      float phi = mix( 0.16, -1.12, open );
      vec2 xy = dir * R - dir * d * cos( phi ) + vec2( 0.0, cy );
      vec3 leaf = vec3( xy, position.z + d * sin( phi ) );
      if ( mode < 1.5 ) {
        transformed = leaf;
      } else {
        float w = clamp( ( position.z - aAnim.w ) / max( -aAnim.w, 1e-3 ) + 0.0, 0.0, 1.0 );
        w = smoothstep( 0.0, 1.0, w );
        transformed = mix( position, leaf, w );
      }
    } else if ( mode < 3.5 ) {
      float a = uTime * aAnim.y;
      float c = cos( a );
      float s = sin( a );
      transformed.xz = mat2( c, -s, s, c ) * position.xz;
    } else if ( mode < 4.5 ) {
      float k = 1.0 + aAnim.y * thump;
      transformed = vec3( 0.0, aAnim.z, 0.0 ) + ( position - vec3( 0.0, aAnim.z, 0.0 ) ) * k;
    } else if ( mode < 5.5 ) {
      float k = 1.0 + aAnim.y * sin( uTime * 1.25 );
      transformed = vec3( 0.0, aAnim.z, 0.0 ) + ( position - vec3( 0.0, aAnim.z, 0.0 ) ) * vec3( k, k, k );
    } else {
      float f = 1.0 - smoothstep( aAnim.z * 0.25, aAnim.z, length( position.xy - vec2( 0.0, aAnim.w ) ) );
      transformed.z += aAnim.y * thump * f;
    }
  }
`

function patch(m: THREE.Material, time: TimeUniform, key: string) {
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = time
    shader.vertexShader = 'attribute vec4 aAnim;\nuniform float uTime;\n' + shader.vertexShader.replace('#include <begin_vertex>', GLSL)
  }
  m.customProgramCacheKey = () => key
}

export function makeScienceMaterials(time: TimeUniform) {
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.82, metalness: 0 })
  patch(material, time, 'science-anim')
  const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking })
  patch(depth, time, 'science-anim-depth')
  return { material, depth }
}
