import { describe, expect, it } from 'vitest'
import { DENIED_NOTICE, TYPING_NOTICE, examVoiceReducer, initialVoiceState } from './examVoice'
import { pickSpanishVoice } from './voice'

describe('examVoiceReducer', () => {
  it('empieza escuchando si hay dictado, o escribiendo con aviso si no', () => {
    expect(initialVoiceState(true).phase).toBe('listening')
    expect(initialVoiceState(false)).toMatchObject({ phase: 'typing', notice: TYPING_NOTICE })
  })
  it('acumula la transcripción solo mientras escucha', () => {
    const s = examVoiceReducer(initialVoiceState(true), { type: 'interim', text: 'negro' })
    expect(s.transcript).toBe('negro')
    const t = examVoiceReducer({ ...s, phase: 'typing' }, { type: 'interim', text: 'x' })
    expect(t.transcript).toBe('negro')
  })
  it('micrófono denegado pasa a escribir con aviso', () => {
    expect(examVoiceReducer(initialVoiceState(true), { type: 'error', code: 'not-allowed' })).toMatchObject({
      phase: 'typing',
      notice: DENIED_NOTICE,
    })
  })
  it('silencio deja en reposo y reintentar vuelve a escuchar', () => {
    const idle = examVoiceReducer(initialVoiceState(true), { type: 'error', code: 'no-speech' })
    expect(idle.phase).toBe('idle')
    expect(idle.notice).toContain('R')
    expect(examVoiceReducer(idle, { type: 'listen' })).toEqual({ phase: 'listening', transcript: '', notice: null })
  })
  it('un error tardío no pisa el modo escritura', () => {
    const typing = examVoiceReducer(initialVoiceState(true), { type: 'typing' })
    expect(examVoiceReducer(typing, { type: 'error', code: 'no-speech' })).toBe(typing)
  })
})

describe('pickSpanishVoice', () => {
  it('prefiere es-VE, luego es-419/es-MX, luego cualquier es-*', () => {
    const v = (lang: string) => ({ lang })
    expect(pickSpanishVoice([v('en-US'), v('es-ES'), v('es-MX'), v('es-VE')])?.lang).toBe('es-VE')
    expect(pickSpanishVoice([v('es-ES'), v('es-MX')])?.lang).toBe('es-MX')
    expect(pickSpanishVoice([v('en-US'), v('es-ES')])?.lang).toBe('es-ES')
    expect(pickSpanishVoice([v('en-US')])).toBeNull()
  })
})
