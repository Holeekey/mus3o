import type { ReactNode } from 'react'
import { useIsTouch } from './useIsTouch'

type Props = {
  /** Tecla que se muestra en escritorio. */
  k: string
  /** Lo que hace la tecla. En pantallas táctiles el aviso se vuelve un botón que lo ejecuta. */
  onTap?: () => void
  /** Clase del botón táctil; por defecto el estilo de aviso del HUD. */
  buttonClassName?: string
  children?: ReactNode
}

/**
 * Atajo de teclado visible. En escritorio: `<kbd>E</kbd> Examinar`. En táctil: un botón "Examinar".
 * Sin `onTap`, en táctil no se muestra (esa tecla no tiene equivalente que tocar).
 */
export function KeyHint({ k, onTap, buttonClassName = 'key-hint-btn', children }: Props) {
  const touch = useIsTouch()
  if (!touch) {
    return (
      <>
        <kbd>{k}</kbd>
        {children != null && <> {children}</>}
      </>
    )
  }
  if (!onTap) return null
  return (
    <button type="button" className={buttonClassName} onClick={onTap}>
      {children ?? k}
    </button>
  )
}
