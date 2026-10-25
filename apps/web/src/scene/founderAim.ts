/** Etiqueta que lleva cada retrato de Founders en `userData.founder`. */
export type FounderTag = { name: string; profile: string }

/** Lo mínimo de un Object3D que se necesita para decidir (así se prueba sin three). */
export type AimNode = {
  userData: { founder?: FounderTag }
  parent: AimNode | null
  visible?: boolean
}

export type AimHit = { distance: number; object: AimNode }

/** Hasta dónde se puede apuntar a un retrato para abrir su perfil (m). */
export const AIM_MAX_DIST = 7

/** La etiqueta del retrato al que pertenece el objeto (él mismo o un ancestro), o null. */
export function founderOf(object: AimNode): FounderTag | null {
  for (let o: AimNode | null = object; o; o = o.parent) {
    if (o.userData.founder) return o.userData.founder
  }
  return null
}

const isVisible = (object: AimNode) => {
  for (let o: AimNode | null = object; o; o = o.parent) if (o.visible === false) return false
  return true
}

/**
 * El fundador apuntado: solo cuenta el impacto visible más cercano, así un muro u otro objeto delante lo tapa.
 * Null si lo más cercano no es un retrato o está más lejos que `maxDist`.
 */
export function aimedFounder(hits: readonly AimHit[], maxDist = AIM_MAX_DIST): FounderTag | null {
  let nearest: AimHit | null = null
  for (const h of hits) if (isVisible(h.object) && (!nearest || h.distance < nearest.distance)) nearest = h
  if (!nearest || nearest.distance > maxDist) return null
  return founderOf(nearest.object)
}

/** Abre el perfil en una pestaña nueva, sin dar acceso a esta ventana. */
export function openProfile(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer')
}
