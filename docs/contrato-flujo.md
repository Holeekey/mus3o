# Propuesta: contrato del flujo de generación

> Estado: **implementado** en `feature/flow` (contrato en `packages/shared`, server en `apps/server`).
> Base: `packages/shared/src/schema.ts` en `dev` (`20cb28e`).

## 1. Objetivo

Extender el contrato `Museum` para soportar el flujo completo:

```
chat (texto + archivos + imágenes)
  → [Mejorar prompt] (solo debug)  |  [Generar] con un modo elegido antes
  → temario (salas y piezas) + grafo de salas + imágenes asignadas por la IA
  → mapa del grafo + mapa del museo (ambos dinámicos)
```

**Regla principal: solo se agregan campos opcionales.** Todo lo que hoy consume `apps/web`
(`title`, `theme.palette`, `rooms[].pieces[]`, `piece.position`, `piece.model`) sigue igual.
Un `Museum` viejo sigue validando y el frontend sigue funcionando sin cambios.

## 2. Decisiones

| Tema | Decisión | Motivo |
|---|---|---|
| Temario | **No es un campo aparte.** Sala = tema, pieza = subtema | Evita duplicar datos y gastar tokens de salida |
| Modo | Se elige antes de generar y viaja en el request y en la respuesta | Cambia el prompt y la forma del grafo |
| Cantidad de salas | Dinámica según los temas, dentro de los límites actuales (1 a 12; el servidor pide 3-12 según el volumen de contenido) | Ya está en `MuseumSchema` |
| Grafo | Los nodos son las salas; se agregan solo las aristas y la sala inicial | Los dos mapas salen de la misma fuente |
| Archivos (PDF, Word, Excel, CSV, txt) | El texto se extrae en el navegador y se envía solo el texto | Regla de `architecture` y `docs/seguridad.md` §6: no se guardan documentos |
| Imágenes | Se envían en memoria; la IA decide en qué pieza va cada una | Decisión del equipo |
| Bytes de las imágenes en la respuesta | **No vuelven.** La respuesta trae solo el `imageId` | El frontend ya tiene las imágenes en memoria |

## 3. Request

### `POST /api/generate-museum` (se extiende el endpoint existente)

```ts
export const MuseumModeSchema = z.enum(["exploration", "quiz", "biography", "education"]);

export const SourceSchema = z.object({
  name: z.string().min(1).max(120),
  kind: z.enum(["docx", "xlsx", "csv", "txt"]),
  text: z.string().max(LIMITS.maxNotesChars), // texto ya extraído en el navegador
});

export const InputImageSchema = z.object({
  id: z.string().regex(/^img-\d{1,2}$/), // lo genera el frontend: img-1, img-2...
  name: z.string().min(1).max(120),
  mediaType: z.enum(["image/jpeg", "image/png", "image/webp", "image/gif"]),
  data: z.string(), // base64, redimensionada en el navegador a <= 1024 px
});

export const GenerateMuseumRequestSchema = z.object({
  mode: MuseumModeSchema.default("exploration"),
  prompt: z.string().trim().min(1).max(LIMITS.maxNotesChars),
  sources: z.array(SourceSchema).max(5).default([]),
  images: z.array(InputImageSchema).max(LIMITS.maxImages).default([]), // 6
});
```

- Compatibilidad: los formatos viejos `{ topic }` y `{ notes }` siguen funcionando igual; el server los atiende por el camino anterior.
- El texto total (`prompt` + `sources[].text`) no supera `LIMITS.maxNotesChars` (20.000 caracteres).
- Las imágenes deben tener ids únicos.

### `POST /api/improve-prompt` (solo debug)

```ts
export const ImprovePromptRequestSchema = GenerateMuseumRequestSchema.omit({ images: true });

export const ImprovePromptResponseSchema = z.object({
  suggestions: z.array(z.string().max(200)).max(5),
  improvedPrompt: z.string().max(2_000),
});
```

Solo se habilita con una variable de entorno (por ejemplo `ENABLE_DEBUG_ROUTES=true`).

## 4. Respuesta: `Museum` extendido

Los campos nuevos están marcados con `// NUEVO`. Todos son opcionales.

```ts
export const QuizSchema = z.object({ // NUEVO
  question: z.string().min(1).max(200),
  options: z.array(z.string().min(1).max(100)).min(2).max(4),
  answerIndex: z.number().int().min(0).max(3),
});

export const PieceSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  text: z.string(),
  fact: z.string(),
  position: vec3,
  model: ModelSchema,
  image: z.object({ imageId: z.string() }).optional(), // NUEVO: imagen del usuario en el cuadro
  quiz: QuizSchema.optional(),                          // NUEVO: obligatorio en modo quiz
});

export const RoomSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  pieces: z.array(PieceSchema).min(1).max(12),
  period: z.string().max(40).optional(), // NUEVO: obligatorio en modo biography ("1879–1905")
});

export const GraphEdgeSchema = z.object({ // NUEVO
  from: z.string().min(1), // id de sala
  to: z.string().min(1),
  kind: z.enum(["next", "prerequisite", "related"]),
});

export const MuseumGraphSchema = z.object({ // NUEVO
  start: z.string().min(1), // sala donde aparece el jugador
  edges: z.array(GraphEdgeSchema).max(16),
});

export const MuseumSchema = z.object({
  title: z.string().min(1),
  theme: z.object({ palette: z.array(hex).min(2).max(8), ambience: z.string() }),
  rooms: z.array(RoomSchema).min(1).max(8),
  mode: MuseumModeSchema.optional(),  // NUEVO
  graph: MuseumGraphSchema.optional(), // NUEVO: si falta, el frontend usa el orden de rooms
});
```

### Validaciones extra (`superRefine`)

1. Los ids de sala y de pieza son únicos.
2. `graph.start` y cada `from`/`to` existen en `rooms`. No hay aristas de una sala a sí misma.
3. Todas las salas son alcanzables desde `graph.start`.
4. Cada `piece.image.imageId` existe entre las imágenes del request, y cada imagen se usa una sola vez.
5. Reglas por modo (tabla siguiente).

## 5. Reglas por modo

| Modo | Forma del grafo | Campos obligatorios | Enfoque del prompt |
|---|---|---|---|
| `exploration` | Árbol desde `start` (hub con ramas) | — | Panorama amplio, temas relacionados |
| `education` | Camino `next` en orden; `prerequisite` opcional | — | De lo básico a lo avanzado |
| `biography` | Cadena `next` cronológica | `room.period` | Etapas de la vida, en orden |
| `quiz` | Cualquiera de las anteriores | `piece.quiz` en todas las piezas | Contenido evaluable |

## 6. Los dos mapas

| Mapa | Fuente | Dónde |
|---|---|---|
| Mapa del grafo (conceptual) | `rooms` + `graph` | Frontend (Gabriel) |
| Mapa del museo (espacial) | `layoutMuseum(museum)`: función pura que ubica las salas en una grilla recorriendo el grafo desde `start`; cada arista se convierte en una puerta | `packages/shared`, para que la usen la escena 3D y el minimapa |

`piece.position` sigue siendo local a cada sala, así que la posición de las salas no cambia el contrato.

## 7. Seguridad y costo

- Las notas, las fuentes y las descripciones de imágenes van dentro de `<user_notes>` (`docs/seguridad.md` §3).
- El límite de `express.json` se sube solo en esta ruta (~8 MB por las imágenes); el resto sigue en 10 KB.
- Nada se escribe en disco. Los logs registran solo longitudes y conteos, nunca el contenido.
- Imágenes redimensionadas a <= 1024 px en el navegador: cada una cuesta alrededor de `ancho × alto / 750` tokens de entrada.
- La caché por hash incluye el modo y el hash de las imágenes, no solo el texto.

## 8. Pendientes para decidir con el equipo

1. `docs/seguridad.md` §8 propone adoptar `Palace` de `feature/phase-1-core`; el equipo eligió `dev` (`Museum`). Actualizar esa sección.
2. Límites: este borrador mantiene los de `dev` (8 salas, 12 piezas por sala).
3. Gabriel: confirmar que puede leer `graph` y `piece.image` cuando estén presentes, y usar el orden de `rooms` cuando falten.
