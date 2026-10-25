// Equipo: lo usan la página #equipo y el muro de Founders del lobby 3D.
// TODO(equipo): falta la bio de Daniel. Las fotos van en public/team/<photo>.jpg.
// `focus`: altura del encuadre en % (por defecto 40). Más alto = la foto sube dentro del marco.
// `profile`: perfil de LinkedIn; lo abren la tarjeta de #equipo y el retrato del lobby.
export type TeamMember = { name: string; bio: string; photo: string; profile: string; focus?: number }

export const TEAM: TeamMember[] = [
  { name: 'Gabriel Castellano', bio: 'Genio, multimillonario, playboy y filántropo', photo: 'gabriel', profile: 'https://www.linkedin.com/in/gdcastellano/', focus: 20 },
  { name: 'Jesús Gil Farías', bio: 'El Tacaño', photo: 'jesus', profile: 'https://www.linkedin.com/in/jesus-r-gil/' },
  { name: 'Massiel Perozo', bio: 'Mr. Worldwide, dale', photo: 'massiel', profile: 'https://www.linkedin.com/in/massiel-perozo-5b30b4304/' },
  { name: 'Daniel Bruno', bio: 'Líder. Genio.', photo: 'daniel', profile: 'https://www.linkedin.com/in/daniel-bruno-b63591217/' },
  { name: 'Valeria Riera', bio: 'It was all my design, \'cause I\'m a mastermind', photo: 'valeria', profile: 'https://www.linkedin.com/in/valeriarierat' },
]
