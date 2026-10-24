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
  return (
    <header className="site-header" data-hidden={hidden}>
      <a className="site-logo" href="#top" aria-label="mus3o, volver al inicio" />
      <nav aria-label="Secciones">
        {LINKS.map((l) => (
          <a key={l.href} className="site-link" href={l.href}>
            {l.label}
          </a>
        ))}
      </nav>
    </header>
  )
}
