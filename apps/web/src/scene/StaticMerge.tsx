import { useFrame } from '@react-three/fiber'
import { useEffect, useRef, type ReactNode } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/**
 * Une en una sola malla por material la geometría estática de sus hijos (muros, molduras, suelos de
 * pasillo): de decenas de draw calls (y de pasadas de sombra) por sala a unas pocas.
 *
 * - Solo toma mallas estándar opacas y no instanciadas; el resto (texto, planos con textura, animados)
 *   sigue dibujándose como antes.
 * - Un subárbol con `userData.noMerge` (objetos que giran o se rompen) se deja intacto.
 * - Las mallas originales se ocultan (visible=false), no se destruyen: React las sigue gestionando.
 * - Si los hijos cambian (el GLTF termina de cargar y sustituye al muro provisional, cambia el layout,
 *   cambia un color) se detecta por huella y se vuelve a unir.
 */

const CHECK_EVERY = 12 // frames entre comprobaciones de la huella
const KEEP = ['position', 'normal', 'uv']

type Candidate = { mesh: THREE.Mesh; mat: THREE.MeshStandardMaterial; key: string }

function materialKey(m: THREE.MeshStandardMaterial, mesh: THREE.Mesh) {
  return [
    m.color.getHexString(),
    m.roughness,
    m.metalness,
    m.flatShading ? 1 : 0,
    m.map?.uuid ?? '',
    m.normalMap?.uuid ?? '',
    m.emissive.getHexString(),
    m.emissiveIntensity,
    m.side,
    m.vertexColors ? 1 : 0,
    m.alphaTest,
    mesh.castShadow ? 1 : 0,
    mesh.receiveShadow ? 1 : 0,
  ].join('|')
}

function eligible(o: THREE.Object3D): Candidate | null {
  const mesh = o as THREE.Mesh
  if (!mesh.isMesh || (mesh as THREE.InstancedMesh).isInstancedMesh || (mesh as THREE.SkinnedMesh).isSkinnedMesh) return null
  if (mesh.userData.noMerge) return null
  const mat = mesh.material as THREE.MeshStandardMaterial
  if (Array.isArray(mat) || !mat.isMeshStandardMaterial) return null
  if (mat.transparent || mat.opacity < 1 || mat.userData.crackPatched || mat.clippingPlanes) return null
  if (mesh.morphTargetInfluences?.length) return null
  const g = mesh.geometry
  if (!g?.attributes?.position || g.attributes.position.itemSize !== 3) return null
  return { mesh, mat, key: materialKey(mat, mesh) }
}

export function StaticMerge({ children }: { children: ReactNode }) {
  const group = useRef<THREE.Group>(null)
  const state = useRef({
    frame: 0,
    offset: Math.floor(Math.random() * CHECK_EVERY),
    merged: [] as THREE.Mesh[],
    hidden: [] as THREE.Mesh[],
    printMerged: '',
    printPending: '',
  })

  const unmerge = () => {
    const s = state.current
    for (const m of s.hidden) {
      m.visible = true
      delete m.userData.staticMerged
    }
    for (const m of s.merged) {
      m.removeFromParent()
      m.geometry.dispose()
    }
    s.hidden = []
    s.merged = []
    s.printMerged = ''
  }

  useEffect(
    () => () => {
      const s = state.current
      for (const m of s.merged) {
        m.removeFromParent()
        m.geometry.dispose()
      }
      s.merged = []
      s.hidden = []
    },
    [],
  )

  useFrame(() => {
    const g = group.current
    const s = state.current
    if (!g) return
    if ((s.frame++ + s.offset) % CHECK_EVERY !== 0) return

    // Candidatas: las visibles más las que ya ocultamos nosotros.
    g.updateWorldMatrix(true, true)
    const cands: Candidate[] = []
    const walk = (o: THREE.Object3D) => {
      if (o.userData.noMerge || o.userData.isMergedOutput) return // subárbol animado: no se toca
      if (o !== g && (o as THREE.Mesh).isMesh) {
        const hiddenByUs = !!o.userData.staticMerged
        if (!hiddenByUs) {
          // Una malla oculta por otro (Reveal, visibilidad) no se une todavía.
          let v = true
          for (let a: THREE.Object3D | null = o; a && a !== g; a = a.parent) if (!a.visible) v = false
          if (!v) return
        }
        const saved = o.visible
        if (hiddenByUs) o.visible = true
        const c = eligible(o)
        if (hiddenByUs) o.visible = saved
        if (c) cands.push(c)
      }
      for (const ch of o.children) walk(ch)
    }
    walk(g)
    // Huella: material y matriz relativa de cada candidata.
    const inv = new THREE.Matrix4().copy(g.matrixWorld).invert()
    const rel = new THREE.Matrix4()
    const print = cands
      .map((c) => {
        rel.multiplyMatrices(inv, c.mesh.matrixWorld)
        return c.mesh.uuid.slice(0, 8) + c.mesh.geometry.uuid.slice(0, 8) + c.key + rel.elements.map((e) => Math.round(e * 1000)).join(',')
      })
      .join(';')

    if (print === s.printMerged) return
    // Hay cambios: se espera a que se estabilicen (dos comprobaciones seguidas iguales).
    if (print !== s.printPending) {
      s.printPending = print
      return
    }
    if (s.merged.length) unmerge()
    if (cands.length < 2) {
      s.printMerged = print
      return
    }

    const buckets = new Map<string, Candidate[]>()
    for (const c of cands) {
      rel.multiplyMatrices(inv, c.mesh.matrixWorld)
      if (rel.determinant() <= 0) continue // espejo: cambiaría el sentido de las caras
      const b = buckets.get(c.key)
      if (b) b.push(c)
      else buckets.set(c.key, [c])
    }
    for (const list of buckets.values()) {
      const geos: THREE.BufferGeometry[] = []
      for (const c of list) {
        let geo = c.mesh.geometry.clone()
        for (const name of Object.keys(geo.attributes)) if (!KEEP.includes(name)) geo.deleteAttribute(name)
        geo.clearGroups()
        if (geo.index) geo = geo.toNonIndexed()
        if (!geo.attributes.normal) geo.computeVertexNormals()
        if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2))
        rel.multiplyMatrices(inv, c.mesh.matrixWorld)
        geo.applyMatrix4(rel)
        geos.push(geo)
      }
      const merged = geos.length > 1 ? mergeGeometries(geos, false) : geos[0]
      if (geos.length > 1) for (const geo of geos) geo.dispose()
      if (!merged) continue
      merged.computeBoundingSphere()
      const first = list[0]
      const out = new THREE.Mesh(merged, first.mat)
      out.castShadow = first.mesh.castShadow
      out.receiveShadow = first.mesh.receiveShadow
      out.userData.isMergedOutput = true
      g.add(out)
      s.merged.push(out)
      for (const c of list) {
        c.mesh.visible = false
        c.mesh.userData.staticMerged = true
        s.hidden.push(c.mesh)
      }
    }
    s.printMerged = print
  })

  return <group ref={group}>{children}</group>
}
