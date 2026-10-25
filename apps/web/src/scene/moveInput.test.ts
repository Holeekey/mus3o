import { afterEach, describe, expect, it } from 'vitest'
import { applyTouchLook, moveAxes } from './moveInput'
import { resetTouchMove, touchInput } from './touchInput'

afterEach(() => {
  resetTouchMove()
  touchInput.lookDx = 0
  touchInput.lookDy = 0
})

describe('moveAxes', () => {
  it('reads WASD, arrows and Shift', () => {
    expect(moveAxes({ KeyW: true, KeyD: true, ShiftLeft: true })).toEqual({ ax: 1, az: 1, running: true })
    expect(moveAxes({ ArrowDown: true, ArrowLeft: true })).toEqual({ ax: -1, az: -1, running: false })
  })

  it('uses the touch joystick (analog) when no key is pressed', () => {
    Object.assign(touchInput, { moveX: 0.25, moveZ: 0.5, isRunning: true })
    expect(moveAxes({})).toEqual({ ax: 0.25, az: 0.5, running: true })
  })

  it('keyboard wins over the joystick on each axis', () => {
    Object.assign(touchInput, { moveX: 0.25, moveZ: 0.5 })
    expect(moveAxes({ KeyS: true })).toEqual({ ax: 0.25, az: -1, running: false })
  })
})

describe('applyTouchLook', () => {
  it('turns the camera with the pending swipe and clamps the pitch', () => {
    const camera = { rotation: { x: 0, y: 1 } }
    Object.assign(touchInput, { lookDx: 0.5, lookDy: -3 })
    applyTouchLook(camera)
    expect(camera.rotation.y).toBeCloseTo(0.5)
    expect(camera.rotation.x).toBeCloseTo(1.4)
    // El gesto se consume: no se vuelve a aplicar.
    applyTouchLook(camera)
    expect(camera.rotation.y).toBeCloseTo(0.5)
  })
})
