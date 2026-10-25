import { findSourceLine, type ImageSearch, type Museum } from "@mus3o/shared";

/**
 * Capa de recuperación: el modelo no genera imágenes ni citas; el sistema las busca.
 * Aquí solo se preparan las pistas de búsqueda (el servidor las resuelve en /api/image)
 * y se recuperan las fuentes de los apuntes. Pura: no muta la entrada.
 */

const EN_WORDS = new Set("the and of is are was were with that this for from which their".split(" "));
const ES_WORDS = new Set("el la los las de del y es son fue con que para por una un se en su sus como".split(" "));

/** Heurística simple: español salvo que el texto sea claramente inglés. */
export function detectLang(text: string): string {
  const words = text.toLowerCase().match(/[a-záéíóúñü]+/g) ?? [];
  let en = 0;
  let es = 0;
  for (const w of words.slice(0, 600)) {
    if (EN_WORDS.has(w)) en++;
    if (ES_WORDS.has(w)) es++;
  }
  return en >= 5 && en > es * 1.5 ? "en" : "es";
}

const search = (title: string, lang: string, context: string): ImageSearch => ({
  wikiTitle: title.slice(0, 120),
  lang,
  context: context.slice(0, 120),
});

/** Contexto de una pieza: su sala y el tema del palacio ("Armada" + "Despliegue militar" + "Estados Unidos y Venezuela"). Cabe en 120. */
export function pieceContext(roomName: string, museumTitle: string): string {
  if (!museumTitle) return roomName.slice(0, 120);
  const room = roomName.slice(0, 50);
  return `${room} · ${museumTitle.slice(0, 120 - room.length - 3)}`;
}

/** Pone `imageSearch` en cada sala (contexto: título del museo) y pieza (contexto: sala + título del museo) que no la tenga. */
export function attachImageSearches(museum: Museum, text: string): Museum {
  const lang = detectLang(text || museum.title);
  return {
    ...museum,
    rooms: museum.rooms.map((room) => ({
      ...room,
      imageSearch: room.imageSearch ?? search(room.name, lang, museum.title),
      pieces: room.pieces.map((piece) =>
        piece.imageSearch || piece.image ? piece : { ...piece, imageSearch: search(piece.title, lang, pieceContext(room.name, museum.title)) },
      ),
    })),
  };
}

/**
 * Para cada pieza sin fuente verificada, busca la línea de los apuntes que la respalda
 * (`findSourceLine`); si no hay ninguna, queda `unverified`. No pide citas al modelo.
 */
export function retrieveSources(museum: Museum, notes: string): Museum {
  let found = 0;
  let total = 0;
  const rooms = museum.rooms.map((room) => ({
    ...room,
    pieces: room.pieces.map((piece) => {
      total++;
      if (piece.source && !piece.unverified) {
        found++;
        return piece;
      }
      const { unverified: _u, source: _s, ...rest } = piece;
      const hit = findSourceLine(notes, piece);
      if (hit) {
        found++;
        return { ...rest, source: hit };
      }
      return { ...rest, unverified: true };
    }),
  }));
  console.log(`fuentes recuperadas: ${found}/${total} piezas`);
  return { ...museum, rooms };
}
