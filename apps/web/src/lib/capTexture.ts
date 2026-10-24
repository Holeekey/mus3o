import type { Texture } from 'three'

/** Lado mayor máximo (px) de la textura de un cuadro en la GPU. Un cuadro ocupa ~2 m en pantalla. */
export const MAX_PAINTING_TEXTURE = 1024

type Drawable = { width: number; height: number }

/**
 * Reduce la imagen de una textura (por canvas) si su lado mayor pasa de `max`: una foto de Wikimedia de
 * 4000 px son ~64 MB en la GPU con sus mipmaps y se sube de golpe, con el consiguiente tirón al entrar
 * en la sala. Conserva la proporción. Debe llamarse antes de la primera subida a la GPU.
 */
export function capTextureSize(texture: Texture, max = MAX_PAINTING_TEXTURE): Texture {
  const img = texture.image as (Drawable & CanvasImageSource) | undefined
  if (!img || typeof document === 'undefined') return texture
  const { width, height } = img
  if (!width || !height || Math.max(width, height) <= max) return texture
  const k = max / Math.max(width, height)
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(width * k))
  canvas.height = Math.max(1, Math.round(height * k))
  const ctx = canvas.getContext('2d')
  if (!ctx) return texture
  ctx.imageSmoothingQuality = 'high'
  try {
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  } catch {
    return texture // imagen contaminada o no dibujable: se deja tal cual
  }
  texture.image = canvas
  texture.needsUpdate = true
  return texture
}
