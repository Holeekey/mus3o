# 📋 Planes de Ingeniería: Fisuras Críticas Post-Auditoría

> **Fecha:** 25 de octubre de 2026  
> **Objetivo:** Hoja de ruta técnica detallada para implementar las soluciones a las fisuras críticas detectadas en la auditoría técnica, estructuradas para su ejecución en sprints de menos de 6 horas.

---

## 📌 Índice de Planes
1. [Punto 2: Persistencia de Fotos con F5 (IndexedDB)](#punto-2-persistencia-de-fotos-con-f5-indexeddb) — *(Implementado y verificado en cliente)*
2. [Punto 3: Robustecimiento del Parser DSL ante variaciones de LLM](#punto-3-robustecimiento-del-parser-dsl-ante-variaciones-de-llm)
3. [Punto 4: Límites y Cuotas Persistentes en Disco](#punto-4-límites-y-cuotas-persistentes-en-disco)
4. [Punto 5: Integración Funcional de A* en Aris Companion](#punto-5-integración-funcional-de-a-en-aris-companion)
5. [Punto 6: Locomoción e Interacción (Ergonomía de Tecla E y Movimiento)](#punto-6-locomoción-e-interacción-ergonomía-de-tecla-e-y-movimiento)

---

## Punto 2: Persistencia de Fotos con F5 (IndexedDB)

### Resumen
Evita la pérdida de fotos al recargar (`F5`) implementando un almacenamiento asíncrono con la API nativa `IndexedDB` en el navegador para las Data URLs de `userImages`. Permite persistir decenas de megabytes sin tocar el límite de 5 MB de `localStorage`, rehidratando automáticamente las imágenes en el store de Zustand al iniciar la aplicación.

### Archivos Involucrados
- `apps/web/src/lib/imageStorage.ts` *(creado)*: Base de datos IndexedDB nativa (`mus3o-db`, object store `user-images`) con métodos `saveUserImages`, `loadUserImages` y `clearUserImages`. Fallback elegante a memoria.
- `apps/web/src/lib/imageStorage.test.ts` *(creado)*: Suite de pruebas unitarias.
- `apps/web/src/store.ts` *(modificado)*: Disparo de guardado en `enterPalace` y rehidratación en `onRehydrateStorage` / `hydrateUserImages()`.
- `apps/web/src/App.tsx` *(modificado)*: Hook de inicialización para hidratar imágenes antes del montaje 3D.
- `apps/web/src/palace/storeReset.test.ts` *(modificado)*: Prueba de integración de rehidratación.

---

## Punto 3: Robustecimiento del Parser DSL ante variaciones de LLM

### Resumen
Hacer el parser del micro-DSL inmune a variaciones de formato y alucinaciones sintácticas de los LLMs (dos puntos asiáticos `：`, viñetas anidadas `1.1.`, `- [x]`, separadores guión `-` o pipe directo sin dos puntos), asegurando que ninguna sala o pieza sea descartada silenciosamente y garantizando la salida válida de `MuseumSchema`.

### Archivos a Modificar
- `packages/shared/src/dsl.ts`:
  - Normalización previa de caracteres Unicode de ancho completo (`：` U+FF1A a `:`, y `｜` U+FF5C a `|`).
  - Flexibilización de `LINE_TAG` para soportar prefijos Markdown complejos (`^[\s>*•\d.)\-\]]*`) y separadores alternativos (`:`, `：`, `-`, `|`).
  - Fallbacks defensivos en `PIECE` y `ROOM` ante campos incompletos o pipes consecutivos.
- `packages/shared/src/dsl.test.ts`:
  - Suite de pruebas con formatos anómalos de LLM (dos puntos full-width, viñetas complejas, sintaxis mixta).

### Criterio de Verificación
- 100% de los tests en `@mus3o/shared` y `@mus3o/server` pasan sin errores.
- `npm run typecheck` limpio.

---

## Punto 4: Límites y Cuotas Persistentes en Disco

### Resumen
Eliminar la pérdida de cuotas y presupuestos de seguridad ante reinicios de Render unificando los 4 contadores volátiles en memoria (`MAX_DAILY_GENERATIONS`, TTS, Aris y Dioramas) en un almacén persistente en disco (`apps/server/src/budgetStore.ts`) con escrituras atómicas, garantizando que el tope diario sobreviva a reinicios o suspensión de contenedores.

### Archivos a Crear
- `apps/server/src/budgetStore.ts`:
  - Gestor de cuotas diarias persistido en `.cache/budget/<namespace>.json`.
  - Cache en memoria y escrituras atómicas (archivo temporal + `rename`).
  - Funciones: `takeBudget(namespace, amount, maxLimit)`, `getBudgetStatus(...)`, `resetBudgetForTesting()`.
- `apps/server/src/budgetStore.test.ts`:
  - Tests unitarios de consumo, bloqueo por cuota excedida y cambio de día UTC.

### Archivos a Modificar
- `apps/server/src/app.ts`: Conectar `takeBudget("generations", 1, MAX_DAILY)`.
- `apps/server/src/tts.ts`: Conectar `takeBudget("tts_chars", n, MAX_DAILY_CHARS())`.
- `apps/server/src/arisHelp.ts`: Conectar `takeBudget("aris_calls", 1, MAX_DAILY_CALLS())`.
- `apps/server/src/photoDiorama.ts`: Conectar `takeBudget("photo_dioramas", 1, MAX_DAILY_CALLS())`.

---

## Punto 5: Integración Funcional de A* en Aris Companion

### Resumen
Eliminar el aislamiento del paquete `packages/dungeon-core` integrando su algoritmo de navegación `AStarNavigator` dentro del cerebro de Aris (`arisBrain.ts`), dotando al asistente de la capacidad de calcular y verbalizar en tiempo real la ruta óptima de salas a través del grafo topológico del palacio cuando el usuario pregunta cómo llegar a una sala o concepto específico.

### Archivos a Crear
- `packages/dungeon-core/src/adapters/PalaceGraphNavigator.ts`:
  - Adaptador de grafo de palacio a la interfaz `INavigationGraph` de `AStarNavigator`.
  - Función: `findRoomPath(graph, startRoomId, targetRoomId): string[] | null`.
- `packages/dungeon-core/tests/palace-navigator.test.ts`:
  - Tests de cálculo de ruta A* entre salas con múltiples saltos y ramas.

### Archivos a Modificar
- `packages/dungeon-core/src/index.ts`: Exportar el navegador de grafo de palacio.
- `apps/web/src/palace/arisBrain.ts`: Conectar consultas de navegación ("¿cómo llego a X?") con el cálculo de ruta A* de Aris.
- `apps/web/src/palace/arisTranscript.test.ts`: Tests de respuesta de Aris con rutas reales.

---

## Punto 6: Locomoción e Interacción (Ergonomía de Tecla E y Movimiento)

### Resumen
Resolver la sensación de lentitud y falta de respuesta en el recorrido del palacio incrementando la velocidad de desplazamiento en un 33% (`WALK = 6.0 m/s`, `RUN = 10.0 m/s`), ampliando el radio de interacción (`REACH = 4.2 m`) y ensanchando el cono de visión para que presionar la tecla `E` active pedestales y puertas de forma inmediata y natural sin requerir alineación milimétrica.

### Archivos a Modificar
- `apps/web/src/scene/walk.ts`:
  - `WALK`: de `4.5` a `6.0 m/s`.
  - `RUN`: de `8.0` a `10.0 m/s`.
- `apps/web/src/scene/Player.tsx`:
  - `REACH`: de `3.2 m` a `4.2 m` (+31% de alcance).
  - Umbral de ángulo de pedestal: de `0.8` a `0.65` (cono más generoso de ~50°).
  - Alcance de puertas: de `3.8 m` a `4.5 m`, umbral `0.45`.
- `apps/web/src/scene/actions.ts`:
  - Respuesta reactiva sin lag al abrir y cerrar tarjetas con `KeyE`.

---

## 🚀 Estado de Ejecución
- [x] **Punto 2:** Persistencia de Fotos con F5 (IndexedDB) — Commit `447d478`
- [x] **Punto 3:** Robustecimiento del Parser DSL ante variaciones de LLM — Commit `c2302ac`
- [x] **Punto 4:** Límites y Cuotas Persistentes en Disco — Commit `463e85f`
- [x] **Punto 5:** Integración Funcional de A* en Aris Companion — Commit `129e8f9`
- [x] **Punto 6:** Locomoción e Interacción (Ergonomía de Tecla E y Movimiento) — Commit `2f1d102`
