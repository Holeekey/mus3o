import { Quaternion, Vector3 } from 'three'

// Matemática del "rig" (dónde está el jugador) para WebXR. Pura, para poder probarla sin visor.

export type Rig = { x: number; y: number; z: number; yaw: number }

const Y = new Vector3(0, 1, 0)

/**
 * Transformación que hay que aplicar al espacio de referencia de la sesión para que el visor quede en el rig.
 * Si T = (posición del rig, giro `yaw`) lleva del espacio base al mundo, el espacio desplazado necesita T⁻¹:
 * un visor en `p` (espacio base) queda en T·p = rig + R(yaw)·p. Es el mismo patrón que el ejemplo de teletransporte de three.js.
 */
export function rigOffset(rig: Rig): { position: Vector3; orientation: Quaternion } {
  const q = new Quaternion().setFromAxisAngle(Y, rig.yaw)
  const inv = q.clone().invert()
  const position = new Vector3(rig.x, rig.y, rig.z).applyQuaternion(inv).negate()
  return { position, orientation: inv }
}

/** Posición en el mundo de un punto `phys` del espacio base (p. ej. la cabeza) dado el rig. */
export function worldFromBase(rig: Rig, phys: Vector3): Vector3 {
  return phys.clone().applyQuaternion(new Quaternion().setFromAxisAngle(Y, rig.yaw)).add(new Vector3(rig.x, rig.y, rig.z))
}

/** Lo que verá el visor al desplazar el espacio con `rigOffset`: offset⁻¹ · p (así define la especificación la pose en el espacio nuevo). */
export function viewerInOffsetSpace(offset: { position: Vector3; orientation: Quaternion }, phys: Vector3): Vector3 {
  return phys.clone().sub(offset.position).applyQuaternion(offset.orientation.clone().invert())
}
