# Registro de optimizaciones 🍌

Revisión de optimización hecha sobre `dev` (2026-10-24). La revisión solo registró; después **se aplicaron
las 6 mejoras seguras**, cada una en su rama, con su prueba y mergeada a `dev` (ver el estado abajo). Cada punto
conserva el archivo y la línea de **antes del cambio**, el costo, el cambio y cómo se comprobó. Los números de
línea de la sección 1 describen el código previo y ya no coinciden con `dev`.

## Estado de aplicación

| # | Mejora | Estado | PR | Prueba |
|---|---|---|---|---|
| 1 | `Set` de conceptos por frame en el diorama | ✅ Aplicada | #32 | `palace/conceptIds.test.ts` (4). Sin verificar en navegador |
| 2 | Apuntes normalizados una vez en `verifySources` | ✅ Aplicada | #31 | 2 pruebas de equivalencia en `shared/sources.test.ts` |
| 3 | Caché de museos LRU | ✅ Aplicada | #29 | `server/cache.test.ts` (3) |
| 4 | Deduplicación de peticiones de imagen simultáneas | ✅ Aplicada | #30 | 3 pruebas en `server/images.test.ts` (2 fallan con el código anterior) |
| 5 | `dueCountFor` una vez por render en la landing | ✅ Aplicada | #33 | `memory/dueLabel.test.ts` (3). Sin verificar en navegador |
| 6 | Lista de ids cacheada en HUD y hooks de memoria | ✅ Aplicada | #34 | `palace/conceptIds.test.ts` (4 más). Sin verificar en navegador |
| A | `Hud` y `DioramaOverlay` con `lazy` | ⏳ Pendiente | — | Requiere recorrido manual (sección 2) |
| B | Mocks y `dungeon-core` con `import()` | ⏳ Pendiente | — | — |

Verificación posterior sobre `dev`: 69 pruebas en `shared`, 44 en `server`, 150 en `web`, y typecheck sin errores en los tres.
Las mejoras 1, 5 y 6 se comprobaron con pruebas de lógica, build y typecheck, **no en un navegador**.

## Criterio de "sin riesgo"

Un punto entra en la lista segura solo si cumple **todo** esto:

- No cambia el comportamiento visible ni el contrato de datos.
- No agrega dependencias ni toca binarios (`.glb`, `.png`, `.ttf`, …).
- Se puede comprobar con una prueba existente, con una prueba nueva trivial, o con un recorrido manual corto que se indica.

Lo que no cumple va a la sección 2 (riesgo bajo, no nulo) o a la 3 (descartado).

## Método

- Lectura de los módulos y búsqueda de trabajo repetido (`grep` por llamadas, `useFrame`, caches).
- `npm run build -w @mus3o/web` para medir el peso real de los chunks.
- Un experimento temporal sobre `App.tsx` (ya revertido, el árbol quedó limpio) para medir la mejora más grande.
- Impacto estimado por inspección de código, **no por profiling en ejecución**. Donde no se midió se dice.

---

## 1. Mejoras seguras (6, aplicadas)

### 1. Reconstrucción de un `Set` de conceptos en cada frame dentro del diorama

| | |
|---|---|
| **Dónde** | `apps/web/src/diorama/DioramaRuntime.tsx:314` |
| **Costo actual** | `new Set(allConcepts(st.palace).map((c) => c.id))` se ejecuta en cada frame (~60/s) mientras `phase === 'inside'` (hay un `return` temprano en la línea 265 para las demás fases). Reserva un arreglo y un `Set` por frame: presión de GC con el jugador dentro del diorama. |
| **Cambio** | Calcular el `Set` una vez por `palace` y leerlo desde el callback. Conviene una caché por referencia (`WeakMap<Museum, Set<string>>`) y no un `useMemo`: el callback lee `useStore.getState().palace`, y un `useMemo` obligaría a suscribir el componente al store (re-renders nuevos). La lógica de búsqueda del enlace más cercano no cambia. |
| **Por qué es seguro** | Es un dato derivado puro de `palace`. El resultado de `ids.has(...)` es idéntico. |
| **Cómo comprobarlo** | `npm run typecheck -w @mus3o/web`. No hay prueba automática del runtime: recorrido manual con `?demo=historia`, entrar a un cuadro con `E` y confirmar que al mirar un personaje enlazado sigue abriéndose su ficha. |
| **Impacto** | Medio en el diorama (solo allí). Bajo en el resto. |

### 2. `locateFragment` re-normaliza todos los apuntes por cada pieza

| | |
|---|---|
| **Dónde** | `packages/shared/src/sources.ts`: `locateFragment` llama `normalizeWithMap(nfc)` sobre **todo** el texto en cada invocación; `verifySources` la llama una vez por pieza. |
| **Costo actual** | Con hasta 8 salas × 12 piezas = 96 piezas y apuntes de hasta 20 000 caracteres, se normaliza el mismo texto hasta 96 veces. Además, la búsqueda del fragmento común más largo (cuando la cita no aparece completa) prueba ventanas de tamaño `ceil(0.6·len)` sobre cada pieza. Es CPU del servidor en cada generación que no está en caché. |
| **Cambio** | Normalizar los apuntes **una vez** por llamada a `verifySources` y reutilizar `{ norm, map }` en cada búsqueda. Mantener la firma pública de `locateFragment(text, fragment, from)`: añadir un parámetro opcional o una función interna que reciba lo ya normalizado. |
| **Por qué es seguro** | Mismas entradas, mismas salidas. Es memoización de un cálculo puro. |
| **Cómo comprobarlo** | `npm test -w @mus3o/shared` y `npm test -w @mus3o/server`. `packages/shared/src/sources.test.ts` cubre la coincidencia exacta con su línea (línea 55) y el respaldo por fragmento común ≥ 60 % (línea 82); `apps/server/src/sources.test.ts` cubre la integración en el servidor. |
| **Impacto** | Medio en CPU del servidor. La latencia total la domina la llamada a Claude, así que el usuario casi no lo nota; sí ayuda bajo carga concurrente. |

### 3. La caché de museos expulsa por orden de inserción (FIFO), no por uso (LRU)

| | |
|---|---|
| **Dónde** | `apps/server/src/cache.ts`: `getCached` solo hace `store.get(...)`; `setCached` expulsa `store.keys().next()` (el más antiguo insertado). |
| **Costo actual** | Un museo muy pedido se expulsa igual que uno que nadie volvió a pedir. Con 100 entradas y una demo pública, una generación cara (hasta 16 000 tokens de salida) puede pagarse otra vez. |
| **Cambio** | En un acierto de caché, borrar y volver a insertar la clave (`delete` + `set`), el mismo patrón que `apps/server/src/images.ts` ya usa para su LRU de archivos (`files.delete(key); files.set(key, entry)`). |
| **Por qué es seguro** | No cambia qué se devuelve ni los límites; solo el orden de expulsión. |
| **Cómo comprobarlo** | No hay prueba de `cache.ts` hoy: añadir una de tres líneas (llenar a 100, leer la primera, insertar una más y comprobar que la primera sigue). `npm test -w @mus3o/server`. |
| **Impacto** | Bajo a medio: ahorra llamadas a Claude repetidas, que es el costo real en créditos. |

### 4. Sin deduplicación de peticiones simultáneas idénticas en el proxy de imágenes

| | |
|---|---|
| **Dónde** | `apps/server/src/images.ts`: `resolveImage` (líneas 167–179) y el handler de `/image/file`. `resolveCache` solo guarda resultados ya resueltos. |
| **Costo actual** | Dos peticiones iguales que llegan a la vez (dos usuarios abriendo el mismo museo, o un cliente con la pestaña recargada) hacen cada una su llamada a Wikimedia y ocupan cada una uno de los 3 cupos de concurrencia (`slot`). El cliente ya deduplica (`apps/web/src/lib/images.ts`), pero el servidor no. |
| **Cambio** | Un `Map<clave, Promise>` de peticiones en vuelo: si la clave ya está, devolver la misma promesa; limpiarla en `finally`. |
| **Por qué es seguro** | La clave de resolución ya existe (`lang|wiki|commons`). Al limpiar en `finally`, un `UpstreamError` no queda cacheado, igual que hoy. Todos los que esperaban reciben el mismo resultado o el mismo error. |
| **Cómo comprobarlo** | `npm test -w @mus3o/server`. `images.test.ts` ya usa `clearImageCaches` y ya prueba que un error transitorio no se cachea (línea 92): esa prueba debe seguir pasando. Añadir una nueva: dos llamadas simultáneas, un solo fetch simulado. |
| **Impacto** | Medio ante Wikimedia con límite de tasa; casi nulo con un solo usuario. |

### 5. `dueCountFor(saved)` se evalúa 3 veces por render en la landing

| | |
|---|---|
| **Dónde** | `apps/web/src/ui/Landing.tsx:182-183` (una vez en la condición y dos en el JSX). La función (`apps/web/src/memory/hooks.ts`) construye la lista de ids de todos los conceptos y calcula la memoria de la sala. |
| **Costo actual** | La landing se vuelve a renderizar en **cada pulsación** del editor de apuntes, así que son 3 cálculos O(conceptos) por tecla. El costo absoluto es pequeño (hasta 96 conceptos), pero es trabajo puramente repetido. |
| **Cambio** | Calcular `const due = dueCountFor(saved)` una vez (o con `useMemo` sobre `saved`) y usar `due` en las tres posiciones. |
| **Por qué es seguro** | Mismo valor en el mismo render. |
| **Cómo comprobarlo** | `npm run typecheck -w @mus3o/web`. Visual: con un palacio guardado con repasos pendientes, el botón "Continuar" sigue mostrando "· N repasos pendientes". |
| **Impacto** | Bajo. Es la más trivial de la lista. |

### 6. `allConcepts(palace)` repetido por render en el HUD y en los hooks de memoria

| | |
|---|---|
| **Dónde** | `apps/web/src/ui/Hud.tsx:149-150` (dos llamadas seguidas: `total` y `conceptCount`) y `apps/web/src/memory/hooks.ts:43` (`useDueCount` arma `allConcepts(palace).map(...)` en cada render). |
| **Costo actual** | El HUD se suscribe a `focusedId`, que cambia al mover la mirada entre objetos, así que se vuelve a renderizar con frecuencia. Cada render recorre las salas y reconstruye arreglos. |
| **Cambio** | Una sola llamada a `allConcepts` por render (`const concepts = allConcepts(palace)`), y `useMemo` por `palace` para la lista de ids en `useDueCount`. |
| **Por qué es seguro** | Datos derivados de `palace`, que no cambia durante el recorrido. |
| **Cómo comprobarlo** | `npm run typecheck -w @mus3o/web` y `npm test -w @mus3o/web` (`model.test.ts` ya prueba `dueIds` y `roomMemory`, que alimentan estos contadores). Visual: los contadores del HUD no cambian. |
| **Impacto** | Bajo. Se suma a la mejora 5 como limpieza de trabajo repetido. |

---

## 2. Mejoras de riesgo bajo (no cuentan en las 6, pero son las de más impacto)

### A. three.js está dentro del chunk de entrada y bloquea el primer render

**Medido** con `npm run build -w @mus3o/web`:

| Chunk | Antes | Con el cambio de prueba |
|---|---|---|
| `index` (entrada, lo que carga la landing) | **1 105 kB** (312 kB gzip) | **356 kB** (112 kB gzip) |
| `three.module` | dentro de `index` | 688 kB (178 kB gzip), chunk propio |
| `Hud` | dentro de `index` | 20 kB (7 kB gzip), chunk propio |

La entrada baja unos **749 kB sin comprimir y unos 200 kB gzip (−64 % gzip)**.

- **Qué mejora y qué no:** la landing **sigue descargando three.js**, porque arranca con el texto de ejemplo cargado y monta de inmediato la vista previa 3D (`Landing.tsx:194`, `Preview` es `lazy` e importa three). Lo que cambia es que three.js sale del **camino crítico**: el código de la landing (React, store, formulario) se parsea y se pinta con 112 kB gzip en lugar de 312 kB, y three.js llega en paralelo con la vista previa. Los bytes totales de la landing casi no bajan; el beneficio es el primer render y la interactividad. Para el resto de la sesión (pantalla del palacio) no cambia nada. No se midió el tiempo real de carga, solo el tamaño de los chunks.
- **Causa:** `App.tsx` importa `Hud` y `DioramaOverlay` de forma estática. `Hud.tsx` importa `DioramaMinimap`, que importa `diorama/model`, que arrastra three.js y todos los constructores de props. Aunque `World` ya es `lazy`, three.js entra por este otro camino.
- **Cambio de prueba (revertido):** cargar `Hud` y `DioramaOverlay` con `lazy(() => import(...))` y envolverlos en un `<Suspense fallback={null}>`, igual que ya se hace con `World`. Solo se muestran en la pantalla del palacio.
- **Por qué no está en las 6:** introduce una frontera asíncrona. Hay que comprobar a mano que el HUD aparece sin parpadeo y que el arranque sincrónico con `?demo=` (arriba de `App.tsx`) sigue igual. El build y el typecheck pasaron en la prueba, pero **no se probó en el navegador**.
- **Cómo comprobarlo si se aplica:** `npm run build -w @mus3o/web` (comparar tamaños), `?demo`, `?demo=historia`, entrar al palacio y a un diorama, y confirmar HUD, minimapa y teclas `E`, `M`, `T`, `Q`.

### B. `@mus3o/dungeon-core` y los mocks entran en el chunk de la landing

`App.tsx` importa `mocks/dungeon.ts` (y con él `@mus3o/dungeon-core`), `mocks/historia.ts` y `palace/presets.ts` de forma estática (~29 kB de datos en total en el código fuente). Importarlos con `import()` solo al usar `?demo=…` lo evita. Es un ahorro pequeño comparado con A, y convierte un botón síncrono en uno asíncrono, por eso queda como riesgo bajo.

---

## 3. Revisado y descartado

| Idea | Por qué no |
|---|---|
| Convertir las fuentes TTF a WOFF2 | Toca binarios, que `CLAUDE.md` prohíbe leer o modificar sin pipeline. Además no está confirmado que drei `<Text>` (troika) cargue WOFF2. |
| Añadir `compression` a Express | Es una dependencia nueva. No se midió el tamaño real de una respuesta de museo; sin esa medida, no se justifica. |
| `manualChunks` en `vite.config.ts` | Con A aplicada, three.js ya sale a su propio chunk. Solo tendría sentido para estabilizar la caché del navegador entre despliegues. |
| `<link rel="preload">` de fuentes | Se cargan desde dentro del canvas, no desde CSS; no se pudo confirmar que el preload se reutilice. |
| `new THREE.Vector3` en `DioramaRuntime.tsx:244` | Se ejecuta una vez por transición, no por frame. No es un problema real. |
| `sha256(JSON.stringify(flow.data))` en `app.ts` | Serializa el cuerpo (hasta 8 MB con imágenes) también en aciertos de caché, pero el flujo nuevo aún no se usa desde la interfaz; revisar cuando se conecte. |
| `cleanNotes` y `stripDelimiters` aplicados dos veces | Expresiones regulares sobre ≤ 20 000 caracteres: costo despreciable. |

## 4. Orden sugerido para aplicarlas

1. Las 6 seguras, de una en una, cada una con su prueba. Las que tienen prueba nueva (3 y 4) son las más rápidas de validar.
2. La **A** como cambio aparte, con recorrido manual completo: es la de mayor impacto para el primer paint de la landing.
3. La **B** solo si después de A todavía importa el peso de entrada.

Tras aplicar cualquiera, actualizar este registro y [estado-y-pendientes.md](./estado-y-pendientes.md).
