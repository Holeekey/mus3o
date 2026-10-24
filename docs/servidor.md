# Servidor (`apps/server`) 🍌

Express + `@anthropic-ai/sdk`. Puerto por defecto **3001**. Su única tarea con IA es convertir
apuntes o un tema en un `Museum` válido. Todo lo demás (validación, citas, imágenes) es determinista.

Archivos:

| Archivo | Responsabilidad |
|---|---|
| `src/index.ts` | Arranque: `dotenv`, escucha en `PORT` |
| `src/app.ts` | Rutas, CORS, límites de cuerpo, rate limits, tope diario, caché, errores |
| `src/claude.ts` | Cliente de Anthropic, `askForJson` (reintento), mock sin clave, `attachSources` |
| `src/prompts.ts` | Todos los prompts y reglas (sistema, apuntes, flujo, diorama, imágenes, mejora) |
| `src/cache.ts` | Caché en memoria, máx. 100 museos |
| `src/images.ts` | Proxy de Wikipedia/Commons: resolución, descarga, LRU de archivos |

---

## 1. Endpoints

| Método y ruta | Entrada | Salida | Notas |
|---|---|---|---|
| `POST /api/generate-museum` | `{ topic }` (legacy) **o** `{ mode, prompt, sources[], images[] }` | `Museum` | Único endpoint de generación. Cuerpo ≤ 8 MB |
| `POST /api/improve-prompt` | Mismo que el flujo sin imágenes | `{ suggestions[], improvedPrompt }` | **Solo depuración**: 404 salvo `ENABLE_DEBUG_ROUTES=true` |
| `GET /api/image?wiki=&commons=&lang=` | Pistas de imagen | `ResolvedImage` (`Cache-Control: 1 h`) | 404 `Sin imagen`; 502 `Wikimedia no disponible` |
| `GET /api/image/file?u=` | URL de Wikimedia | Bytes de la imagen | Proxy: **solo hosts de Wikimedia**; si no, 400 `URL no permitida` |

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
2. **Tamaño de cuerpo:** `generate-museum` 8 MB (hay imágenes en base64); el resto 100 KB.
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

Detalles:

- Modelo: `ANTHROPIC_MODEL` (default **`claude-sonnet-5-5`**).
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
| `DIORAMA_RULES` | Dioramas: solo en 1–2 salas representables, `props` de la biblioteca |
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
| `PORT` | `3001` | Puerto HTTP |
| `WEB_ORIGIN` | `http://localhost:5173` | Origen permitido por CORS |
| `MAX_DAILY_GENERATIONS` | `200` | Tope diario de llamadas a Claude |
| `ENABLE_DEBUG_ROUTES` | (no definida) | `true` habilita `/api/improve-prompt` |

## 7. Proxy de imágenes (`images.ts`)

- **Resolución:** `resolveImage({ wiki, commons, lang })` busca primero el artículo de Wikipedia (`wikiTitle`) y, si no da imagen, en Commons (`commonsQuery`). `lang` default `es`. Clasifica el resultado como `painting`, `diagram` o `photo` según metadatos.
- **Caché de resoluciones:** 500 entradas, también guarda los `null` ("sin imagen"). Un error transitorio no se guarda.
- **Concurrencia:** máximo **3** llamadas simultáneas a Wikimedia (un museo puede pedir decenas de imágenes a la vez).
- **Peticiones idénticas simultáneas:** `resolveImage` y la descarga de `/image/file` comparten la consulta en curso por clave (`resolving` y `loading`) y la limpian al terminar, así un error transitorio no se cachea.
- **Errores transitorios** (`UpstreamError`: límite de tasa, 5xx, timeout) **no** se cachean como "sin imagen".
- **Caché de archivos:** LRU de **60 entradas o 40 MB**. `clearImageCaches()` la vacía (usada en tests).
- **Seguridad:** `parseAllowedUrl` es el único control del proxy; solo acepta hosts de Wikimedia. Sin esto sería un proxy abierto.

## 8. Tests del servidor

`npm test -w @mus3o/server` (Vitest): 4 archivos, 44 pruebas.

| Archivo | Cubre |
|---|---|
| `flow.test.ts` | Validación del flujo, reglas de modo y grafo, imágenes asignadas, construcción del contenido |
| `images.test.ts` | Clasificación, parser de URLs de Wikimedia, LRU, reintentos |
| `sources.test.ts` | Verificación de citas en el servidor |
| `cache.test.ts` | Caché LRU de museos |

## 9. Cómo añadir un endpoint o cambiar la IA

1. Valida la entrada con un esquema de `@mus3o/shared`. Nunca confíes en `req.body`.
2. Usa `respondWithMuseum`-like: caché → tope diario → generar → error controlado. No expongas el error crudo.
3. Si la IA produce algo nuevo, cambia el prompt en `prompts.ts` **y** el esquema. Y añade la prueba en `flow.test.ts`.
4. Registra solo tipos y conteos en los logs, nunca el contenido.
