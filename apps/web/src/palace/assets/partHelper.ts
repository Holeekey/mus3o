import type { Part } from '@mus3o/shared'

/**
 * Ayudante tipado para construir partes de modelos procedurales.
 * Valida o asigna valores dentro de los límites estrictos de PartSchema.
 */
export function part(
  shape: Part['shape'],
  args: number[],
  pos: [number, number, number],
  color: string,
  rot: [number, number, number] = [0, 0, 0],
): Part {
  return {
    shape,
    args,
    pos,
    rot,
    color,
  }
}

/** Cajas ortogonales con ancho, alto y profundidad. */
export const box = (
  w: number,
  h: number,
  d: number,
  pos: [number, number, number],
  color: string,
  rot: [number, number, number] = [0, 0, 0],
): Part => part('box', [w, h, d], pos, color, rot)

/** Cilindros con radio superior, inferior, altura y segmentos radiales opcionales. */
export const cyl = (
  rt: number,
  rb: number,
  h: number,
  pos: [number, number, number],
  color: string,
  rot: [number, number, number] = [0, 0, 0],
  seg = 12,
): Part => part('cylinder', [rt, rb, h, seg], pos, color, rot)

/** Esferas con radio y segmentos. */
export const sphere = (
  r: number,
  pos: [number, number, number],
  color: string,
  wSeg = 12,
  hSeg = 8,
): Part => part('sphere', [r, wSeg, hSeg], pos, color)

/** Conos con radio base, altura y segmentos. */
export const cone = (
  r: number,
  h: number,
  pos: [number, number, number],
  color: string,
  rot: [number, number, number] = [0, 0, 0],
  seg = 12,
): Part => part('cone', [r, h, seg], pos, color, rot)
