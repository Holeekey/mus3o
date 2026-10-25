import { MuseumSchema, type Museum } from '@mus3o/shared'
import {
  aluChip,
  controlUnit,
  registerFile,
  systemClock,
  cacheL1,
  ramStick,
  nvmeSsd,
  dataBus,
  addressBus,
  controlBus,
} from './assets/pcAssets'
import {
  phospholipidBilayer,
  proteinChannel,
  sodiumPotassiumPump,
  atpSynthase,
  krebsCycle,
  cristaeMitochondria,
  dnaDoubleHelix,
  mrnaTranscription,
  ribosomeTranslation,
} from './assets/bioAssets'
import {
  corinthianColumn,
  rostraSpeakers,
  romanLaw,
  curiaIulia,
  fasces,
  meditationsAurelius,
  romanScutum,
  gladiusHispaniensis,
  viaAppia,
} from './assets/romanAssets'

import { osteoarticularMuseum, osteoarticularNotes } from './osteoarticularPreset'

export * from './assets'

export interface PresetPalace {
  id: string
  title: string
  subtitle: string
  icon: string
  themeBadge: string
  roomCount: number
  conceptCount: number
  museum: Museum
  /** Apuntes de origen: con ellos cada concepto muestra su cita y su línea. */
  sourceText?: string
}

const computerArchitectureMuseum: Museum = MuseumSchema.parse({
  title: 'Arquitectura de Computadores & Von Neumann',
  theme: {
    palette: ['#00ffcc', '#1a1b26', '#3b82f6'],
    ambience: 'cyberpunk',
  },
  mode: 'education',
  rooms: [
    {
      id: 'r-cpu',
      name: 'Unidad Central de Procesamiento',
      description: 'El núcleo de cómputo donde se ejecutan y sincronizan las instrucciones maestro.',
      theme: 'cyberpunk',
      palette: { primary: '#00ffcc', fogColor: '#0b132b' },
      monument: 'ring_system',
      pieces: [
        {
          id: 'cpu-alu',
          title: 'Unidad Aritmético-Lógica (ALU)',
          text: 'Circuito combinacional de alta velocidad que realiza operaciones booleanas y sumas binarias.',
          fact: 'Opera en fracciones de nanosegundo sobre buses de 64 bits.',
          mnemonicCue: 'Una fragua de magma digital que forja sumas a la velocidad de la luz en el centro de la sala.',
          model: { type: 'procedural', parts: aluChip() },
        },
        {
          id: 'cpu-cu',
          title: 'Unidad de Control (UC)',
          text: 'Decodifica el código de operación y comanda las microórdenes que guían los buses.',
          fact: 'Gobierna el ciclo de instrucción: búsqueda, decodificación y ejecución.',
          mnemonicCue: 'Un director de orquesta holográfico que dispara impulsos luminosos hacia cada compuerta.',
          model: { type: 'procedural', parts: controlUnit() },
        },
        {
          id: 'cpu-reg',
          title: 'Registros de Trabajo',
          text: 'Celdas de memoria ultrarrápidas dentro del die de la CPU accesibles en un ciclo de reloj.',
          fact: 'Contienen el Contador de Programa (PC) y el Acumulador.',
          mnemonicCue: 'Cofres de cristal resplandeciente flotando pegados al corazón del procesador.',
          model: { type: 'procedural', parts: registerFile() },
        },
        {
          id: 'cpu-clock',
          title: 'Reloj del Sistema',
          text: 'Oscilador de cuarzo que sincroniza el avance coordinado de todos los flip-flops.',
          fact: 'A 4 GHz genera 4 mil millones de pulsos cuadrados por segundo.',
          mnemonicCue: 'Un metrónomo dorado gigantesco cuyo tic-tac hace temblar el suelo del templo.',
          model: { type: 'procedural', parts: systemClock() },
        },
      ],
    },
    {
      id: 'r-mem',
      name: 'Jerarquía de Memoria',
      description: 'Estratificación de almacenamiento optimizada entre velocidad, costo y persistencia.',
      theme: 'cathedral',
      palette: { primary: '#3b82f6', fogColor: '#0f172a' },
      monument: 'crystal',
      pieces: [
        {
          id: 'mem-l1',
          title: 'Caché L1',
          text: 'Memoria estática SRAM microscópica integrada en el núcleo para evitar paradas de ejecución.',
          fact: 'Tiene latencia de 1 a 4 ciclos de reloj.',
          mnemonicCue: 'Un rayo de hielo congelado que conecta la memoria principal directamente al procesador.',
          model: { type: 'procedural', parts: cacheL1() },
        },
        {
          id: 'mem-ram',
          title: 'Memoria RAM Principal',
          text: 'Memoria dinámica DRAM volátil con condensadores que requieren refresco continuo.',
          fact: 'Alberga el mapa de memoria del sistema operativo y los procesos activos.',
          mnemonicCue: 'Un inmenso tablero de ajedrez donde cada casilla retiene una esfera de luz eléctrica.',
          model: { type: 'procedural', parts: ramStick() },
        },
        {
          id: 'mem-ssd',
          title: 'Almacenamiento NVMe',
          text: 'Memoria Flash NAND con celdas de compuerta flotante que conservan los datos sin energía.',
          fact: 'Alcanza tasas de transferencia superiores a 7 GB/s vía PCIe.',
          mnemonicCue: 'Un monolito de obsidiana negra indestructible que retiene los recuerdos de la máquina.',
          model: { type: 'procedural', parts: nvmeSsd() },
        },
      ],
    },
    {
      id: 'r-bus',
      name: 'Buses del Sistema y E/S',
      description: 'Vías de comunicación multiplexadas que transportan datos, direcciones y señales de control.',
      theme: 'void',
      palette: { primary: '#a855f7', fogColor: '#180e29' },
      monument: 'dodecahedron',
      pieces: [
        {
          id: 'bus-data',
          title: 'Bus de Datos',
          text: 'Canal bidireccional por el que viajan los operandos y resultados de las instrucciones.',
          fact: 'El ancho del bus determina cuántos bits se transfieren en paralelo por ciclo.',
          mnemonicCue: 'Un río de fotones violetas fluyendo a ambos lados del corredor.',
          model: { type: 'procedural', parts: dataBus() },
        },
        {
          id: 'bus-addr',
          title: 'Bus de Direcciones',
          text: 'Canal unidireccional que transporta la ubicación física de memoria a la que se accede.',
          fact: 'Un bus de 32 bits puede direccionar 4 GB; 64 bits puede direccionar 16 Exabytes.',
          mnemonicCue: 'Un faro láser que proyecta coordenadas numéricas gigantes sobre los muros.',
          model: { type: 'procedural', parts: addressBus() },
        },
        {
          id: 'bus-ctrl',
          title: 'Bus de Control',
          text: 'Señales de habilitación de lectura, escritura, interrupciones y reloj.',
          fact: 'Sincroniza los dispositivos lentos de entrada/salida con la alta velocidad del procesador.',
          mnemonicCue: 'Semáforos flotantes de cristal que dan paso ordenado a las ráfagas de datos.',
          model: { type: 'procedural', parts: controlBus() },
        },
      ],
    },
  ],
  graph: {
    start: 'r-cpu',
    edges: [
      { from: 'r-cpu', to: 'r-mem', kind: 'next' },
      { from: 'r-cpu', to: 'r-mem', kind: 'prerequisite' },
      { from: 'r-mem', to: 'r-bus', kind: 'next' },
      { from: 'r-mem', to: 'r-bus', kind: 'prerequisite' },
    ],
  },
})

const cellBiologyMuseum: Museum = MuseumSchema.parse({
  title: 'Biología Celular: La Fábrica de la Vida',
  theme: {
    palette: ['#10b981', '#064e3b', '#f59e0b'],
    ambience: 'organic',
  },
  mode: 'education',
  rooms: [
    {
      id: 'r-membrane',
      name: 'Membrana Plasmática',
      description: 'Frontera semipermeable que mantiene la homeostasis celular respecto al exterior.',
      theme: 'organic',
      palette: { primary: '#10b981', fogColor: '#052e16' },
      monument: 'torus',
      pieces: [
        {
          id: 'bio-lipid',
          title: 'Bicapa Fosfolipídica',
          text: 'Mosaico fluido con cabezas hidrofílicas hacia el agua y colas hidrofóbicas hacia el interior.',
          fact: 'Permite el paso espontáneo de pequeñas moléculas no polares como O2 y CO2.',
          mnemonicCue: 'Una muralla viviente de esferas aceitosas ondulando como las olas de un mar verde.',
          model: { type: 'procedural', parts: phospholipidBilayer() },
        },
        {
          id: 'bio-channel',
          title: 'Proteínas de Canal',
          text: 'Túneles proteicos con compuerta selectiva para el transporte pasivo de iones específicos.',
          fact: 'El canal de potasio deja pasar K+ pero bloquea Na+ por diferencia de hidratación.',
          mnemonicCue: 'Compuertas de coral luminoso que se abren solo cuando reconocen la contraseña química.',
          model: { type: 'procedural', parts: proteinChannel() },
        },
        {
          id: 'bio-pump',
          title: 'Bomba Sodio-Potasio',
          text: 'Transportador activo primario que expulsa 3 Na+ e introduce 2 K+ consumiendo una molécula de ATP.',
          fact: 'Consume hasta un 30% del ATP total de una neurona para mantener el potencial de reposo.',
          mnemonicCue: 'Un pistón biológico latiendo que bombea esferas doradas contra la corriente.',
          model: { type: 'procedural', parts: sodiumPotassiumPump() },
        },
      ],
    },
    {
      id: 'r-mito',
      name: 'Mitocondria y Bioenergética',
      description: 'El organelo de doble membrana donde la respiración celular produce la energía química.',
      theme: 'ancient',
      palette: { primary: '#f59e0b', fogColor: '#451a03' },
      monument: 'crystal',
      pieces: [
        {
          id: 'bio-atp',
          title: 'ATP Sintasa',
          text: 'Complejo motor rotatorio que sintetiza ATP aprovechando el gradiente electroquímico de protones.',
          fact: 'Gira a más de 6.000 revoluciones por minuto acoplando ADP con fosfato inorgánico.',
          mnemonicCue: 'Una turbina hidroeléctrica microscópica girando furiosamente y expulsando monedas de fuego.',
          model: { type: 'procedural', parts: atpSynthase() },
        },
        {
          id: 'bio-krebs',
          title: 'Ciclo de Krebs',
          text: 'Ruta metabólica oxidativa que degrada acetil-CoA generando NADH, FADH2 y GTP en la matriz.',
          fact: 'Descubierto por Hans Krebs en 1937, clave para la respiración aeróbica.',
          mnemonicCue: 'Una rueda de molino dorada que muele azúcar y libera nubes de vapor carbónico.',
          model: { type: 'procedural', parts: krebsCycle() },
        },
        {
          id: 'bio-crest',
          title: 'Crestas Mitocondriales',
          text: 'Repliegues de la membrana interna que maximizan la superficie para la cadena de electrones.',
          fact: 'Las células cardíacas tienen miles de crestas por su altísima demanda energética.',
          mnemonicCue: 'Un laberinto de cañones plegados como un acordeón infinito en las paredes.',
          model: { type: 'procedural', parts: cristaeMitochondria() },
        },
      ],
    },
    {
      id: 'r-nucleus',
      name: 'Núcleo y Expresión Génica',
      description: 'El santuario que custodia el genoma eucariota y orquesta la transcripción proteica.',
      theme: 'cathedral',
      palette: { primary: '#6366f1', fogColor: '#1e1b4b' },
      monument: 'ring_system',
      pieces: [
        {
          id: 'bio-dna',
          title: 'Doble Hélice de ADN',
          text: 'Polímero de desoxirribonucleótidos unidos por puentes de hidrógeno entre bases complementarias.',
          fact: 'Contiene 3.200 millones de pares de bases empaquetadas en 23 pares de cromosomas.',
          mnemonicCue: 'Una escalera de caracol de cristal estelar que gira elevándose hasta el techo de la catedral.',
          model: { type: 'procedural', parts: dnaDoubleHelix() },
        },
        {
          id: 'bio-mrna',
          title: 'ARN Mensajero y Transcripción',
          text: 'Copia monocatenaria del gen que sale por los poros nucleares hacia el citoplasma.',
          fact: "Pasa por maduración: corte y empalme (splicing), caperuza en 5' y cola poli-A en 3'.",
          mnemonicCue: 'Un pergamino resplandeciente flotando velozmente a través de un portal circular.',
          model: { type: 'procedural', parts: mrnaTranscription() },
        },
        {
          id: 'bio-ribo',
          title: 'Ribosomas y Traducción',
          text: 'Complejo ribonucleoproteico que lee codones de 3 letras y acopla aminoácidos en péptidos.',
          fact: 'Posee sitios A (aminoacil), P (peptidil) y E (salida) para los ARN de transferencia.',
          mnemonicCue: 'Una máquina de coser cósmica que ensambla collares de perlas de colores sobre el pedestal.',
          model: { type: 'procedural', parts: ribosomeTranslation() },
        },
      ],
    },
  ],
  graph: {
    start: 'r-membrane',
    edges: [
      { from: 'r-membrane', to: 'r-mito', kind: 'next' },
      { from: 'r-membrane', to: 'r-mito', kind: 'prerequisite' },
      { from: 'r-mito', to: 'r-nucleus', kind: 'next' },
      { from: 'r-mito', to: 'r-nucleus', kind: 'prerequisite' },
    ],
  },
})

const romanEmpireMuseum: Museum = MuseumSchema.parse({
  title: 'Imperio Romano: Poder, Ley y Filosofía',
  theme: {
    palette: ['#b5543c', '#e8d5b0', '#854d0e'],
    ambience: 'ancient',
  },
  mode: 'education',
  rooms: [
    {
      id: 'r-forum',
      name: 'El Foro y el Espacio Cívico',
      description: 'El corazón de la civitas donde convergían los tribunales, los comicios y el comercio.',
      theme: 'ancient',
      palette: { primary: '#b5543c', fogColor: '#2b140e' },
      monument: 'torus',
      pieces: [
        {
          id: 'rom-column',
          title: 'Columna Corintia',
          text: 'Orden arquitectónico predilecto de Roma, símbolo de monumentalidad imperial y elegancia.',
          fact: 'Inspirada en el follaje de acanto sobre una cesta mortuoria en Corinto.',
          mnemonicCue: 'Una columna de mármol cuyas hojas talladas en piedra susurran discursos de Cicerón.',
          model: { type: 'procedural', parts: corinthianColumn() },
        },
        {
          id: 'rom-rostra',
          title: 'Rostra de los Oradores',
          text: 'Tribuna pública adornada con los espolones de bronce capturados a las naves enemigas.',
          fact: 'Desde aquí se proclamaban los discursos fúnebres de los héroes y las leyes de los tribunos.',
          mnemonicCue: 'Un estrado de bronce forjado con colmillos de barcos de guerra apuntando al espectador.',
          model: { type: 'procedural', parts: rostraSpeakers() },
        },
        {
          id: 'rom-law',
          title: 'Derecho Romano (Ius Civile)',
          text: 'Cuerpo normativo que fundó la tradición jurídica occidental sobre equidad y jurisprudencia.',
          fact: 'Desde la Ley de las XII Tablas hasta el Corpus Iuris Civilis de Justiniano.',
          mnemonicCue: 'Doce tablas de bronce flotantes grabadas con cincel ardiendo con fuego azul.',
          model: { type: 'procedural', parts: romanLaw() },
        },
      ],
    },
    {
      id: 'r-senate',
      name: 'El Senado y la Filosofía Estoica',
      description: 'La auctoritas patrum y la doctrina estoica que templó el carácter de sus gobernantes.',
      theme: 'cathedral',
      palette: { primary: '#854d0e', fogColor: '#1c140b' },
      monument: 'dodecahedron',
      pieces: [
        {
          id: 'rom-senate-curia',
          title: 'Curia Iulia',
          text: 'Sede del Senado donde los patres deliberaban sobre la guerra, los tratados y las finanzas.',
          fact: 'Su suelo de opus sectile combinaba pórfido rojo de Egipto y mármol verde de Esparta.',
          mnemonicCue: 'Una banca de senadores esculpida en piedra milenaria donde una toga blanca arde sin consumirse.',
          model: { type: 'procedural', parts: curiaIulia() },
        },
        {
          id: 'rom-fasces',
          title: 'Fasces Consulares',
          text: 'Haz de varas de olmo con un hacha central que portaban los lictores como símbolo del imperium.',
          fact: 'Simbolizaban que la unión hace la fuerza y el poder legítimo de administrar justicia.',
          mnemonicCue: 'Un haz de varas atadas con correas de cuero rojo y un hacha que refleja la verdad pura.',
          model: { type: 'procedural', parts: fasces() },
        },
        {
          id: 'rom-marcus',
          title: 'Meditaciones de Marco Aurelio',
          text: 'Reflexiones íntimas del emperador filósofo sobre el deber estoico, la muerte y la serenidad.',
          fact: 'Escritas en campaña militar junto al río Danubio durante las guerras marcomanas.',
          mnemonicCue: 'Una ciudadela de granito inmutable que permanece inmóvil mientras relámpagos caen a su alrededor.',
          model: { type: 'procedural', parts: meditationsAurelius() },
        },
      ],
    },
    {
      id: 'r-legion',
      name: 'Las Legiones y la Pax Romana',
      description: 'La maquinaria disciplinada de infantería pesada que aseguró las fronteras del imperio.',
      theme: 'void',
      palette: { primary: '#dc2626', fogColor: '#1a0808' },
      monument: 'crystal',
      pieces: [
        {
          id: 'rom-scutum',
          title: 'Scutum y la Formación en Testudo',
          text: 'Escudo curvo de madera contrachapada con umbo de hierro capaz de formar una muralla móvil.',
          fact: 'Los legionarios se cubrían frontal y cenitalmente volviendo a la unidad inmune a proyectiles.',
          mnemonicCue: 'Un caparazón de tortuga gigante de roble rojo y bronce que repele lluvia de saetas.',
          model: { type: 'procedural', parts: romanScutum() },
        },
        {
          id: 'rom-gladius',
          title: 'Gladius Hispaniensis',
          text: 'Espada corta de doble filo diseñada para estocadas letales y rápidas en combate cerrado.',
          fact: 'Adoptada tras las guerras púnicas al comprobar su superioridad frente a espadas de corte.',
          mnemonicCue: 'Una hoja de acero toledano reluciente flotando sobre un pedestal envuelta en laureles de oro.',
          model: { type: 'procedural', parts: gladiusHispaniensis() },
        },
        {
          id: 'rom-road',
          title: 'Calzadas y Vía Apia',
          text: 'Red viaria pavimentada con gravilla, mortero y losas poligonales de basalto que unió el mundo.',
          fact: 'Más de 80.000 kilómetros de calzadas principales permitían marchar 40 km por día a las legiones.',
          mnemonicCue: 'Un camino de adoquines negros que se extiende hacia el infinito cruzando montañas y ríos.',
          model: { type: 'procedural', parts: viaAppia() },
        },
      ],
    },
  ],
  graph: {
    start: 'r-forum',
    edges: [
      { from: 'r-forum', to: 'r-senate', kind: 'next' },
      { from: 'r-forum', to: 'r-senate', kind: 'prerequisite' },
      { from: 'r-senate', to: 'r-legion', kind: 'next' },
      { from: 'r-senate', to: 'r-legion', kind: 'prerequisite' },
    ],
  },
})

export const PRESET_PALACES: PresetPalace[] = [
  {
    id: 'osteoarticular-infections',
    title: 'Infecciones osteoarticulares',
    subtitle: 'Pediatría: osteomielitis, artritis séptica, diagnóstico y tratamiento',
    icon: '🦴',
    themeBadge: 'Desde apuntes reales',
    roomCount: osteoarticularMuseum.rooms.length,
    conceptCount: osteoarticularMuseum.rooms.reduce((n, r) => n + r.pieces.length, 0),
    museum: osteoarticularMuseum,
    sourceText: osteoarticularNotes,
  },
  {
    id: 'computer-architecture',
    title: 'Arquitectura de Computadores',
    subtitle: 'CPU Von Neumann, Jerarquía de Memoria y Buses',
    icon: '⚡',
    themeBadge: 'Cyberpunk & Catedral',
    roomCount: 3,
    conceptCount: 10,
    museum: computerArchitectureMuseum,
  },
  {
    id: 'cell-biology',
    title: 'Biología Celular',
    subtitle: 'Membrana, Mitocondria, ATP y Núcleo Genómico',
    icon: '🧬',
    themeBadge: 'Orgánico & Sensorial',
    roomCount: 3,
    conceptCount: 9,
    museum: cellBiologyMuseum,
  },
  {
    id: 'roman-empire',
    title: 'Imperio Romano & Filosofía',
    subtitle: 'El Foro, Derecho Romano, El Senado y Legiones',
    icon: '🏛️',
    themeBadge: 'Clásico & Antiguo',
    roomCount: 3,
    conceptCount: 9,
    museum: romanEmpireMuseum,
  },
]
