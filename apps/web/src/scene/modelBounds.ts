import * as THREE from 'three'

export type ModelFit = {
  scale: number
  offset: [number, number, number]
}

/**
 * Computa la escala y el desplazamiento óptimos para que una jerarquía 3D:
 * 1. Esté perfectamente centrada horizontalmente (centro en x = 0 y z = 0).
 * 2. Su base mínima (min.y) quede exactamente en y = 0.
 * 3. Su dimensión mayor (ancho, alto o profundidad) mida exactamente `targetSize`.
 *
 * Filtra únicamente las geometrías Mesh / SkinnedMesh reales para que cámaras,
 * luces o nodos auxiliares de archivos GLTF externos no distorsionen la caja envolvente.
 */
export function computeModelFit(root: THREE.Object3D, targetSize = 0.8): ModelFit {
  // Aseguramos matrices locales y mundiales limpias respecto al origen del objeto
  root.updateMatrixWorld(true)

  const box = new THREE.Box3()
  let hasMesh = false

  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh
    if (mesh.isMesh && mesh.geometry) {
      if (!mesh.geometry.boundingBox) {
        mesh.geometry.computeBoundingBox()
      }
      if (mesh.geometry.boundingBox) {
        const meshBox = mesh.geometry.boundingBox.clone()
        meshBox.applyMatrix4(mesh.matrixWorld)
        if (!hasMesh) {
          box.copy(meshBox)
          hasMesh = true
        } else {
          box.union(meshBox)
        }
      }
    }
  })

  // Si no se encontró ninguna malla visible, usamos setFromObject como fallback seguro
  if (!hasMesh || box.isEmpty()) {
    box.setFromObject(root)
  }

  const size = new THREE.Vector3()
  box.getSize(size)
  const maxDim = Math.max(size.x, size.y, size.z, 1e-3)
  const scale = targetSize / maxDim

  const centerX = (box.min.x + box.max.x) / 2
  const centerZ = (box.min.z + box.max.z) / 2
  const minY = box.min.y

  return {
    scale,
    offset: [-centerX * scale, -minY * scale, -centerZ * scale],
  }
}
