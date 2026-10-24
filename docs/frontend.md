# Frontend (`apps/web`)

Vite + React + React Three Fiber (three.js). Estado global con Zustand. Solo escritorio.

> **Ojo con el nombre "modo":** en el frontend hay dos conceptos distintos.
> - `store.mode`: `'explore' | 'exam'`, el modo de juego dentro del palacio.
> - `Museum.mode`: `exploration | quiz | biography | education`, la forma del museo que pide la IA (ver [contrato-shared.md](./contrato-shared.md)).

## 1. Pantallas y arranque

`src/main.tsx` monta `App.tsx`. `App` muestra:

- `screen === 'landing'` → `ui/Landing.tsx`
- `screen === 'palace'` y hay `layout` → `scene/World.tsx` (lazy, para no inflar la landing) + `ui/Hud.tsx` + `diorama/DioramaOverlay.tsx`

### Parámetros de URL (demos y capturas)

| URL | Qué abre |
|---|---|
| `?demo` | Palacio de ejemplo de biología celular (`palace/example.ts`) |
| `?demo=ia` | `mocks/index.ts` (`demoMuseum`), museo con modelos de IA |
| `?demo=historia` | `mocks/historia.ts`, con cuadros reales de Wikimedia |
| `?demo=dungeon` | `mocks/dungeon.ts`, mazmorra del sandbox adaptada a museo |
| `?cam=x,z,yaw`, `?salto=0@3000` | Solo demo: posición de cámara y salto del reloj (`memory/demo.ts`) |

## 2. Landing (`ui/Landing.tsx`)

- **Estructura** (de arriba abajo): header crema que se desvanece al bajar (`ui/SiteHeader.tsx`); hero centrado; sección `#como-funciona` con scroll (`ui/showcase.ts`): la sala de inicio del palacio de ejemplo se abre a pantalla completa mientras la cámara baja de vista aérea a primera persona, y se vuelve a cerrar (`scene/RoomPeek.tsx`, sala fija: no depende del editor); sección `#crear`, que sube como lámina sobre la sala, con el editor a la izquierda y los palacios destacados en lista a la derecha (aparición al entrar en pantalla: `ui/reveal.ts`).
- **Equipo:** `#equipo` muestra una página aparte (`ui/TeamSection.tsx`, elegida en `App.tsx` con `ui/useHash.ts`): galería vertical donde la tarjeta en el centro de la pantalla va a color y el resto en blanco y negro. Fotos en `public/team/<nombre>.jpg`.
- Editor "Tus apuntes" (texto libre); el palacio se valida con el parser local (salas y conceptos en la barra de estado).
- **"+ Fuentes"** abre y cierra una columna **dentro del recuadro del editor**, a la derecha del texto (debajo en pantallas ≤ 640 px) (`ui/SourcesPanel.tsx`); también se cierra con ✕ o Escape: botón "+ Adjuntar archivos", zona para arrastrar, lista con su resumen (`sourcesSummary`: fuentes, caracteres, imágenes y aviso si se resumirán con IA). Con adjuntos, el editor muestra "¿Qué quieres aprender de estos archivos? (opcional)": lo escrito es el pedido. Varios archivos a la vez, cada uno ≤ 15 MB; todo se lee en el navegador, sin IA (`lib/files.ts`):

| Tipo | Cómo se lee |
|---|---|
| `.docx` | `mammoth.extractRawText` |
| `.xlsx` | `read-excel-file/universal`; cada fila queda como `encabezado: valor; ...` |
| `.csv` | Separador `,` o `;` detectado, con comillas; mismo formato que `.xlsx` |
| `.json` | Aplanado a líneas `ruta: valor` |
| `.txt`, `.md` | Texto tal cual |
| `.png`, `.jpg`, `.jpeg`, `.webp` | Se achica a ≤ 1024 px y se pasa a JPEG (`readImageAttachment`); máx. `LIMITS.maxImages` (6) |
| `.doc`, `.xls` | Rechazados con "Guárdalo como .docx / .xlsx" |

  Todo el texto pasa por `compactText` (espacios normalizados, sin líneas vacías ni repetidas). Límites: hasta 10 archivos de texto, 100 000 caracteres por archivo y `LIMITS.maxDigestInputChars` (200 000) en total.
- **Botones:**

| Botón | Qué hace |
|---|---|
| Construir palacio | Usa el parser local (`parsePalace`), sin IA |
| Generar con IA | Sin adjuntos: `lib/api.ts#generateMuseum` envía `{topic}` si es una línea corta, o `{notes}` si no. Con adjuntos: `generateMuseumFromFiles` envía `{ mode: "exploration", prompt, sources, images }`; si el texto supera `LIMITS.maxNotesChars` o hay más de 5 fuentes (`needsDigest`), antes pide el temario base a `/api/digest-sources` ("Resumiendo tus archivos…"). El texto de ejemplo del editor no se envía con los adjuntos; un texto escrito de más de 2 000 caracteres viaja como fuente "Tus apuntes" |
| Entrar al palacio | Aparece tras generar con IA |
| Usar ejemplo: Biología celular | Carga `EXAMPLE_TEXT` en el editor |
| Explorar Mazmorra | Abre la demo de mazmorra |
| Continuar "…" | Aparece si hay un palacio guardado; muestra los repasos pendientes |

- Mensajes de error y "demasiadas solicitudes" (429) ya están manejados.
- **Lo que la interfaz envía:** `sources[]` e `images[]` cuando hay adjuntos, siempre con `mode: "exploration"`. **Todavía no** hay selector de modo ni llama a `/api/improve-prompt` (ver [estado-y-pendientes.md](./estado-y-pendientes.md)).

### Parser local de apuntes (`palace/parse.ts`)

Sin IA, detecta el formato con `detectFormat` y produce un `Museum` válido con `MuseumSchema`:

| Formato | Ejemplo aceptado |
|---|---|
| `text` (Markdown ligero) | `# Tema` seguido de `- Concepto: detalle` |
| `json` | Contrato completo `{ rooms: [...] }`, o formas sueltas: `[{ sala, items }]`, `{ "Tema": ["a","b"] }`, `{ "Tema": { "c": "detalle" } }` |
| `csv` | Columnas: sala, concepto, detalle (opcional), metáfora (opcional) |

- Límite de entrada: 50 000 caracteres (`MAX_INPUT_CHARS`).
- Sin IA, la imagen de cada cuadro sale del título del tema o concepto como título de Wikipedia. Si no hay artículo, no hay cuadro.
- La "fuente" de cada concepto (línea original recortada) se guarda solo si el JSON ya la trae. Nunca se inventa.

## 3. Estado global (`store.ts`)

Zustand con `persist` bajo la clave **`mus3o-v1`** en `localStorage`.

| Campo | Qué guarda | ¿Persiste? |
|---|---|---|
| `screen` | `landing` o `palace` | No |
| `palace` | El `Museum` activo | Sí |
| `sourceText` | Apuntes originales (≤ 50 000) para mostrar la fuente de cada concepto | Sí |
| `layout` | `PalaceLayout` calculado con `buildLayout` | No (se recalcula) |
| `memorized` | Conceptos marcados con M | Sí |
| `exam` | Resultado del examen por concepto (`ok` / `fail`) | No |
| `reviewIds` | Si no es `null`, el examen solo cubre esos conceptos | No |
| `roomKeys` | Llaves ganadas por sala | Sí |
| `unlockedDoors` | Puertas abiertas con llave | Sí |
| `freeExplore` | Preferencia: todas las puertas abiertas | Sí |
| `hasKey` | Llave de hierro (solo mazmorra) | No |
| `currentRoomId`, `focusedId`, `focusedDoorId`, `openId`, `locked` | Estado de la sesión 3D | No |
| `arisMessage`, `arisPromptOpen` | Diálogo de Aris | No |

Reglas importantes:

- **`merge` valida lo guardado:** si el `palace` no pasa `MuseumSchema`, se descarta. Así una versión vieja o un dato manipulado no rompe la app.
- **`capSourceText`:** los apuntes guardados se recortan a 50 000 caracteres.
- **Acciones clave:** `enterPalace(palace, sourceText)`, `resume`, `exitToLanding`, `setMode`, `startReview`, `toggleMemorized`, `pickupKey`, `unlockDoor`, `setFreeExplore`, `recordExam`, `askAris`.
- **Aviso de llave:** `lastKeyRoomId` guarda la última sala ganada para mostrarla en el HUD.

La memoria por concepto vive **aparte**, en `memory/store.ts` (clave `mus3o-memory-v1`), para no mezclarla con el contenido. Ver [memoria-y-examen.md](./memoria-y-examen.md).

## 4. Palacio: layout (`palace/layout.ts`)

`buildLayout(palace)` convierte el `Museum` en geometría determinista (función pura, testeable):

- Todo en metros, plano XZ; `Y` es la altura.
- **Rejilla de salas** (`planRoomGrid`): cada sala ocupa una celda; las conexiones salen del grafo (`graph`) o del orden de `rooms`. Hasta 12 salas y grafos no lineales (ramas, convergencias): además del árbol de recorrido, toda arista entre salas vecinas en la grilla tiene puerta (bucles y atajos).
- Tamaño de sala según el número de piezas (`sizes`). Muros con hueco de puerta; cada pared con puerta se divide en dos tramos.
- **Puertas** (`DoorLayout`): `fromRoomId` determina qué llave abre cada puerta.
- **Corredores** (`CorridorLayout`): piso y muros entre salas.
- **Pedestales** (`PedestalLayout`): una pieza por pedestal, con forma `Glyph` (o modelo, en la escena).
- **Cuadros** (`PaintingSlot`): huecos en muros interiores, fuera de las puertas. `SLOT_Y = 2.3`, `SLOT_GAP = 0.4`, `SLOT_DOOR_MARGIN = 0.6`, máx. 16 por sala.
- **Colores de sala:** `ROOM_COLORS` (12 colores de neón, cíclicos) en orden de sala.
- **Colisiones:** `moveWithCollisions` mueve por ejes separados para deslizarse contra muros.
- `assignPaintings(room)` decide qué imagen o diorama va en cada hueco.

Tests: `palace.test.ts`, `slots.test.ts`, `keys.test.ts`, `sources.test.ts`, `sourceText.test.ts`, `pieceKind.test.ts`.

## 5. Escena 3D (`scene/`)

| Archivo | Qué dibuja o hace |
|---|---|
| `World.tsx` | Canvas R3F, sol, niebla, postprocesado, todas las salas y corredores |
| `Room.tsx` | Muros, molduras, suelo, monumento central, inscripción, pedestales con su pieza |
| `Player.tsx` | Controles FPS: **WASD** (o flechas), **Shift** correr, **mouse** mirar (pointer lock), colisiones, foco del concepto |
| `ProceduralModel.tsx` | Dibuja modelos `procedural` con primitivas (cotas de tamaño) |
| `Shapes.tsx` | Dibuja `glyph` (formas geométricas simples) |
| `DynamicTotem.tsx` | Modelo `.glb` externo (`piece.dynamicAsset`, Poly Pizza): `useGLTF` + `scene.clone`, `Resize` 0,7 m + `Center bottom`, `ErrorBoundary` y `Suspense` con respaldo (el glifo o modelo procedural de siempre) |
| `DungeonAssets.tsx` | Carga modelos de `catalog.json` (`type: "catalog"`) |
| `Painting.tsx` | Cuadro con imagen real (`useResolvedImage`) |
| `PortalPainting.tsx` | Cuadro-portal: vista en miniatura del diorama, `E` entra |
| `LabelPlate.tsx` | Cartela con el título del concepto |
| `Decay.tsx` | Desmoronamiento de la pieza según la fuerza de memoria (fragmentos de yeso) |
| `ArisCompanion.tsx` | Aris acompaña al jugador en la escena |
| `RoomPeek.tsx` | Sala de ejemplo de la landing con la cámara que sigue el scroll |
| `Preview.tsx` | Maqueta isométrica del palacio (ya no se usa en la landing) |
| `pointerLock.ts` | Utilidad para bloquear el puntero |

### Controles

| Tecla | Acción | Fuente |
|---|---|---|
| `W A S D` / flechas | Moverse | `Player.tsx` |
| `Shift` | Correr | `Hud.tsx` (ayuda) |
| Mouse | Mirar (pointer lock) | `Player.tsx` |
| `E` | Examinar concepto o abrir la ficha; usar llave en una puerta; entrar al diorama | `Player.tsx`, `dioramaStore.ts` |
| `M` | Marcar o desmarcar memorizado (en modo explorar) | `Player.tsx` |
| `T` | Hablar con Aris (abre el prompt) | `Player.tsx` |
| `Q` | Salir del diorama | `dioramaStore.ts` |
| `Esc` | Pausa | Ayuda del HUD |

En el examen, responder exige escribir, así que se libera el puntero.

## 6. HUD (`ui/Hud.tsx`) y otros componentes de `ui/`

| Componente | Función |
|---|---|
| `Hud` | Panel de concepto (`ConceptCard`, con el crédito del modelo 3D si es CC-BY), tarjeta de examen (`ExamCard`), contadores, llaves, repaso, ayudas de teclado |
| `Minimap` | Mapa del palacio (salas, puertas, posición del jugador vía `playerPose`) |
| `ArisDialog` | Prompt y respuesta de Aris |
| `FreeExploreToggle` | Interruptor de exploración libre (puertas abiertas) |
| `SourceBlock` | Muestra la cita de los apuntes de donde sale un concepto (`sourceView`) |
| `Landing` | Pantalla de inicio (ver sección 2) |

## 7. Aris (`palace/arisBrain.ts`)

Asistente de estudio **sin IA**, por reglas:

- `evaluateArisQuery(query, ctx)` responde según el contexto: sala actual, conceptos sin memorizar, llaves, puertas abiertas, modo.
- Tolerancia a errores tipográficos con distancia de Levenshtein.
- Saludos, presentación, orientación hacia la siguiente sala, conteo de conceptos pendientes, pistas.
- `speakAris(text)` usa la síntesis de voz del navegador (sin librerías).
- **Ayuda de Haiku:** cuando ninguna regla coincide, `evaluateArisQuery` devuelve `needsHelp: true` y `askAris` (store) muestra "Déjame pensarlo…" y llama a `POST /api/aris-help` (`lib/api.ts` → `askArisHelp`) con la pregunta, el título del palacio, la sala actual y hasta 12 títulos de conceptos (nunca los apuntes). Si falla o no hay IA, se muestra el respaldo guiado de siempre. Si el jugador cierra el globo o pregunta otra cosa mientras tanto, la respuesta tardía se descarta.

## 8. Otras piezas

- **`palace/keys.ts`:** llaves. Ver [memoria-y-examen.md](./memoria-y-examen.md).
- **`palace/conceptIds.ts`:** `conceptIdList` y `conceptIdSet`, ids de todos los conceptos cacheados por palacio (por referencia). Los usan el HUD, los hooks de memoria y el runtime del diorama para no reconstruir la lista en cada render o frame.
- **`memory/dueLabel.ts`:** texto del chip "N repasos pendientes" de la landing (función pura).
- **`palace/match.ts`:** `isCorrectAnswer` tolera tildes, mayúsculas y errores menores de tipeo.
- **`palace/pieceKind.ts`:** tipo de pieza de la mazmorra (`key`, `chest`, `trap`, `door`, `standard`). Lo decide el id del modelo de catálogo, no el título, para que el texto del usuario no afecte la lógica.
- **`lib/images.ts`:** resolución de imágenes con caché, deduplicación de peticiones simultáneas, reintentos con espera ante límite de Wikimedia, precarga (`prefetchPalaceImages`), línea de crédito de la licencia (`creditLine`). Ver [fuentes-e-imagenes.md](./fuentes-e-imagenes.md).
- **`lib/api.ts`:** cliente de `/api/generate-museum`. Valida la respuesta con `MuseumSchema`.
- **`theme/`:** `DEFAULT_THEME` (colores de fondo y del entorno).
- **`mocks/`:** museos de ejemplo para demos y pruebas visuales. `caraboboDiorama.ts` es un diorama de ejemplo.

## 9. Tests del frontend

`npm test -w @mus3o/web` (Vitest): **15 archivos, 150 pruebas**. Se centran en lógica pura (layout, llaves, memoria, parser, citas, imágenes, diorama). No hay pruebas de render 3D; esas se validan a mano con `?demo=…` y la skill `3d-validation`.
