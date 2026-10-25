import { afterEach, describe, expect, it } from 'vitest'
import type { Camera, Vector3 } from 'three'
import { EXAMPLE_TEXT } from '../palace/example'
import { buildLayout } from '../palace/layout'
import { detectFormat, parsePalace } from '../palace/parse'
import { moveAxes } from '../scene/moveInput'
import { stepWalk, WALK } from '../scene/walk'
import { activeColliders } from './teleport'
import {
  actionForButton,
  applyDeadzone,
  BUTTON_DEBOUNCE_MS,
  buttonsIdle,
  DEADZONE,
  forwardFromYaw,
  keyAxes,
  mapAxes,
  MOVE_HOLD,
  movingIdle,
  schemeIdle,
  SNAP_COOLDOWN,
  snapIdle,
  snapYawDelta,
  stepButtons,
  stepMoving,
  stepSnap,
  suppressGazeTarget,
  updateScheme,
  VR_WALK_SCALE,
} from './pad'
import { vrRuntime } from './runtime'

describe('applyDeadzone', () => {
  it('descarta el ruido dentro de la zona muerta', () => {
    expect(applyDeadzone(0.2, 0.1)).toEqual([0, 0])
    expect(applyDeadzone(0, -DEADZONE)).toEqual([0, 0])
  })

  it('reescala fuera de ella: sin salto en el borde y 1 al tope', () => {
    const [, y] = applyDeadzone(0, 0.26)
    expect(y).toBeGreaterThan(0)
    expect(y).toBeLessThan(0.05)
    expect(applyDeadzone(0, -1)[1]).toBeCloseTo(-1)
    expect(applyDeadzone(1, 1)).toEqual([expect.closeTo(0.7071, 3), expect.closeTo(0.7071, 3)])
  })

  it('tolera valores raros del navegador', () => {
    expect(applyDeadzone(Number.NaN, 0)).toEqual([0, 0])
  })
})

describe('mapAxes (un stick, mando de VR Box)', () => {
  it('vertical camina: arriba (-1) es adelante', () => {
    expect(mapAxes([0, -1], 'one')).toMatchObject({ ax: 0, az: VR_WALK_SCALE, turn: 0 })
    expect(mapAxes([0, 1], 'one').az).toBeCloseTo(-VR_WALK_SCALE)
  })

  it('horizontal NO desplaza de lado: va al giro', () => {
    expect(mapAxes([1, 0], 'one')).toMatchObject({ ax: 0, az: 0, turn: 1 })
    expect(mapAxes([-0.9, 0.1], 'one')).toMatchObject({ ax: 0, az: 0, turn: -0.9 })
  })

  it('una diagonal que domina en vertical camina y no gira', () => {
    const m = mapAxes([0.5, -0.9], 'one')
    expect(m.turn).toBe(0)
    expect(m.az).toBeGreaterThan(0)
  })

  it('zona muerta: un stick en reposo no mueve nada', () => {
    expect(mapAxes([0.1, -0.15], 'one')).toMatchObject({ ax: 0, az: 0 })
  })

  it('usa los ejes 2/3 si el mando expone ahí su único stick', () => {
    expect(mapAxes([0, 0, 0, -1], 'one').az).toBeCloseTo(VR_WALK_SCALE)
  })

  it('sin ejes no hace nada', () => {
    expect(mapAxes([], 'one')).toMatchObject({ ax: 0, az: 0, turn: 0 })
  })
})

describe('mapAxes (dos sticks)', () => {
  it('el primero camina y se desplaza; el segundo gira', () => {
    const m = mapAxes([0, -1, 0.9, 0], 'two')
    expect(m.az).toBeCloseTo(VR_WALK_SCALE)
    expect(m.ax).toBe(0)
    const d = mapAxes([0.6, -0.8, 0.9, 0], 'two')
    expect(d.az).toBeGreaterThan(0)
    expect(d.ax).toBeGreaterThan(0)
    expect(d.turn).toBe(0.9)
    expect(m.turn).toBe(0.9)
  })
})

describe('updateScheme', () => {
  it('empieza en un stick, también con 4 ejes', () => {
    expect(updateScheme(schemeIdle(), [0, 0, 0, 0]).scheme).toBe('one')
  })

  it('con 4+ ejes solo pasa a dos sticks cuando se usaron los dos', () => {
    let r = updateScheme(schemeIdle(), [0, -1, 0, 0])
    expect(r.scheme).toBe('one')
    r = updateScheme(r.state, [0, 0, 0.9, 0])
    expect(r.scheme).toBe('two')
    // y se queda así aunque vuelvan al centro
    expect(updateScheme(r.state, [0, 0, 0, 0]).scheme).toBe('two')
  })

  it('un mando de 2 ejes nunca pasa a dos sticks', () => {
    let r = updateScheme(schemeIdle(), [1, 0])
    r = updateScheme(r.state, [0, -1])
    expect(r.scheme).toBe('one')
  })

  it('ignora un segundo stick que es copia del primero', () => {
    let r = updateScheme(schemeIdle(), [0.9, -0.9, 0.9, -0.9])
    r = updateScheme(r.state, [0, 1, 0, 1])
    expect(r.scheme).toBe('one')
  })

  it('un stick que solo vive en los ejes 2/3 sigue siendo de un stick', () => {
    expect(updateScheme(schemeIdle(), [0, 0, 0, -1]).scheme).toBe('one')
  })
})

describe('stepSnap', () => {
  it('un golpe fuerte gira una vez: derecha +1, izquierda -1', () => {
    expect(stepSnap(snapIdle(), 1, 0.016).dir).toBe(1)
    expect(stepSnap(snapIdle(), -0.8, 0.016).dir).toBe(-1)
  })

  it('un empuje suave no gira', () => {
    expect(stepSnap(snapIdle(), 0.5, 0.016).dir).toBe(0)
  })

  it('mantener el stick no repite: hay que volver al centro', () => {
    let s = snapIdle()
    const first = stepSnap(s, 1, 0.016)
    s = first.state
    expect(first.dir).toBe(1)
    // 2 s con el stick a tope: ni un giro más
    for (let i = 0; i < 120; i++) {
      const r = stepSnap(s, 1, 1 / 60)
      expect(r.dir).toBe(0)
      s = r.state
    }
    // al soltar y volver a empujar, gira otra vez
    s = stepSnap(s, 0, 1 / 60).state
    expect(stepSnap(s, 1, 1 / 60).dir).toBe(1)
  })

  it('respeta el enfriamiento aunque pase por el centro', () => {
    let s = stepSnap(snapIdle(), 1, 0.016).state
    s = stepSnap(s, 0, 0.1).state // centro, pero solo han pasado 0,1 s
    expect(stepSnap(s, 1, 0.01).dir).toBe(0)
    s = stepSnap(s, 0, SNAP_COOLDOWN).state
    expect(stepSnap(s, 1, 0.01).dir).toBe(1)
  })

  it('girar a la derecha resta 30° de yaw', () => {
    expect(snapYawDelta(1)).toBeCloseTo(-Math.PI / 6)
    expect(snapYawDelta(-1)).toBeCloseTo(Math.PI / 6)
    expect(snapYawDelta(0)).toBe(0)
  })
})

describe('forwardFromYaw', () => {
  it('yaw 0 mira a -Z; +90° (izquierda) mira a -X', () => {
    const [x0, z0] = forwardFromYaw(0)
    expect(x0).toBeCloseTo(0)
    expect(z0).toBeCloseTo(-1)
    const [x1, z1] = forwardFromYaw(Math.PI / 2)
    expect(x1).toBeCloseTo(-1)
    expect(z1).toBeCloseTo(0)
  })

  it('un giro a la derecha de 30° desde el frente apunta a +X', () => {
    const [x, z] = forwardFromYaw(snapYawDelta(1))
    expect(x).toBeCloseTo(0.5)
    expect(z).toBeCloseTo(-Math.cos(Math.PI / 6))
  })
})

describe('keyAxes (mandos en modo teclado)', () => {
  it('flechas y WASD: arriba/W avanza, abajo/S retrocede, izquierda/derecha giran', () => {
    expect(keyAxes(new Set(['ArrowUp']))).toEqual({ forward: 1, turn: 0 })
    expect(keyAxes(new Set(['KeyW']))).toEqual({ forward: 1, turn: 0 })
    expect(keyAxes(new Set(['ArrowDown']))).toEqual({ forward: -1, turn: 0 })
    expect(keyAxes(new Set(['KeyS']))).toEqual({ forward: -1, turn: 0 })
    expect(keyAxes(new Set(['ArrowLeft']))).toEqual({ forward: 0, turn: -1 })
    expect(keyAxes(new Set(['KeyD']))).toEqual({ forward: 0, turn: 1 })
  })

  it('teclas opuestas se anulan', () => {
    expect(keyAxes(new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']))).toEqual({ forward: 0, turn: 0 })
  })
})

describe('botones', () => {
  const press = (...idx: number[]) => Array.from({ length: 4 }, (_, i) => idx.includes(i))

  it('0 = seleccionar, 1 = repetir a Aris, el resto seleccionan', () => {
    expect(actionForButton(0)).toBe('select')
    expect(actionForButton(1)).toBe('repeat')
    expect(actionForButton(2)).toBe('select')
    expect(actionForButton(7)).toBe('select')
    expect(stepButtons(buttonsIdle(), press(0), 1000).action).toBe('select')
    expect(stepButtons(buttonsIdle(), press(1), 1000).action).toBe('repeat')
    expect(stepButtons(buttonsIdle(), press(3), 1000).action).toBe('select')
  })

  it('una pulsación sostenida es una sola acción', () => {
    let s = buttonsIdle()
    const a = stepButtons(s, press(0), 1000)
    s = a.state
    expect(a.action).toBe('select')
    for (let t = 1016; t < 3000; t += 16) {
      const r = stepButtons(s, press(0), t)
      expect(r.action).toBeNull()
      s = r.state
    }
  })

  it('el rebote dentro del debounce no cuenta; pasado el debounce, sí', () => {
    let s = stepButtons(buttonsIdle(), press(0), 1000).state
    s = stepButtons(s, press(), 1050).state
    const bounce = stepButtons(s, press(0), 1100)
    expect(bounce.action).toBeNull()
    s = stepButtons(bounce.state, press(), 1150).state
    expect(stepButtons(s, press(0), 1000 + BUTTON_DEBOUNCE_MS + 10).action).toBe('select')
  })

  it('dos botones a la vez (mando que emite varios) = una acción, la del menor índice', () => {
    const a = stepButtons(buttonsIdle(), press(1, 2), 1000)
    expect(a.action).toBe('repeat')
    // el 2 no dispara después: ya estaba pulsado
    expect(stepButtons(a.state, press(1, 2), 1016).action).toBeNull()
  })

  it('un botón que ya estaba pulsado al entrar no dispara', () => {
    const s = { prev: [true], lastAt: Number.NEGATIVE_INFINITY }
    expect(stepButtons(s, press(0), 1000).action).toBeNull()
  })
})

describe('teletransporte por mirada mientras se camina', () => {
  it('se suprime el suelo, no el resto de objetivos', () => {
    expect(suppressGazeTarget('floor', true)).toBe(true)
    expect(suppressGazeTarget('floor', false)).toBe(false)
    expect(suppressGazeTarget('pedestal', true)).toBe(false)
    expect(suppressGazeTarget('door', true)).toBe(false)
    expect(suppressGazeTarget(null, true)).toBe(false)
  })

  it('"caminando" dura un poco más que el empuje y luego se apaga', () => {
    let m = movingIdle()
    const on = stepMoving(m, true, 0.016)
    expect(on.moving).toBe(true)
    m = on.state
    expect(stepMoving(m, false, MOVE_HOLD / 2).moving).toBe(true)
    expect(stepMoving(m, false, MOVE_HOLD + 0.01).moving).toBe(false)
    expect(stepMoving(movingIdle(), false, 0.016).moving).toBe(false)
  })
})

// ---------- colisiones: el mismo camino que Player / DioramaRuntime (moveAxes → stepWalk) ----------

const parsed = parsePalace(EXAMPLE_TEXT, detectFormat(EXAMPLE_TEXT))
if (!parsed.ok) throw new Error('example palace must parse')
const layout = buildLayout(parsed.palace)
const room = layout.rooms[0]
const pedestal = room.pedestals[0]

/** Cámara mínima: stepWalk solo usa position.x/z. */
const fakeCam = (x: number, z: number) => ({ position: { x, z } }) as unknown as Camera
const FWD = (yaw: number) => ({ x: forwardFromYaw(yaw)[0], y: 0, z: forwardFromYaw(yaw)[1] }) as unknown as Vector3

describe('caminar con el mando respeta las colisiones', () => {
  afterEach(() => {
    vrRuntime.active = false
    vrRuntime.move.ax = 0
    vrRuntime.move.az = 0
  })

  const walk = (cam: Camera, yaw: number, seconds: number, colliders = layout.colliders) => {
    for (let i = 0; i < seconds * 60; i++) stepWalk(cam, FWD(yaw), {}, 1 / 60, colliders)
  }

  it('en VR moveAxes ignora el teclado (sin doble movimiento) y lee el mando', () => {
    vrRuntime.active = true
    vrRuntime.move.ax = 0
    vrRuntime.move.az = 0.5
    expect(moveAxes({ KeyW: true, KeyD: true, ShiftLeft: true })).toEqual({ ax: 0, az: 0.5, running: false })
    vrRuntime.active = false
    expect(moveAxes({ KeyW: true })).toEqual({ ax: 0, az: 1, running: false })
  })

  it('adelante con el stick avanza a velocidad de escritorio × escala', () => {
    vrRuntime.active = true
    vrRuntime.move.az = VR_WALK_SCALE
    const cam = fakeCam(room.x, room.z + 1.5)
    // Medio segundo hacia -Z (son ~1,7 m: sin chocar con nada desde la mitad de la sala).
    walk(cam, 0, 0.5, [])
    const p = (cam as unknown as { position: { z: number } }).position
    expect(room.z + 1.5 - p.z).toBeCloseTo(WALK * VR_WALK_SCALE * 0.5, 1)
  })

  it('caminar de frente a un pedestal se detiene en él', () => {
    vrRuntime.active = true
    vrRuntime.move.az = 1
    // Se parte 2 m al sur del pedestal (+Z) mirando a -Z (hacia él).
    const startZ = pedestal.z + 2
    const cam = fakeCam(pedestal.x, startZ)
    const p = (cam as unknown as { position: { x: number; z: number } }).position
    // Si hay otra colisión entre medias (otro pedestal, un muro), igualmente no puede atravesar el pedestal.
    walk(cam, 0, 3)
    expect(p.z).toBeGreaterThan(pedestal.z) // nunca lo cruza
    expect(Math.abs(p.z - pedestal.z)).toBeLessThan(2) // y avanzó hasta tocarlo
  })

  it('un muro frena aunque se empuje el stick a tope', () => {
    vrRuntime.active = true
    vrRuntime.move.az = 1
    const cam = fakeCam(room.x, room.z)
    const p = (cam as unknown as { position: { x: number; z: number } }).position
    // Hacia -X desde el centro (la pared oeste no tiene puerta): no puede sobrepasar su borde.
    expect(room.doors).not.toContain('w')
    walk(cam, Math.PI / 2, 10)
    expect(p.x).toBeGreaterThan(room.x - room.w / 2)
  })

  it('una compuerta cerrada bloquea; abierta, deja pasar', () => {
    const door = layout.doors[0]
    if (!door) return
    vrRuntime.active = true
    vrRuntime.move.az = 1
    const closed = activeColliders(layout, () => false)
    const open = activeColliders(layout, () => true)
    expect(closed.length).toBeGreaterThan(open.length)
    // Pegado a la compuerta, por el lado del pasillo anterior al cierre, en línea con su eje.
    const alongX = door.w > door.d
    const dir = alongX ? [0, 1] : [1, 0]
    const x0 = door.x - dir[0] * 1.5
    const z0 = door.z - dir[1] * 1.5
    const yaw = Math.atan2(-dir[0], -dir[1]) // mirar hacia +dir
    const a = fakeCam(x0, z0)
    walk(a, yaw, 2, closed)
    const pa = (a as unknown as { position: { x: number; z: number } }).position
    expect((pa.x - door.x) * dir[0] + (pa.z - door.z) * dir[1]).toBeLessThan(0) // sin cruzar
    const b = fakeCam(x0, z0)
    walk(b, yaw, 2, open)
    const pb = (b as unknown as { position: { x: number; z: number } }).position
    expect(Math.hypot(pb.x - x0, pb.z - z0)).toBeGreaterThan(Math.hypot(pa.x - x0, pa.z - z0))
  })
})
