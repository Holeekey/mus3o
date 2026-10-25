import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { computeModelFit } from './modelBounds'

describe('computeModelFit', () => {
  it('centra en X y Z y apoya la base en Y = 0 para una caja simple', () => {
    const root = new THREE.Group()
    // Caja de 2x4x2 colocada en posición arbitraria [5, 10, -5]
    const geom = new THREE.BoxGeometry(2, 4, 2)
    const mesh = new THREE.Mesh(geom)
    mesh.position.set(5, 10, -5)
    root.add(mesh)

    const fit = computeModelFit(root, 1)

    // Altura máxima es 4, targetSize = 1 => scale = 0.25
    expect(fit.scale).toBeCloseTo(0.25)

    // Al aplicar escala y offset, el centro horizontal y la base inferior deben quedar en 0
    const testPointBottom = new THREE.Vector3(5, 8, -5) // Y min = 10 - 2 = 8
    const transformedY = testPointBottom.y * fit.scale + fit.offset[1]
    expect(transformedY).toBeCloseTo(0)

    const transformedX = 5 * fit.scale + fit.offset[0]
    expect(transformedX).toBeCloseTo(0)

    const transformedZ = -5 * fit.scale + fit.offset[2]
    expect(transformedZ).toBeCloseTo(0)
  })

  it('ignora luces y objetos no-mesh que distorsionan el bounding box', () => {
    const root = new THREE.Group()
    const geom = new THREE.BoxGeometry(1, 1, 1)
    const mesh = new THREE.Mesh(geom)
    mesh.position.set(0, 1, 0) // Y va de 0.5 a 1.5
    root.add(mesh)

    // Luz lejana en Y = -100 que no debe afectar la caja
    const light = new THREE.PointLight()
    light.position.set(0, -100, 0)
    root.add(light)

    const fit = computeModelFit(root, 1)
    expect(fit.scale).toBeCloseTo(1)

    // La base real es y = 0.5 del mesh
    const baseWorldY = 0.5 * fit.scale + fit.offset[1]
    expect(baseWorldY).toBeCloseTo(0)
  })
})
