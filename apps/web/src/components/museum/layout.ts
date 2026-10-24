export const ROOM_W = 16;
export const ROOM_D = 16;
export const ROOM_H = 5;
export const DOOR_W = 4;
export const DOOR_H = 3.2;
export const EYE_HEIGHT = 1.7;

/** Posición en el mundo del centro de la sala `index` (las salas se alinean en x). */
export const roomOrigin = (index: number): [number, number, number] => [index * ROOM_W, 0, 0];
