/**
 * Filtro de relevancia para los resultados de BÚSQUEDA de imágenes (no para los aciertos exactos de título).
 * Wikipedia ordena por texto, no por tema: "Armada en el Caribe" trae "Armada Argentina" y "Elecciones de 2024
 * disputadas" trae las de Uruguay. Es barato y determinista (sin IA): si el resultado nombra un país o gentilicio
 * que ni la consulta ni su contexto (sala + título del palacio) mencionan, se descarta y se prueba el siguiente.
 */

const fold = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

// [país, nombres (frases), gentilicios que admiten o/a/os/as, gentilicios sueltos]
type Entry = [string, string[], string[], string[]];
const COUNTRIES: Entry[] = [
  ["ve", ["venezuela"], ["venezolan"], []],
  ["us", ["estados unidos", "eeuu", "ee uu", "usa", "united states"], [], ["estadounidense", "estadounidenses", "norteamericano", "norteamericana", "norteamericanos", "norteamericanas"]],
  ["ar", ["argentina"], ["argentin"], []],
  ["uy", ["uruguay"], ["uruguay"], []],
  ["co", ["colombia"], ["colombian"], []],
  ["mx", ["mexico"], ["mexican"], []],
  ["pe", ["peru"], ["peruan"], []],
  ["cl", ["chile"], ["chilen"], []],
  ["br", ["brasil", "brazil"], ["brasilen"], ["brasileno", "brasilena"]],
  ["bo", ["bolivia"], ["bolivian"], []],
  ["ec", ["ecuador"], ["ecuatorian"], []],
  ["py", ["paraguay"], ["paraguay"], []],
  ["cu", ["cuba"], ["cuban"], []],
  ["pa", ["panama"], ["panamen"], []],
  ["cr", ["costa rica"], ["costarricens"], []],
  ["gt", ["guatemala"], ["guatemaltec"], []],
  ["hn", ["honduras"], ["hondurena", "hondureno"], []],
  ["ni", ["nicaragua"], ["nicaragu"], ["nicaraguense", "nicaraguenses"]],
  ["sv", ["el salvador"], ["salvadoren"], []],
  ["ht", ["haiti"], ["haitian"], []],
  ["do", ["republica dominicana"], ["dominican"], []],
  ["pr", ["puerto rico"], ["puertorriquen"], []],
  ["es", ["espana"], ["espanol"], []],
  ["pt", ["portugal"], ["portugues"], []],
  ["fr", ["francia"], ["frances"], []],
  ["it", ["italia"], ["italian"], []],
  ["de", ["alemania"], ["aleman"], []],
  ["gb", ["reino unido", "gran bretana", "inglaterra", "escocia"], ["ingles", "britanic", "escoces"], []],
  ["ie", ["irlanda"], ["irlandes"], []],
  ["nl", ["paises bajos", "holanda"], ["holandes", "neerlandes"], []],
  ["be", ["belgica"], ["belg"], []],
  ["ch", ["suiza"], ["suiz"], []],
  ["at", ["austria"], ["austriac"], []],
  ["se", ["suecia"], ["suec"], []],
  ["no", ["noruega"], ["norueg"], []],
  ["dk", ["dinamarca"], ["danes"], []],
  ["fi", ["finlandia"], ["finland"], []],
  ["pl", ["polonia"], ["polac"], []],
  ["ru", ["rusia", "urss", "union sovietica"], ["rus", "sovietic"], []],
  ["ua", ["ucrania"], ["ucranian"], []],
  ["gr", ["grecia"], ["grieg"], []],
  ["tr", ["turquia", "imperio otomano"], ["turc", "otoman"], []],
  ["cn", ["china"], ["chin"], []],
  ["jp", ["japon"], ["japones"], []],
  ["kr", ["corea"], ["corean"], []],
  ["in", ["india"], ["hind"], []],
  ["ir", ["iran"], ["irani"], []],
  ["iq", ["irak"], ["iraqui"], []],
  ["il", ["israel"], ["israeli"], []],
  ["sy", ["siria"], ["siri"], []],
  ["sa", ["arabia saudita", "arabia saudi"], ["saudi"], []],
  ["eg", ["egipto"], ["egipci"], []],
  ["ma", ["marruecos"], ["marroqui"], []],
  ["za", ["sudafrica"], ["sudafrican"], []],
  ["ng", ["nigeria"], ["nigerian"], []],
  ["au", ["australia"], ["australian"], []],
  ["ca", ["canada"], ["canadiens"], []],
];

const NAME_RES: Array<[string, RegExp]> = [];
const TOKEN_DEMONYM = new Map<string, string>();
for (const [id, names, stems, loose] of COUNTRIES) {
  for (const n of names) NAME_RES.push([id, new RegExp(`(?:^| )${n}(?: |$)`)]);
  for (const s of stems) for (const suf of ["", "o", "a", "os", "as", "e", "es"]) TOKEN_DEMONYM.set(s + suf, id);
  for (const w of loose) TOKEN_DEMONYM.set(w, id);
}

/** Países (o gentilicios) que menciona un texto. */
export function countriesIn(text: string): Set<string> {
  const t = fold(text);
  const out = new Set<string>();
  for (const [id, re] of NAME_RES) if (re.test(t)) out.add(id);
  for (const w of t.split(" ")) {
    const id = TOKEN_DEMONYM.get(w);
    if (id) out.add(id);
  }
  return out;
}

/**
 * ¿El título de un resultado de búsqueda es admisible para esta consulta? Rechaza si nombra un país que la
 * consulta y su contexto no mencionan (otro país, otro tema).
 */
export function contradictsCountry(query: string, context: string, hitTitle: string): boolean {
  const hit = countriesIn(hitTitle);
  if (hit.size === 0) return false;
  const known = countriesIn(`${query} ${context}`);
  for (const c of hit) if (!known.has(c)) return true;
  return false;
}
