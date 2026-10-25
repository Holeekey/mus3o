// Equipo: lo usan la página #equipo y el muro de Founders del lobby 3D.
// TODO(equipo): falta la bio de Daniel. Las fotos van en public/team/<photo>.jpg.
// `focus`: altura del encuadre en % (por defecto 40). Más alto = la foto sube dentro del marco.
export type TeamMember = { name: string; bio: string; photo: string; focus?: number }

export const TEAM: TeamMember[] = [
  { name: 'Gabriel Castellano', bio: 'Genio, multimillonario, playboy y filántropo', photo: 'gabriel', focus: 20 },
  { name: 'Jesús Gil Farías', bio: 'El Tacaño', photo: 'jesus' },
  { name: 'Massiel Perozo', bio: 'Mr. Worldwide, dale', photo: 'massiel' },
  { name: 'Daniel Bruno', bio: 'Líder. Genio.', photo: 'daniel' },
  { name: 'Valeria Riera', bio: 'It was all my design, \'cause I\'m a mastermind', photo: 'valeria' },
]
