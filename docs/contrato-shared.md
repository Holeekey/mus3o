# Contrato compartido (`packages/shared`)

Fuente de verdad de los datos. Todo lo que entra o sale del servidor, y todo lo que se guarda
en `localStorage`, se valida con estos esquemas Zod. Archivos:

| Archivo | Contenido |
|---|---|
| `src/schema.ts` | Todos los esquemas, límites (`LIMITS`), reglas de modo y grafo, tipos exportados |
| `src/sources.ts` | Verificación de citas contra los apuntes (`verifySources`, `locateFragment`, `prepareText`, `locateIn`, `sanitizeRawSources`) |
| `src/grid.ts` | Cuadrícula para colocar salas (lo usa el layout del frontend) |
| `src/mock.ts` | `sampleMuseum`: museo mínimo de ejemplo (servidor sin API key y fallback del cliente) |
| `src/index.ts` | Re-exporta todo |

Tests: `schema.test.ts`, `sources.test.ts`, `diorama.test.ts`, `grid.test.ts`.

---

## 1. Límites (`LIMITS`)

| Clave | Valor | Uso |
|---|---|---|
| `maxNotesChars` | 20 000 | Texto total (prompt + fuentes) y prompt de apuntes |
| `maxRooms` | 8 | Salas por museo |
| `maxPiecesPerRoom` | 12 | Piezas por sala |
| `maxTitle` | 80 | Títulos de sala, pieza y del museo |
| `maxText` | 400 | Descripciones, `text` y `fact` |
| `maxImages` | 6 | Imágenes subidas por el usuario en una generación |
| `maxQuote` | 240 | Cita de fuente |
| `maxDigestInputChars` | 200 000 | Texto total que acepta `/api/digest-sources` |
| `maxDigestChars` | 15 000 | Largo máximo del temario base (prompt + temario < 20 000) |

Otros límites: `DIORAMA_HALF = 14` (los props viven en [-14, 14] m), `MAX_PROPS = 24`.
Coordenadas de piezas acotadas a ±5 y rotaciones a ±7 para que una salida descuidada no rompa la escena.

## 2. El objeto `Museum`

```ts
Museum = {
  title: string                 // 1..80
  theme?: { palette: hex[2..8], ambience: string }
  rooms: Room[]                 // 1..8
  mode?: "exploration" | "quiz" | "biography" | "education"
  graph?: { start: string, edges: GraphEdge[≤16] }
  sourceTextHash?: string       // SHA-256 (hex) de los apuntes verificados
}

Room = {
  id: string, name: string (≤80), description: string (≤400, default "")
  pieces: Piece[] (≤12)
  period?: string (≤40)          // obligatorio en biography
  imageSearch?: ImageSearch      // cuadro principal de la sala
  diorama?: Diorama              // si es inválido se descarta (.catch), no falla el museo
}

Piece = {
  id: string, title: string (≤80), text: string (≤400), fact: string (≤400, default "")
  position?: [x, y, z]           // opcional: el layout del frontend decide la ubicación
  model?: Model                  // catalog | procedural | glyph
  image?: { imageId }            // imagen subida por el usuario que la IA asignó
  quiz?: Quiz                    // obligatorio en modo quiz
  imageSearch?: ImageSearch      // búsqueda de imagen real (Wikimedia)
  source?: { quote (≤240), line? }  // trazabilidad a los apuntes
  unverified?: boolean           // true = la IA agregó la idea, no está en los apuntes
}
```

### Modelos de pieza (`Model`, discriminado por `type`)

| Tipo | Campos | Cómo se dibuja |
|---|---|---|
| `procedural` | `parts[1..40]`: `{ shape: box\|cylinder\|sphere\|cone, args[≤8], pos, rot, color }` | Primitivas combinadas en el cliente (`ProceduralModel.tsx`) |
| `catalog` | `id` | Modelo del catálogo `apps/web/public/models/catalog.json` (solo lectura de ese JSON) |
| `glyph` | `shape`: icosahedron, octahedron, dodecahedron, tetrahedron, torus, cone, box, sphere | Forma geométrica simple, sin IA |

Cada valor de `args` se acota a 0..32 en el schema. El comentario de `PartSchema` habla de "≤ 4 m"
para medidas, pero el schema solo fija 32, y el renderizado vuelve a acotar (ver
[estado-y-pendientes.md](./estado-y-pendientes.md), discrepancias).

### Quiz

`{ question (≤200), options: 2..4 strings (≤100 c/u), answerIndex }`. `answerIndex` debe caer dentro de `options`.

### Imágenes

- `ImageSearch = { wikiTitle?, commonsQuery?, lang? }`: pistas para buscar en Wikipedia y Wikimedia Commons. `lang` es de 2 letras.
- `ResolvedImage`: respuesta de `GET /api/image` (`src`, dimensiones, título, autor, licencia, `kind`: painting | diagram | photo).
- `InputImage`: `{ id: "img-1".."img-99", name, mediaType, data (base64 ≤1024 px) }`.

## 3. Grafo y modos

```ts
graph = { start: roomId, edges: [{ from, to, kind: "next" | "prerequisite" | "related" }] }
```

Reglas (`checkGraph` y `checkModeGraph` en `schema.ts`):

1. `start` existe y todas las aristas apuntan a salas existentes.
2. No hay aristas de una sala a sí misma.
3. Todas las salas son alcanzables desde `start`.
4. Según `mode`:

| Modo | Forma exigida | Campos extra |
|---|---|---|
| `exploration` (por defecto) | Árbol: exactamente `salas − 1` aristas | — |
| `education` | Aristas `next` forman un único camino que empieza en `start` y cubre todas las salas | — |
| `biography` | Igual que `education` (cadena cronológica) | `period` obligatorio en cada sala |
| `quiz` | Árbol (aristas `related`) | `quiz` obligatorio en cada pieza |

Además, `checkMuseum` exige: ids de sala y de pieza únicos; cada `image.imageId` se usa en una sola pieza.

> Si `graph` falta, el frontend recorre las salas en el orden de `rooms`.

## 4. Diorama (`DioramaSchema`)

Diseñado para que la IA **elija** de una biblioteca y **coloque**, nunca que escriba geometría.

```ts
Diorama = {
  title: string (default "Diorama"),
  terrain: plain|hills|mountains|coast|river|forest|city|interior|desert|abstract  (default plain)
  time: day|sunset|night|storm (default day)
  palette: { ground, sky, accent }   // hex de 6 dígitos, con fallback
  props: DioramaProp[]               // inválidos se descartan; máx. 24
}

DioramaProp = {
  kind: figure|rider|horse|flag|cannon|tree|rock|tent|house|church|ship|column|arch|campfire|custom
  pose?, pattern? (stripes|saltire, solo flag), color?, secondary?
  pos: [x, z]  (clamp ±14)         rotY: ±7   scale: 0.5..3   count: 1..30   spread: 0..8
  label?: string (≤40)             pieceId?: id de una pieza de la MISMA sala
  parts?: Part[] (≤10)             // obligatorio si kind = custom
}
```

Cada campo tiene `.catch(valor por defecto)`: una salida rara se degrada y no tira la escena.
Detalle en [diorama.md](./diorama.md).

## 5. Fuentes (`SourceSchema`) y request de generación

```ts
Source = { name (≤120), kind: docx|xlsx|csv|txt|md|json, text (≤20 000) }   // texto ya extraído en el navegador

GenerateMuseumRequest = {
  mode: MuseumMode (default "exploration"),
  prompt: string (1..20 000, se recorta),
  sources: Source[] (≤5, default []),
  images: InputImage[] (≤6, ids únicos)
}   // total de texto (prompt + fuentes) ≤ 20 000
```

`ImprovePromptRequestSchema` es lo mismo sin imágenes. Solo se usa en la ruta de depuración.

`SourceKindSchema` es el enum de `kind`, compartido con el digest.

### Temario base (`/api/digest-sources`)

```ts
DigestSourcesRequest = { sources: { name (1..120), kind: SourceKind, text (1..100 000) }[] (1..10) }
                       // total de texto ≤ LIMITS.maxDigestInputChars (200 000)
DigestSourcesResponse = { digest: string (1..LIMITS.maxDigestChars) }
```

El navegador lo pide solo cuando el texto extraído supera `LIMITS.maxNotesChars`; el `digest` pasa a ser la única fuente del request de generación.

Compatibilidad: el servidor también acepta el formato antiguo `{ topic }` (1..200 car.) o `{ notes }`.

## 6. Cómo se usan los esquemas

| Dónde | Qué valida | Si falla |
|---|---|---|
| `apps/server/src/claude.ts` | `MuseumSchema` sobre la salida de Claude | Reintenta una vez con el error |
| `apps/server/src/app.ts` | `GenerateMuseumRequestSchema` / formato legacy | HTTP 400 |
| `apps/server/src/app.ts` | `DigestSourcesRequestSchema` | HTTP 400 |
| `apps/server/src/claude.ts` | `DigestSourcesResponseSchema` sobre el temario | HTTP 502 |
| `apps/web/src/lib/api.ts` | `MuseumSchema` sobre la respuesta | Error "La IA devolvió un palacio inválido" |
| `apps/web/src/store.ts` (`merge`) | `MuseumSchema` sobre lo guardado en `localStorage` | Se descarta el palacio guardado |
| `apps/web/src/palace/parse.ts` | `MuseumSchema` sobre el parser local | Error con mensaje para el usuario |

## 7. Tipos exportados

`MuseumMode`, `Museum`, `Room`, `Piece`, `Model`, `Part`, `Glyph`, `Quiz`, `ImageSearch`, `ResolvedImage`,
`PieceSource`, `Graph`, `GraphEdge`, `Diorama`, `DioramaProp`, `DioramaKind`, `DioramaPose`,
`DioramaTerrain`, `DioramaTime`, `FlagPattern`, `Source`, `InputImage`, `GenerateMuseumRequest`,
`ImprovePromptRequest`, `ImprovePromptResponse`, `SourceKind`, `DigestSourcesRequest`, `DigestSourcesResponse`.

## 8. Cómo cambiar el contrato sin romper nada

1. Agrega campos **opcionales** (o con `.default` / `.catch`).
2. Actualiza `schema.test.ts` con el caso nuevo.
3. Si la IA debe producirlo, actualiza el prompt en `apps/server/src/prompts.ts`.
4. Si el frontend lo pinta, actualiza `apps/web`. Un palacio viejo debe seguir validando.
5. Corre `npm test` en `shared`, `server` y `web`.
