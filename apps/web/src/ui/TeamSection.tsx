import { useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react'
import { SiteHeader } from './SiteHeader'
import { TEAM } from './team'

const initials = (name: string) => name.split(' ').slice(0, 2).map((w) => w[0]).join('')

// Mientras no exista la foto se muestran las iniciales.
function Photo({ name, photo, focus }: { name: string; photo: string; focus?: number }) {
  const [failed, setFailed] = useState(false)
  return failed ? (
    <span className="team-photo team-photo-empty" aria-hidden>{initials(name)}</span>
  ) : (
    // El marco recorta: la foto se amplía dentro para verse más cerca.
    <span className="team-photo team-photo-frame" style={focus === undefined ? undefined : ({ '--focus': `${focus}%` } as CSSProperties)}>
      <img src={`/team/${photo}.jpg`} alt={`Foto de ${name}`} loading="lazy" onError={() => setFailed(true)} />
    </span>
  )
}

/** Índice de la tarjeta que cruza la franja central de la pantalla: la persona que se está leyendo. */
function useActiveCard(list: RefObject<HTMLUListElement | null>) {
  const [active, setActive] = useState(0)
  useEffect(() => {
    const cards = Array.from(list.current?.children ?? [])
    if (!cards.length || !('IntersectionObserver' in window)) return
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(cards.indexOf(e.target))
      },
      { rootMargin: '-45% 0px -45% 0px' },
    )
    cards.forEach((c) => io.observe(c))
    return () => io.disconnect()
  }, [list])
  return active
}

/** Página aparte (#equipo): quiénes somos y el hackathon. */
export function TeamPage() {
  const listRef = useRef<HTMLUListElement>(null)
  const active = useActiveCard(listRef)
  return (
    <main className="landing team-page">
      <SiteHeader />
      <section className="team" aria-labelledby="team-title">
        <h1 id="team-title">Nuestro Equipo</h1>
        <p className="team-lead">
          {/* TODO(equipo): contar la historia del hackathon. */}
          <span className="inline-logo" role="img" aria-label="mus3o" /> nació en Platanus Hack 26 Caracas.
          <br />
          Nosotros escogimos el reto <i>"Three-Dimensional"</i>, después de una lluvia de ideas, surgió nuestro proyecto: convertir apuntes en un palacio de la memoria que se
          recorre en primera persona.
        </p>
        {/* Galería vertical: la persona en el centro de la pantalla va a color, el resto en blanco y negro. */}
        <ul ref={listRef} className="team-list">
          {TEAM.map((m, i) => (
            <li key={m.name} className="team-card" data-active={i === active}>
              <Photo name={m.name} photo={m.photo} focus={m.focus} />
              <div className="team-text">
                <strong className="team-name">{m.name}</strong>
                <p className="team-bio">{m.bio}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}
