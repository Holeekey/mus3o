import { useEffect, useState } from 'react'
import { TEAM_HASH } from './useHash'

// Por debajo de esta altura el header siempre se ve: es la primera pantalla.
const TOP_ZONE = 80

const LINKS = [
  { href: '#como-funciona', label: 'Cómo funciona' },
  { href: '#crear', label: 'Crea tu palacio' },
  { href: TEAM_HASH, label: 'Nuestro Equipo' },
]

/** Se esconde al bajar y vuelve al subir. Solo re-renderiza cuando cambia de estado. */
function useHideOnScrollDown() {
  const [hidden, setHidden] = useState(false)
  useEffect(() => {
    let lastY = window.scrollY
    let raf = 0
    const update = () => {
      raf = 0
      const y = window.scrollY
      if (Math.abs(y - lastY) < 4) return
      setHidden(y > TOP_ZONE && y > lastY)
      lastY = y
    }
    const schedule = () => { if (!raf) raf = requestAnimationFrame(update) }
    window.addEventListener('scroll', schedule, { passive: true })
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', schedule)
    }
  }, [])
  return hidden
}

export function SiteHeader() {
  const hidden = useHideOnScrollDown()
  // En móvil los enlaces van en un menú hamburguesa; en escritorio el botón no se ve y el nav siempre está abierto.
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (hidden) setOpen(false)
  }, [hidden])
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])
  return (
    <header className="site-header" data-hidden={hidden && !open} data-open={open}>
      <a className="site-logo" href="#top" aria-label="mus3o, volver al inicio" />
      <button
        type="button"
        className="site-menu-btn"
        aria-expanded={open}
        aria-controls="site-nav"
        aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
        onClick={() => setOpen((o) => !o)}
      >
        <span aria-hidden />
      </button>
      <nav id="site-nav" aria-label="Secciones">
        {LINKS.map((l) => (
          <a key={l.href} className="site-link" href={l.href} onClick={() => setOpen(false)}>
            {l.label}
          </a>
        ))}
      </nav>
    </header>
  )
}
