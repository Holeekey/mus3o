import { useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react'
import { SiteHeader } from './SiteHeader'

// TODO(equipo): falta la bio de Daniel. Las fotos van en public/team/<photo>.jpg.
// `focus`: altura del encuadre en % (por defecto 40). Más alto = la foto sube dentro del marco.
const TEAM: { name: string; bio: string; photo: string; focus?: number }[] = [
  { name: 'Gabriel Castellano', bio: 'Desarrollador radicado en Caracas, Venezuela, que forma parte de la organización Parallel Devs. Su trayectoria en la plataforma destaca por un perfil altamente colaborativo y orientado a la construcción de proyectos en equipo. Ha obtenido múltiples reconocimientos en GitHub que reflejan su constancia técnica, las revisiones de código compartidas y su agilidad para aportar soluciones en diversos repositorios.', photo: 'gabriel', focus: 20 },
  { name: 'Jesús Gil Farías', bio: 'Estudiante de Ingeniería Informática y actual IBM Z Student Ambassador. Es un apasionado por los sistemas de bajo nivel y domina lenguajes de programación versátiles como C, Python, Go y NASM. Sus principales intereses abarcan la ciberseguridad, el desarrollo de software de escritorio, el desarrollo de videojuegos y la programación competitiva, manteniéndose muy activo en plataformas como Codeforces, hackatones y game jams.', photo: 'jesus' },
  { name: 'Massiel Perozo', bio: 'Estudiante de Ingeniería Informática en la Universidad Católica Andrés Bello (UCAB). Su perfil en GitHub refleja un claro enfoque académico y una gran disposición hacia el trabajo en equipo, demostrando una participación constante y colaborativa en la construcción de diversos proyectos de software durante su formación universitaria.', photo: 'massiel' },
  { name: 'Daniel Bruno', bio: 'Bio pendiente.', photo: 'daniel' },
  { name: 'Valeria Riera', bio: 'Estudiante de Ingeniería Informática orientada al análisis de datos y el desarrollo de software. Cuenta con gran experiencia como desarrolladora creando aplicaciones web, plataformas de seguimiento y sistemas de gestión, utilizando de forma fluida tecnologías modernas como React, TypeScript, Tailwind CSS y Supabase. Además de su sólido perfil técnico en el frontend y backend, es una persona en constante crecimiento que expande sus horizontes a través de la ciencia de datos con Python y el estudio del idioma alemán.', photo: 'valeria' },
]

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
