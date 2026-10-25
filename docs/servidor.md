# Servidor (`apps/server`)

Express + `@anthropic-ai/sdk`. Puerto por defecto **3001**. Su única tarea con IA es convertir
apuntes o un tema en un `Museum` válido. Todo lo demás (validación, citas, imágenes) es determinista.

Archivos:

| Archivo | Responsabilidad |
|---|---|
| `src/index.ts` | Arranque: `dotenv`, escucha en `PORT` |
| `src/app.ts` | Rutas, CORS, límites de cuerpo, rate limits, tope diario, caché, errores |
| `src/claude.ts` | Cliente de Anthropic, `askForJson` (reintento), mock sin clave, `attachSources` |
| `src/prompts.ts` | Todos los prompts y reglas (sistema, apuntes, flujo, diorama, imágenes, mejora) |
| `src/cache.ts` | Caché en memoria, máx. 100 museos y LRU aparte de 100 temarios (`getCachedDigest`) |
| `src/images.ts` | Proxy de Wikipedia/Commons: resolución, descarga, LRU de archivos |
| `src/photoDiorama.ts` | `POST /api/diorama-from-image`: recrea en 3D la escena de una imagen real (visión), caché y semillas |

---

## 1. Endpoints

| Método y ruta | Entrada | Salida | Notas |
|---|---|---|---|
| `POST /api/generate-museum` | `{ topic }` (legacy) **o** `{ mode, prompt, sources[], images[] }` | `Museum` | Único endpoint de generación. Cuerpo ≤ 8 MB |
| `POST /api/generate-museum/stream` | Igual que `/api/generate-museum` (tema, apuntes o flujo completo) | NDJSON de `MuseumStreamEvent` (`packages/shared/src/stream.ts`): `meta`, N × `room` (con `edges` provisionales), `done` o `error` | Misma validación, caché, tope diario y límite de solicitudes que la generación sin streaming; el cliente cae a esta si el stream falla antes de la primera sala. Con `FLOW_FORMAT=json` genera entero y reproduce sala a sala |
| `POST /api/digest-sources` | `{ sources[] }` (1-10 fuentes, ≤ 200 000 car. en total) | `{ digest }` (≤ 15 000 car.) | Solo cuando el texto supera 20 000 car. Cuerpo ≤ 1 MB. 400 cuerpo inválido; 503 sin clave; 429 tope diario; 502 `No se pudo resumir las fuentes` |
| `POST /api/improve-prompt` | Mismo que el flujo sin imágenes | `{ suggestions[], improvedPrompt }` | **Solo depuración**: 404 salvo `ENABLE_DEBUG_ROUTES=true` |
| `GET /api/image?wiki=&commons=&lang=` | Pistas de imagen | `ResolvedImage` (`Cache-Control: 1 h`) | 404 `Sin imagen`; 502 `Wikimedia no disponible` |
| `GET /api/tts/status` | — | `{ enabled }` | `false` sin `ELEVENLABS_API_KEY` |
| `POST /api/tts` | `{ text }` (1-500 car.) | `audio/mpeg` (ElevenLabs, sin caché) | 503 sin clave; 400 cuerpo inválido; 429 tope diario; 502 fallo del proveedor (`fallback: "browser"`) |
| `POST /api/diorama-from-image` | `{ imageUrl, title, roomTitle, concepts[] }` (estricto) | `{ recreatable, reason?, diorama? }` | Ver sección «Dioramas desde la foto». 400 URL no permitida; 429 límite o tope diario; 502/503 (el cliente deja el cuadro normal) |
| `GET /api/image/file?u=` | URL de Wikimedia | Bytes de la imagen | Proxy: **solo hosts de Wikimedia**; si no, 400 `URL no permitida` |
| `GET /api/assets/:id.glb` | id alfanumérico (≤ 64) | `model/gltf-binary`, `Cache-Control: immutable` | Sirve la caché en disco (`.cache/assets`); 400 id inválido; 404 no cacheado |
| `GET /api/assets-review?status=` | `pending` \| `approved` \| `rejected` (opcional) | `{ assets: [{ assetId, keywords, title, author, license, score, sourceUrl, status, uses }] }` | **Solo curaduría**: 404 salvo `ENABLE_DEBUG_ROUTES=true` |
| `POST /api/assets-review/:id/:action` | `approve` \| `reject` \| `reset` | La entrada actualizada | Igual que arriba. 400 acción/id inválido; 404 modelo no registrado |

### Respuestas de error

| HTTP | Cuándo | Cuerpo |
|---|---|---|
| 400 | Cuerpo que no valida (ambos formatos) o error no controlado (handler final) | `{ error }` |
| 429 | Se alcanzó el tope diario, o rate limit | `{ error, fallback?: "placeholder" }` |
| 503 | Hay apuntes o flujo y **no hay** `ANTHROPIC_API_KEY` | `{ error: "IA no configurada" }` |
| 502 | Claude falló, devolvió JSON inválido dos veces, o Wikimedia caído | `{ error: "No se pudo generar el mus3o" }` |

El mensaje de error nunca incluye los apuntes ni la respuesta del modelo. Los logs solo registran
el tipo de error y la latencia (`generate-museum falló tras N ms: <Nombre>`).

## 2. Protecciones (orden real en `app.ts`)

1. **CORS** solo para `WEB_ORIGIN` (default `http://localhost:5173`).
2. **Tamaño de cuerpo:** `generate-museum` 8 MB (hay imágenes en base64); `digest-sources` 1 MB (hasta 200 000 caracteres de texto); el resto 100 KB.
3. **Rate limit de imágenes:** 300 peticiones por minuto por IP en `/api/image`.
4. **Rutas de imagen** (`imageRouter`).
5. **Rate limit general** en `/api/*` (excepto imágenes): **10 peticiones por minuto por IP**.
6. **Validación del cuerpo:** primero el formato legacy (`{ topic }` o `{ notes }`), luego `GenerateMuseumRequestSchema`.
7. **Caché** (antes de tocar el presupuesto).
8. **Tope diario** `MAX_DAILY_GENERATIONS` (default **200**). Cuenta solo fallos de caché. Se reinicia a medianoche UTC. Vive en memoria: se reinicia al reiniciar el proceso.

Por qué: el documento [seguridad.md](./seguridad.md) pide limitar el costo de créditos en una demo pública.

## 3. Caché

| Entrada | Clave |
|---|---|
| Formato legacy `topic` | `topic.trim().toLowerCase()` |
| Formato legacy `notes` | `"notes:" + sha256(notes)` |
| Flujo nuevo | `"flow:" + sha256(JSON.stringify(request))` (incluye modo, fuentes e imágenes) |
| Temario base (`digest-sources`) | `"digest:" + sha256(JSON.stringify(fuentes desinfectadas))`, en un LRU aparte de 100 entradas que guarda solo el texto del temario |

- Los apuntes no se guardan en claro en la clave.
- Máximo **100 entradas**; al llenarse se expulsa la **menos usada recientemente** (LRU): un acierto refresca la entrada, y guardar de nuevo una clave existente no expulsa otra.
- Solo se cachean respuestas válidas.

## 4. Llamadas a Claude (`claude.ts`)

| Función | Cuándo | `max_tokens` | Parser |
|---|---|---|---|
| `generateMuseum({topic})` | Formato legacy con tema | 8 000 | `parseMuseum` |
| `generateMuseum({notes})` | Formato legacy con apuntes | 16 000 | `parseMuseum` + `attachSources` |
| `generateFlowMuseum(req)` | Flujo nuevo (con modo, fuentes, imágenes) | 16 000 | `parseFlowMuseum` (valida además los `imageId`) + `attachSources` |
| `improvePrompt(req)` | Solo depuración | 1 500 | `ImprovePromptResponseSchema` |
| `digestSources(sources)` | `digest-sources` | 6 000 (sin razonamiento: `thinking: { type: "disabled" }`) | `clampDigest` + `DigestSourcesResponseSchema` (sin reintento) |

Detalles:

- Modelo: `ANTHROPIC_MODEL` (default **`claude-sonnet-5-5`**). El temario base usa `ANTHROPIC_DIGEST_MODEL` (default **`claude-haiku-5-5`**, ~20× más barato).
- **Prompt maestro (`DIGEST_SYSTEM_PROMPT`):** solo se llama si el texto extraído en el navegador supera `LIMITS.maxNotesChars`; por debajo, la compactación del navegador cuesta 0 tokens. Pide un temario markdown (`# Tema`, 1 a 8 temas; `- Concepto: idea esencial`, ≤ 12 por tema), fiel a las fuentes, en su idioma y bajo 12 000 caracteres. Cada fuente va en su bloque `<source>` con el mismo helper del flujo (`sourceBlock`). `clampDigest` recorta la salida a `LIMITS.maxDigestChars` en el último salto de línea; salida vacía o inválida → 502. Costo: con 200 000 caracteres (~50k tokens de entrada) y ≤ 6 000 de salida, menos de USD 0.01 por llamada *(est., precios de Haiku de token-budget)*. El razonamiento va apagado: Haiku 5.5 razona por defecto y en una prueba gastó 3 193 de 4 000 tokens de salida pensando, con lo que el temario quedaba cortado o vacío.
- Cliente con `timeout: 120 s` y `maxRetries: 1`.
- **Reintento de validación (`askForJson`):** si el JSON no valida, se devuelve a Claude su respuesta anterior y el error (≤ 500 caracteres) para que la corrija. Son 2 intentos en total.
- **Limpieza antes de validar:** se quita el fence de markdown (```` ```json ````), y `sanitizeRawSources` recorta citas largas.
- **Mock sin clave** (solo con tema): devuelve `sampleMuseum` con el título del tema. Con apuntes no hay mock: 503.
- **`attachSources`:** verifica cada cita contra los apuntes (ver [fuentes-e-imagenes.md](./fuentes-e-imagenes.md)) y guarda `sourceTextHash`. Solo registra conteos: `fuentes: 7/9 piezas verificadas, 2 sin fuente`.
- **Imágenes del flujo:** cada imagen va precedida del texto `Imagen "img-1" (nombre):` para que la IA pueda referenciarla. Si el museo usa un `imageId` que no llegó, es error de validación y se reintenta.

## 5. Prompts (`prompts.ts`) y defensa contra inyección

| Constante / función | Propósito |
|---|---|
| `SYSTEM_PROMPT` | Rol y forma JSON del mus3o; reglas de geometría (`procedural`, `args` por forma) |
| `userPrompt(topic)` | Modo tema |
| `notesPrompt(notes)` | Modo apuntes: palacio de la memoria (salas = temas, piezas = conceptos) |
| `flowPrompt(req)` | Modo flujo: añade `mode`, `graph`, imágenes disponibles y reglas de fuente |
| `MODE_GUIDES` | Forma del grafo y campos obligatorios por modo |
| `IMAGE_SEARCH_RULES` | Pistas `imageSearch` (Wikipedia + Commons) |
| `sourceRules(where)` | Cada pieza cita un fragmento literal de 240 caracteres como máximo |
| `IMPROVE_SYSTEM_PROMPT` | Sugerencias de mejora del pedido |

**Defensa contra prompt injection** (ver [seguridad.md](./seguridad.md) §3):

- El texto del usuario va envuelto en `<user_notes>`, las fuentes en `<source name="…" kind="…">`, y los apuntes en modo tema en `<notes>`.
- `stripDelimiters` quita cualquier `<user_notes>`, `<source>` o `</…>` del contenido, para que el usuario no pueda cerrar el bloque.
- Atributos del nombre de fuente: `<`, `>` y comillas fuera.
- El prompt dice explícitamente que lo que está en esas etiquetas son datos y no instrucciones.
- La salida es JSON validado con Zod, no texto libre: aunque la IA obedezca al usuario, no puede ejecutar nada en el cliente.

## 6. Configuración (variables de entorno)

Ver `.env.example`. Solo el servidor lee estas variables (nunca `VITE_*` para secretos).

| Variable | Default | Efecto |
|---|---|---|
| `ANTHROPIC_API_KEY` | (vacía) | Sin clave: mock para temas, 503 para apuntes |
| `ANTHROPIC_MODEL` | `claude-sonnet-5-5` | Modelo de Claude |
| `ANTHROPIC_DIGEST_MODEL` | `claude-haiku-5-5` | Modelo barato de `/api/digest-sources` |
| `PORT` | `3001` | Puerto HTTP |
| `WEB_ORIGIN` | `http://localhost:5173` | Origen permitido por CORS |
| `MAX_DAILY_GENERATIONS` | `200` | Tope diario de llamadas a Claude |
| `ENABLE_DEBUG_ROUTES` | (no definida) | `true` habilita `/api/improve-prompt`, `/api/assets-review` y `/api/library` |
| `LIBRARY_DIR` | `apps/server/seed/library` | Biblioteca propia de modelos (`index.json` + `.glb`); ver «Biblioteca propia» |
| `LIBRARY_SOURCE_URL` | URL del repo | Enlace que lleva el crédito de los `.glb` propios |
| `ELEVENLABS_API_KEY` | (vacía) | Activa la voz natural; sin ella el cliente usa la voz del navegador |
| `ELEVENLABS_VOICE_ID` / `ELEVENLABS_MODEL` | voz por defecto / `eleven_multilingual_v2` | Voz y modelo (el id se valida alfanumérico) |
| `MAX_DAILY_TTS_CHARS` | `30000` | Tope diario de caracteres enviados a ElevenLabs |

## 7. Proxy de imágenes (`images.ts`)

- **Resolución:** `resolveImage({ wiki, commons, lang })` busca primero el artículo de Wikipedia (`wikiTitle`) y, si no da imagen, en Commons (`commonsQuery`). `lang` default `es`. Clasifica el resultado como `painting`, `diagram` o `photo` según metadatos.
- **Filtro de relevancia** (`relevance.ts`, solo en las búsquedas de reserva, nunca en un acierto exacto de título): un resultado de la búsqueda de Wikipedia debe compartir una palabra con el título pedido o al menos dos con el contexto, y **no puede nombrar un país o gentilicio que ni la consulta ni el contexto mencionan** («Armada en el Caribe» no trae «Armada Argentina»; «Elecciones de 2024» de un palacio EE. UU.-Venezuela no trae las de Uruguay). Se descarta y se prueba el siguiente resultado (hasta 5); si ninguno sirve, 404 y el cuadro queda como lienzo de yeso. La búsqueda automática en Commons (sin `commonsQuery` de la IA) exige además que el nombre del archivo comparta una palabra con el título y no contradiga el país. Determinista, sin llamadas de IA.
- **Contexto de las piezas:** `attachImageSearches` pone como contexto de una pieza `«sala · título del palacio»` (antes solo la sala), para que el tema del palacio desambigüe.
- **Caché de resoluciones:** 500 entradas en memoria, también guarda los `null` ("sin imagen"). Un error transitorio no se guarda. En disco cada resultado lleva `v: RESOLVER_VERSION`: la caché ignora lo escrito por versiones anteriores (podía contener la imagen de otro tema); la semilla del repo no se versiona.
- **`src` de `ResolvedImage`:** siempre la ruta del proxy `/api/image/file?u=<url de Wikimedia codificada>`; la URL que da Commons trae `?utm_source=…` y se conserva dentro de `u` (es la clave de la semilla/caché de dioramas). El cliente (`wikimediaUrlOf`) acepta también una URL https directa de los hosts de Wikimedia.
- **Concurrencia:** máximo **3** llamadas simultáneas a Wikimedia (un museo puede pedir decenas de imágenes a la vez).
- **Peticiones idénticas simultáneas:** `resolveImage` y la descarga de `/image/file` comparten la consulta en curso por clave (`resolving` y `loading`) y la limpian al terminar, así un error transitorio no se cachea.
- **Errores transitorios** (`UpstreamError`: límite de tasa, 5xx, timeout) **no** se cachean como "sin imagen".
- **Caché de archivos:** LRU de **60 entradas o 40 MB**. `clearImageCaches()` la vacía (usada en tests).
- **Seguridad:** `parseAllowedUrl` es el único control del proxy; solo acepta hosts de Wikimedia. Sin esto sería un proxy abierto.

## 8. Tests del servidor

`npm test -w @mus3o/server` (Vitest): 7 archivos, 68 pruebas.

| Archivo | Cubre |
|---|---|
| `flow.test.ts` | Validación del flujo, reglas de modo y grafo, imágenes asignadas, construcción del contenido |
| `images.test.ts` | Clasificación, parser de URLs de Wikimedia, LRU, reintentos |
| `sources.test.ts` | Verificación de citas en el servidor |
| `cache.test.ts` | Caché LRU de museos |
| `digest.test.ts` | Prompt maestro, recorte del temario, ruta `digest-sources` (límites, 503, caché) |

## 9. Cómo añadir un endpoint o cambiar la IA

1. Valida la entrada con un esquema de `@mus3o/shared`. Nunca confíes en `req.body`.
2. Usa `respondWithMuseum`-like: caché → tope diario → generar → error controlado. No expongas el error crudo.
3. Si la IA produce algo nuevo, cambia el prompt en `prompts.ts` **y** el esquema. Y añade la prueba en `flow.test.ts`.
4. Registra solo tipos y conteos en los logs, nunca el contenido.

## Modelos 3D dinámicos (Poly Pizza)

Tras enriquecer el museo, `hydrateMuseumAssets` (`polyPizza.ts`) asigna a cada pieza con `searchKeyword` (máx. 24)
el modelo que mejor **coincide**:

1. **Búsqueda** en paralelo (una por palabra clave distinta, con respaldo a su última palabra: "rusty shield" → "shield").
2. **Relevancia** (`relevance`): título igual (6) > contiene todas las palabras (4) > alguna palabra (2) > etiqueta/categoría (1).
   Sin coincidencia (0) se descarta: mejor el glifo procedural que un objeto equivocado. A igual coincidencia, CC0 antes que CC-BY
   (se excluyen NC/ND/SA).
3. **Reparto**: piezas con la misma palabra reciben modelos distintos si hay alternativas.
4. **Descarga** en paralelo a `assetStore.ts` (solo HTTPS a `*.poly.pizza`, tope 4 MB, firma `glTF`; prueba hasta 3 candidatos)
   y rellena `piece.dynamicAsset` (URL relativa `/api/assets/<id>.glb`).

Timeout de 2500 ms por fase (`AbortController`); ante cualquier fallo la pieza conserva su glifo. Sin `POLY_PIZZA_API_KEY`
la etapa no hace nada. El cliente lo dibuja con `DynamicTotem.tsx` (`Resize` 0,7 + `Center bottom` + `scene.clone`) y muestra
el crédito en la ficha (`Hud.tsx`) si la licencia es CC-BY.

### Revisión de modelos

Cada asignación queda en `.cache/assets/review.json` (`assetReview.ts`) con su palabra clave, puntaje y estado (`pending` por
defecto). **Rechazar** un modelo borra su `.glb` y lo mete en una lista negra persistente: la hidratación no lo vuelve a
asignar. Los museos ya generados y cacheados que lo usan quedan con un 404 en el `.glb` y el cliente cae al glifo procedural.
Flujo: `curl "$HOST/api/assets-review?status=pending"` → revisar en `sourceUrl` → `POST .../reject` o `.../approve`.

## Biblioteca propia de modelos (`library.ts`)

Para que cada museo salga mejor que el anterior: lo que tú creas, y lo que la IA o el respaldo dibujaron y tú aprobaste, se guarda por palabra clave y **se usa antes que cualquier otra fuente**.

**Orden de resolución por pieza** (`resolveModels`): 1) biblioteca propia aprobada → 2) Poly Pizza → 3) Haiku dibuja un respaldo → 4) receta determinista (`fallbackShapes.ts`). Lo resuelto en 1 no se vuelve a buscar en Poly Pizza (`hydrateMuseumAssets(..., skip)`).

**Entradas** (`index.json`, un `<id>.glb` por cada `.glb`): `kind` `recipe` (partes procedurales, como `Part`) o `glb`; `keywords` (normalizadas: minúsculas, sin signos); `origin` `manual | ai | deterministic`; `status` `pending | approved | rejected`; `uses`.
- Coincidencia: palabra clave exacta o, si no, su última palabra («ancient sword» → «sword»). Desempate: exacta > `.glb` > recetas, lo tuyo (`manual`) > lo generado, más usos.
- Los `.glb` se sirven por `/api/assets/lib-….glb` (misma ruta que los de Poly Pizza) y llegan a la pieza como `dynamicAsset` con `license: "own"`; las recetas, como `model` procedural.

**Cómo mejora**
1. Cada generación registra como `pending` lo que dibujaron Haiku o el respaldo determinista (una entrada por palabra clave y origen; máx. 400 pendientes, las más viejas se descartan; lo rechazado no se vuelve a proponer).
2. Tú revisas: aprobar (gana prioridad), corregir las partes o palabras clave (queda `manual` y aprobada) o rechazar.
3. Lo que subes tú (`.glb` o receta) entra ya aprobado.

**Curaduría**
- Terminal, sin servidor: `npm run library -w @mus3o/server -- list [pending|approved|rejected] | show <id> | add-glb <archivo> --keywords a,b [--title T] | add-recipe <json> --keywords a,b | approve|reject|reset|remove <id>`.
- API (solo con `ENABLE_DEBUG_ROUTES=true`, si no 404): `GET /api/library?status=`, `POST /api/library/recipe` (`{keywords, title, parts}`), `POST /api/library/glb?keywords=a,b&title=T` (cuerpo `model/gltf-binary`, ≤ 4 MB, firma `glTF`), `PATCH /api/library/:id`, `POST /api/library/:id/(approve|reject|reset)`, `DELETE /api/library/:id`.
- Los `.glb` van por **Git LFS** (`.gitattributes`); las recetas son JSON pequeño. Lo aprobado en local se versiona con git. En producción el disco es efímero: cura en local y sube el cambio.
- Privacidad: solo viajan palabras clave de objeto generadas por la IA, nunca el texto de los apuntes.

## Costo de generación (flujo `/api/generate-museum`)

Equilibrio: la IA **elige** (conceptos, palabra clave, forma de respaldo) y el servidor **arma** (modelos 3D, imágenes, citas).

- **Salida liviana con Poly Pizza** (`POLY_PIZZA_API_KEY` definida): se usa `SYSTEM_PROMPT_LIGHT`; la IA ya no dibuja 2 a 8 partes procedurales
  por pieza (lo más caro de la salida) sino un glifo de respaldo + `searchKeyword`. `max_tokens` baja de 16 000 a 9 000. Sin clave se
  mantiene el prompt completo con partes procedurales, porque no habría modelo que lo reemplace.
- **Prompt caching**: las reglas fijas (`FLOW_STATIC_RULES`: imágenes) van al final del system prompt con `cache_control`,
  no en el mensaje del usuario; las lecturas de caché cuestan ~10 % de la entrada. El mensaje queda solo con lo variable.
- **Sin parámetro `thinking`**: Sonnet 5.5 no razona antes de responder y rechaza `thinking: {type:"disabled"}` (400); por eso `askForJson` no lo envía. Solo se desactiva en llamadas a Haiku (digest y respaldo).
- **Visibilidad**: cada llamada registra `tokens: entrada/salida/caché leída/caché escrita` (solo conteos). Úsalo para comparar antes y después.

### DSL (tema y apuntes) y modelos 3D

La línea `PIECE: <concepto> | <glifo> | <anclaje> | <searchKeyword>` ahora tiene la palabra clave como campo obligatorio en el prompt
(con ejemplo; `-` si no hay objeto). `parseMus3oDSL` la toma siempre del **último** campo (un `|` dentro del anclaje ya no corre los
campos) y la normaliza con `normalizeSearchKeyword`: minúsculas, sin tildes ni signos, máx. 3 palabras. Si no queda nada usable, la pieza
conserva su glifo. La hidratación de Poly Pizza (`hydrateMuseumAssets`) corre también en esta ruta.

### Buscar primero, crear solo lo que falta

Orden en `resolveModels` (`claude.ts`), para el DSL y el flujo: 1) `hydrateMuseumAssets` busca el asset de cada pieza; 2) `fillMissingModels`
(`modelFallback.ts`) toma **solo** las piezas que quedaron sin `dynamicAsset` (sin coincidencia, error o timeout) y pide a un modelo barato
(`ANTHROPIC_FALLBACK_MODEL`, por defecto Haiku, sin razonamiento, 20 s) llamadas en paralelo por lotes de 6 piezas (máx. 24) con 2 a 5 partes procedurales
por pieza (350 tokens de salida por pieza de tope); una salida cortada se recupera hasta la última pieza completa, las partes se validan con `PartSchema` y las inválidas se descartan. Si un lote falla, o no hay `ANTHROPIC_API_KEY`, entra el **respaldo determinista** (`fallbackShapes.ts`, sin IA ni red): una receta de 2 a 7 partes elegida por la palabra clave del objeto (espada, escudo, llave, libro, corona, torre, lámpara, botella, árbol, barco, cañón, reloj, campana, persona, animal, célula, chip) o, si no hay coincidencia, por la forma del glifo; el color sale del id de la pieza, así que el mismo museo siempre se ve igual. Ninguna pieza sin asset queda con el glifo plano. (Con una sola llamada de 18 piezas la salida llegó al tope, el JSON quedó truncado y todas las piezas se quedaron con el glifo plano.) Solo corre con
`POLY_PIZZA_API_KEY` y `ANTHROPIC_API_KEY` definidas: sin búsqueda activa todas las piezas "faltarían" y se pagaría de más.

### Formato DSL actual y tolerancia del parser

`PIECE: <concepto> | <glifo> | <anclaje> | <searchKeyword> | <explicación>` (5 campos; la explicación es 1 frase ≤ 160 car. y pasa a `piece.text`;
sin ella `text` repite el concepto). Palabra clave y explicación se leen **desde el final**; con 4 campos (formato anterior) el último es la
palabra clave. `parseMus3oDSL` tolera viñetas, numeración, negritas, `room:`/`piece:` en minúsculas y `｜` de ancho completo; desambigua ids de
sala repetidos (`a`, `a-2`); recorta a `LIMITS.maxRooms` / `maxPiecesPerRoom` sin lanzar (las piezas de una sala omitida se descartan).
`max_tokens` sube a 2000 (tema) y 3500 (apuntes) por la explicación (~35 tokens por pieza).

## Flujo completo por DSL (por defecto) y consumo de API

`generateFlowMuseum` usa el DSL salvo `FLOW_FORMAT=json` (formato anterior, hasta 16 000 tokens de salida). El modelo solo **elige y ordena**;
el servidor arma el resto:

| Qué | Quién |
|---|---|
| Salas, piezas, anclaje, `searchKeyword`, explicación; `PERIOD` (biography), `QUIZ` (quiz), `IMAGE` (opcional) | IA, una salida DSL de ~2-4 mil tokens (`max_tokens` 5000) |
| Grafo según el modo (exploration/quiz: árbol `related`; education/biography: cadena `next`) | `parseMus3oDSL` (`buildGraph`) |
| Imágenes de cada cuadro (`imageSearch`), citas (`retrieveSources`), título/forma | Servidor, determinista (`enrichMuseum`) |
| Modelos 3D | Poly Pizza; solo las piezas sin asset reciben un respaldo de Haiku |
| Dioramas | La IA **no** hace llamada aparte (se quitó `addDioramas`). Solo en salas históricas/geográficas/naturales pide, en la **misma llamada**, líneas `DIO` y `D_PROP` bajo su sala (sin coordenadas); el cliente las compone con `compose.ts` antes que la biblioteca. El resto de mundos sale de la biblioteca hecha a mano o de `POST /api/diorama-from-image`. Ver [diorama.md](./diorama.md) §4 |

Ahorros: prompt del sistema cacheado (`cache_control`), sin `thinking`, sin llamada de dioramas ni de respaldo cuando no hacen falta, y pedidos idénticos
simultáneos comparten una sola generación y un solo cupo diario (`inFlight` en `app.ts`). Si la salida DSL es inválida (falta `PERIOD` en biography o `QUIZ`
en quiz) se reintenta una vez con el error, como antes. Cada llamada registra sus tokens en el log.

### Medición real (Sonnet 5.5, 2026-10-24, modo education, "La Revolución Francesa")

| Formato | Tokens de salida | Tiempo | Resultado |
|---|---|---|---|
| `FLOW_FORMAT=json` (anterior) | 10 925 (entrada 811, +3 062 escritos en caché) | 70 s | 3 salas, 11 piezas, 1 diorama |
| DSL (por defecto) | 1 847 + 1 518 del diorama = **3 365** (entrada 191 + 155) | 27 s | 5 salas, 18 piezas, 1 diorama |

≈ 3,2× menos salida y 2,6× menos tiempo, con más contenido. Un solo pedido por formato: es una muestra, no un promedio.
Nota histórica: las mediciones de arriba incluían una llamada de dioramas; ya no existe (los mundos concepto→props se descartaron a favor de la foto real).

### Más ahorros y mediciones (2026-10-24)

- **Caché de museos en disco** (`MUSEUM_CACHE_DIR`, por defecto `.cache/museums`): tras un reinicio no se vuelven a pagar los museos ya generados; al leer se revalida con `MuseumSchema` y un archivo dañado se ignora. La LRU en memoria sigue limitando a 100 entradas.
- **Clave de caché del flujo** ignora mayúsculas y espacios del pedido (`"Roma  "` = `"roma"`).
- **Modos probados con IA real** (Sonnet 5.5, sin Poly Pizza): biography → 5 salas / 25 piezas / 5 períodos, 3 453 + 1 665 tokens de salida; quiz → 4 salas / 20 piezas / 20 quiz, 4 360 + 1 932. Ninguno necesitó reintento. La segunda generación leyó la caché del prompt (1 393 tokens de entrada leídos en vez de escritos).
- **Dioramas con Haiku: descartado.** Con razonamiento (por defecto) gastó 3 359 tokens de salida (el doble que Sonnet, 1 632); sin razonamiento devolvió dioramas sin props válidos (0 props tras validar). Se queda Sonnet para los dioramas.

### Validación con la API real de Poly Pizza (2026-10-24)

- **Búsqueda: funciona.** `x-auth-token` válido, respuesta en 0,15-0,5 s y campos confirmados (ver `estado-y-pendientes.md`).
- **Descarga del `.glb`: bloqueada.** `static.poly.pizza` responde 403 con una página de desafío anti-bots de Cloudflare ("Just a moment...") a las peticiones del servidor. Resultado en una generación real: 0 de 18 piezas con asset; todas usaron el respaldo creado / glifo.
- **Cortacircuito** (`DownloadBlockedError`, `polyBlocked`): ante 403/429/503 o una respuesta HTML se dejan de buscar y descargar durante 10 min, para no sumar ~2,5 s de espera por generación mientras dure el bloqueo.
- **Pendiente (decisión de producto):** no se intentó saltar el desafío (falsear navegador/Referer). Opciones legítimas: pedir a Poly Pizza que habilite descargas desde servidor para la clave, o que el **navegador** descargue el `.glb` directamente desde `static.poly.pizza` (el cliente ya recibe la URL) en vez de pasar por el proxy del servidor.

### Salas según el contenido y grafo no lineal (2026-10-24)

`roomPlan` (`prompts.ts`) elige el rango de salas por el volumen de texto (prompt + fuentes): ≤150 car. → 4-5 salas; ≤800 → 3-5; ≤4 000 → 4-6; ≤12 000 → 6-8;
más → 9-12 (máx. `LIMITS.maxRooms` = 12). El prompt lo indica junto con las piezas por sala (3-5 hasta 4-7) y `max_tokens` crece con el plan (`flowMaxTokens`, tope 16 000).
Estructura: `ROOM` lleva `<requires>` (prerrequisitos, solo salas **anteriores**, por eso no hay ciclos) y un 9.º campo `<related>` (conexiones transversales).
`buildGraph` (shared/`dsl.ts`) deriva por modo: education → DAG de prerrequisitos (ramas y convergencias); exploration/quiz → árbol + cruces; biography → cadena + cruces.
En el cliente, `planRoomGrid` también abre puerta entre las salas vecinas unidas por una arista fuera del árbol (bucles y atajos), de modo que el recorrido no es una cadena de puertas.

Medición real (Sonnet 5.5): "Fotosíntesis" → 5 salas, 22 piezas, 5 prerrequisitos + 7 cruces, 1 convergencia; 24 558 caracteres de apuntes → **12 salas**, 48 piezas, 13 prerrequisitos + 11 cruces, 2 convergencias, 5 046 tokens de salida (entrada 7 993), sin reintentos.

## Ayuda de Aris (`POST /api/aris-help`)

`apps/server/src/arisHelp.ts`. Solo se llama cuando las reglas de Aris no entienden la pregunta.

- **Entrada** (estricta): `query` (1-200), `palaceTitle?`, `roomName?`, `topics[]` (hasta 12, 80 caracteres c/u). Todo se desinfecta y va entre `<pregunta>`/`<contexto>` como datos, no instrucciones.
- **Modelo:** Haiku (`ANTHROPIC_ARIS_MODEL`, luego `ANTHROPIC_FALLBACK_MODEL`, por defecto `claude-haiku-5-5`), sin razonamiento, `max_tokens` 80, timeout 8 s, sin reintentos. Respuesta de 1-2 frases, recortada a 280 caracteres.
- **Límites:** 8 solicitudes/min por IP (límite propio, fuera del general), caché en memoria de 200 respuestas (palacio + sala + pregunta; un acierto no gasta cupo) y tope diario `MAX_DAILY_ARIS_HELP` (150 por defecto).
- **Salida:** `{ answer }`. Errores: 400 entrada inválida, 429 tope diario, 502 fallo del modelo, 503 sin `ANTHROPIC_API_KEY`. El cliente trata cualquier error como "usa el respaldo".

## Dioramas desde la foto (`POST /api/diorama-from-image`)

`apps/server/src/photoDiorama.ts`. El mundo de un cuadro vivo ya no se arma con los conceptos de la sala: se **recrea la foto o el cuadro real** del tema.

- **Entrada** (estricta, `PhotoDioramaRequestSchema`): `imageUrl` (≤ 2048), `title`, `roomTitle` (≤ 120), `concepts[]` (≤ 12 de ≤ 80; opcional, solo contexto, nunca se dibujan por sí solos; el cliente web **no los envía**: los apuntes del usuario no salen del navegador, solo el título de la sala y el de la imagen pública).
- **Seguridad (SSRF):** `imageUrl` pasa por `parseAllowedUrl` de `images.ts` (https y solo `upload.wikimedia.org` / `thumb.wikimedia.org`); cualquier otra cosa es 400 sin tocar la red ni la IA. La imagen se descarga con el cliente cortés de `images.ts` (`loadImageFile`: tope 8 MB, timeout, semilla y caché) y se envía a Claude solo si es JPEG/PNG/WebP/GIF de ≤ 3,7 MB (las miniaturas de Wikimedia son de 960 px; no hay reducción adicional ni dependencias nuevas). Un SVG se clasifica como diagrama sin gastar llamada.
- **Modelo:** `ANTHROPIC_DIORAMA_MODEL` → `ANTHROPIC_MODEL` → `claude-sonnet-5-5`, visión, herramienta `recreate_scene` con `tool_choice: auto` (Sonnet 5.5 rechaza el `tool_choice` forzado: «type tool and any are not supported for this model») y `thinking: { type: "between_tools" }` (sin razonamiento previo; en este modelo `disabled` no se admite). `max_tokens` 3000, timeout 60 s, 1 reintento. Esquema de la herramienta: `imageKind` (battle, landscape, place, event, interior, microscopic = recreables; portrait, diagram, map, text, logo, chart, object, other = no), `recreatable`, `reason`, `title`, `terrain`, `time`, `palette` muestreada de la imagen y `props[]` (kinds de la biblioteca sin `custom`; `pos [x,z]` que refleja la composición: x izquierda a derecha, z fondo a primer plano; `label` en español por prop).
- **Saneado** (`buildPhotoDiorama`, puro y probado): `recreatable` solo vale con un `imageKind` recreable; kinds fuera de la biblioteca, `custom`, `pieceId`, `parts` y `flow` se descartan; `parseDiorama` recorta cuentas, posiciones y escala; tope de 160 instancias en total; sin rótulo se usa uno por tipo; los rótulos pasan por `sanitizeUntrustedText` y sin `<>`; con menos de 3 props queda «no recreable». `diorama.backdrop` es la ruta del proxy de imágenes de esa misma imagen (`BACKDROP_RE` en shared).
- **Caché y semillas:** clave `v1|<url canónica>` (la versión del prompt invalida lo anterior). Orden: semilla del repo `apps/server/seed/dioramas/` (`DIORAMA_SEED_DIR`, sirve sin clave de API) → memoria (300) → disco en la carpeta de imágenes (`IMAGE_CACHE_DIR`, mismo tope). También se guarda «no recreable»; los fallos de la IA nunca. Peticiones iguales simultáneas comparten una sola llamada. Las semillas de la demo `historia` (Boyacá, Angostura, Maracaibo) se generaron con la API real; la demo `medicina` no pide nada porque sus tres salas usan dioramas de la biblioteca.
- **Límites:** 20/min por IP (`PHOTO_DIORAMA_RATE_LIMIT`, fuera del límite general de 10/min), 2 llamadas de IA a la vez por proceso (hasta 8 esperando; si no, 503), tope diario `MAX_DAILY_PHOTO_DIORAMAS` (150, solo fallos de caché). Sin `ANTHROPIC_API_KEY` y sin caché ni semilla: 503.
- **Costo medido** (Sonnet 5.5, imagen de 960 px): ≈ 1 000 tokens de entrada, ≈ 1 000 de salida y 12-16 s por escena nueva; con caché o semilla, 0.
