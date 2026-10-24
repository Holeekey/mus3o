import type { Museum } from '@mus3o/shared'
import { CARABOBO_PIECES } from '../diorama/carabobo'

// Museo de prueba local para ?demo=carabobo: una sala con los conceptos que el diorama enlaza.
export const carababoMuseum: Museum = {
  title: 'Carabobo, 1821',
  theme: { palette: ['#8e2a1e', '#c9963a', '#26408b', '#efe8d8'], ambience: 'Sabana al mediodía' },
  rooms: [
    {
      id: 'carabobo',
      name: 'Batalla de Carabobo',
      description: 'La victoria que selló la independencia de Venezuela.',
      pieces: [
        { id: CARABOBO_PIECES.bolivar, title: 'Simón Bolívar', text: 'Comandante en jefe del ejército patriota. Dirigió la campaña que terminó en Carabobo.', fact: 'Carabobo se libró el 24 de junio de 1821.' },
        { id: CARABOBO_PIECES.paez, title: 'José Antonio Páez', text: 'General al mando de la división de llaneros que decidió el combate con una carga.', fact: 'Bolívar lo ascendió a general en jefe en el campo de batalla.' },
        { id: CARABOBO_PIECES.torre, title: 'Miguel de la Torre', text: 'Jefe del ejército realista; defendió la posición con infantería y artillería.', fact: 'Tras la derrota se replegó a Puerto Cabello.' },
        { id: CARABOBO_PIECES.camejo, title: 'Pedro Camejo, Negro Primero', text: 'Lancero llanero que murió en la carga. Su valor se volvió leyenda.', fact: 'Según la tradición, Bolívar lo llamó "Negro Primero".' },
        { id: 'carabobo-fecha', title: '24 de junio de 1821', text: 'Fecha de la batalla; hoy se celebra el Día del Ejército en Venezuela.', fact: 'Ocurrió en el valle de Carabobo, cerca de Valencia.' },
        { id: 'carabobo-consecuencia', title: 'Independencia de Venezuela', text: 'La derrota realista abrió el camino a la liberación definitiva del territorio venezolano.', fact: 'Puerto Cabello cayó en 1823.' },
      ],
    },
  ],
}
