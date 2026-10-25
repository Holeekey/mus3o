import { describe, expect, it } from 'vitest'
import { isResumeKey } from './resume'

const body = { closest: () => null }
const button = { closest: () => ({}) }

describe('isResumeKey', () => {
  it('resumes with Enter or Space pressed on the page', () => {
    expect(isResumeKey('Enter', body)).toBe(true)
    expect(isResumeKey('NumpadEnter', body)).toBe(true)
    expect(isResumeKey('Space', body)).toBe(true)
  })

  it('does not resume with Esc or other keys (the browser does not allow relocking with Esc)', () => {
    expect(isResumeKey('Escape', body)).toBe(false)
    expect(isResumeKey('KeyE', body)).toBe(false)
  })

  it('leaves Enter and Space to a focused button, link or field', () => {
    expect(isResumeKey('Enter', button)).toBe(false)
    expect(isResumeKey('Space', button)).toBe(false)
  })

  it('resumes when the target has no DOM (window)', () => {
    expect(isResumeKey('Enter', null)).toBe(true)
  })
})
