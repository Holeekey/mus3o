import { afterEach, describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { touchInput } from '../scene/touchInput'
import { KeyHint } from './KeyHint'

const noop = () => {}

afterEach(() => {
  touchInput.isTouchDevice = false
})

describe('KeyHint', () => {
  it('shows the key next to the label on desktop', () => {
    expect(renderToStaticMarkup(<KeyHint k="E" onTap={noop}>Examinar concepto</KeyHint>)).toBe('<kbd>E</kbd> Examinar concepto')
  })

  it('turns into a tappable button on touch screens', () => {
    touchInput.isTouchDevice = true
    expect(renderToStaticMarkup(<KeyHint k="E" onTap={noop}>Examinar concepto</KeyHint>)).toBe(
      '<button type="button" class="key-hint-btn">Examinar concepto</button>',
    )
  })

  it('hides keys without a touch equivalent on touch screens', () => {
    touchInput.isTouchDevice = true
    expect(renderToStaticMarkup(<KeyHint k="N" />)).toBe('')
  })
})
