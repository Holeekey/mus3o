# Estado del proyecto: qué está hecho y qué falta

> Estado verificado sobre `dev` en el commit `8ab047e` (fecha de esta revisión: 2026-10-24).
> Si este documento y el código no coinciden, manda el código y corrige este archivo.

## 1. Resumen en una pantalla

| Área | Estado | Notas |
|---|---|---|
| Contrato de datos (`packages/shared`) | ✅ Completo | Esquemas Zod, límites, reglas de modo y grafo, diorama, fuentes, temas y monumentos |
| Generación con IA (tema y apuntes) | ✅ Funciona | Pipeline Low-Token DSL (<400 tokens), anclajes mnemotécnicos, validación Zod, caché, tope diario |
| Generación con el flujo nuevo (modo, fuentes, imágenes) | 🟡 Solo servidor | El servidor y el contrato lo soportan; **la interfaz no lo envía** |
| Verificación de citas contra los apuntes | ✅ Funciona | Coincidencia exacta o ≥ 60 %; avisos "sin fuente" |
| Imágenes reales en cuadros (Wikipedia / Commons) | ✅ Funciona | Proxy con lista blanca de hosts, reintentos, precarga |
| Imágenes subidas por el usuario | 🔴 No conectado | Contrato y servidor listos; falta el frontend |
| Parser local de apuntes (sin IA) | ✅ Funciona | Texto, JSON, CSV y entrada directa a palacios pre-compilados |
| Palacios pre-compilados (Offline) | ✅ Completo | 3 palacios ricos listos para entrar con 1 clic (Von Neumann, Biología Celular, Imperio Romano) |
| Subida de archivos | ✅ Hecho | "+ Adjuntar": `docx`, `xlsx`, `csv`, `txt`, `md`, `json` e imágenes, leídos en el navegador (`lib/files.ts`). Prompt maestro híbrido: solo si el texto supera 20 000 caracteres se resume con Haiku (`/api/digest-sources`). Las imágenes del usuario se cuelgan en los cuadros. Pendiente: `.doc`/`.xls` viejos y PDF no se leen; las imágenes del usuario no sobreviven a una recarga |
| Palacio 3D (salas, puertas, pedestales, cuadros) | ✅ Funciona | Layout determinista, colisiones, minimapa, AtmosphereController (lerp de niebla) y monumentos procedurales |
| Modelos 3D dinámicos (Poly Pizza) | 🟡 Implementado, sin probar con clave real | `hydrateMuseumAssets` + `/api/assets` + `DynamicTotem`; requiere `POLY_PIZZA_API_KEY`. Sin clave o ante fallo, glifo procedural. Pendiente: validar el formato real de la API (campos `Licence`, `Download`) con una clave |
| Piezas: procedural, catálogo y glifo | ✅ Funciona | Modelos de catálogo, glifos procedurales y badges mnemotécnicos (Método de Loci) |
| Memoria espaciada (curva de olvido) | ✅ Funciona | Niveles, repaso, máquina del tiempo |
| Llaves, puertas y exploración libre | ✅ Funciona | Llave por sala, llave de hierro en la mazmorra |
| Examen y repaso | ✅ Funciona | Respuesta escrita con tolerancia a tipeo y pista visual mnemotécnica |
| Diorama ("entrar al cuadro") | ✅ Funciona | Portal, transición, biblioteca de props, terrenos |
| Aris (asistente por reglas) | ✅ Funciona | Voz del navegador, búsqueda aproximada, compañero 3D con glTF comprimido (318 KB) |
| Mazmorra (sandbox `dungeon-core`) | 🟡 Demo | Solo se usa desde `mocks/dungeon.ts` y el botón "Explorar Mazmorra" |
| Persistencia en el navegador | ✅ Funciona | `mus3o-v1` y `mus3o-memory-v1`, validado al cargar |
| Despliegue en Render | ✅ Configurado | Blueprint `render.yaml`, plan Starter ($7/mo), `/api/health`, servicio SPA y guía en `docs/deployment-render.md` |

Leyenda: ✅ listo · 🟡 parcial · 🔴 pendiente.

## 2. Verificación del código (última ejecución)

| Comando | Resultado |
|---|---|
| `npm test -w @mus3o/shared` | 5 archivos, **69** pruebas, todas pasan |
| `npm test -w @mus3o/server` | 4 archivos, **44** pruebas, todas pasan |
| `npm test -w @mus3o/web` | 15 archivos, **150** pruebas, todas pasan |
| `npm run test:dungeon` (sandbox) | 4 archivos, **7** pruebas, todas pasan |
| `npm run typecheck -w` en los tres | Sin errores |

Las pruebas cubren lógica pura. No hay pruebas automáticas de render 3D: esa parte se valida a mano
(`?demo=…`, capturas, skill `3d-validation`).

## 3. Lo que falta por hacer (código)

Ordenado por impacto en la demo:

1. **Conectar la interfaz al flujo nuevo.** La landing solo envía `{topic}` o `{notes}`. Falta:
   - Selector de **modo** (`exploration`, `quiz`, `biography`, `education`).
   - Envío de **`sources[]`** (extracción de texto en el navegador).
   - Envío de **`images[]`** (redimensionar a ≤ 1024 px y pasar a base64).
   - Mostrar el **grafo** (ya lo consume el layout si viene; falta un selector o un mapa de salas).
   - Opcional: la llamada a `/api/improve-prompt` (hoy solo con `ENABLE_DEBUG_ROUTES=true`).
2. **Extracción de `docx`, `xlsx` y `csv` en el navegador.** El contrato ya los admite. Hoy el input acepta solo `.txt` y `.md`.
3. **Tope diario y caché en memoria.** Se pierden al reiniciar el servidor. Para la demo basta; para producción harían falta almacenamiento persistente.

## 4. Pendiente de entrega (checklist del evento)

Según `CLAUDE.md` y el README del evento. Estos son archivos de entrega, no código:

| Ítem | Estado observado |
|---|---|
| `platanus-hack-project.jsonc`: nombre, one-liner, descripción en español y `deploy-url` | ❌ Quedan `<FILL THIS>` en los cuatro campos |
| `project-description.md` con la descripción real | ❌ Sigue el texto de plantilla |
| `project-logo.png` de 1000×1000, ≤ 500 KB | ⚠️ Revisar. Existe `project-logo.png`, pero no se verificó su tamaño |
| `README.md` conciso | ✅ Actualizado y limpio |
| Deploy desde el repo personal espejo | ❌ No hay URL de despliegue todavía |
| `main` con la última versión estable | ❌ Pendiente de checkpoint (`dev` → `main`) |

## 5. Discrepancias conocidas (documentación vs código)

| Dónde | Qué dice | Qué hace el código | Impacto |
|---|---|---|---|
| `prompts.ts`, `SYSTEM_PROMPT` (tema) | "2 a 4 salas" y "2 a 4 piezas" | El schema admite hasta 8 salas y 12 piezas | Bajo: el prompt de tema es más conservador a propósito |
| `schema.ts`, `PartSchema` | Comentario: medidas "≤ 4" | Acepta valores de 0 a 32 | Bajo: el renderizado vuelve a acotar |
| `docs/contrato-flujo.md` | "Estado: implementado" | El servidor y el contrato sí; la interfaz no lo usa | Medio: no confiar en que el flujo nuevo ya esté en la demo |
| `CLAUDE.md` y `docs/idea.md` | Subida de docx, xlsx, csv | Solo `.txt` y `.md` en la interfaz | Medio: ver pendiente 2 |
| Términos | `mode` en el store (explorar / examen) y `mode` en el museo (exploration…) | Son conceptos distintos | Bajo: cuidado al leer el código (ver [frontend.md](./frontend.md)) |
| `schema.ts`, `DioramaPropSchema` | `pieceId` comentado como "la ficha se abre al acercarse" | Dentro del diorama, el enlace más cercano y de frente se vuelve el foco (`focusedId`), y `E` abre la ficha | Ninguno: el comportamiento real está descrito en [diorama.md](./diorama.md) |

## 6. Decisiones abiertas

- **Criterio de verificación de citas:** hoy una coincidencia parcial ≥ 60 % cuenta como verificada (ver [fuentes-e-imagenes.md](./fuentes-e-imagenes.md) §1). Puede endurecerse si la demo muestra citas flojas.
- **Límite diario:** 200 llamadas (`MAX_DAILY_GENERATIONS`). Ajustar según el saldo de créditos.
- **Modelo por defecto:** `claude-sonnet-5-5`. Hay una skill de presupuesto (`token-budget`) para decidir cuándo usar un modelo más económico.

## 7. Ramas en el remoto

El remoto tiene ramas de trabajo que **no están en `dev`** (por ejemplo `feature/explore-mode`,
`feature/memory-sources`, `feature/room-keys`, `feature/semantic-sensory-pipeline`, `perf/optimize-aris-model`,
`feat/update-project-logo`). Este documento no las revisó. Antes de asumir que una función existe, mira `dev`.

## 8. Historial relevante (para ubicarse)

- `docs/idea.md`, `docs/contrato-flujo.md` y `docs/seguridad.md`: decisiones de producto, del contrato del flujo y de seguridad.
- Merges recientes en `dev`: integración del portal con etiquetas legibles, memoria y fuentes (`1f826d3`).
- `dungeon-core` y `scripts/setup_assets.sh`: sandbox y preparación de assets de KayKit (ver [arquitectura.md](./arquitectura.md)).
