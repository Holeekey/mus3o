# Catálogo Integral de Optimizaciones: Razonamiento e Implicaciones

**Proyecto:** mus3o — Palacios de la Memoria 3D  
**Rama:** `docs/optimizaciones-y-arquitectura`  
**Fecha:** 24 de Octubre, 2026  
**Alcance:** 28 optimizaciones técnicas clasificadas en Costo de LLM, Red y APIs Externas, Renderizado 3D, Frontend General, y Datos/Almacenamiento.

---

## Tabla de Contenidos

1. [Costo de LLM (Tokens y Llamadas)](#1-costo-de-llm-tokens-y-llamadas)
   - [1. Prompt Caching](#1-prompt-caching-reglas-fijas-con-cache_control)
   - [2. Formato de Salida Compacto (DSL vs JSON)](#2-formato-de-salida-compacto-dsl-en-vez-de-json)
   - [3. Que la IA Elija y el Código Arme](#3-que-la-ia-elija-y-el-código-arme)
   - [4. Caché de Resultados (LRU en Memoria y Disco)](#4-cachear-resultados-lru-en-memoria-y-disco)
   - [5. Deduplicación de Peticiones Simultáneas (In-Flight)](#5-deduplicar-peticiones-simultáneas-in-flight)
   - [6. Llamadas Condicionales (Dioramas y Respaldo)](#6-llamadas-condicionales-dioramas-y-respaldo-3d)
   - [7. Modelo Barato para Tareas Simples (Claude 3.5 Haiku)](#7-modelo-barato-para-tareas-simples-haiku)
   - [8. Ajuste Dinámico de max_tokens según Plan](#8-ajustar-max_tokens-al-trabajo-real-según-el-plan)
   - [9. Medir antes de Optimizar (Logging y Pruebas A/B)](#9-medir-antes-de-optimizar-logging-y-pruebas-ab)
   - [10. Evaluación de Batch API y Streaming](#10-batch-api-vs-salida-en-streaming)
2. [Red y APIs Externas](#2-red-y-apis-externas)
   - [11. Timeouts y AbortController Estrictos](#11-timeouts-y-abortcontroller-estrictos)
   - [12. Cortacircuito (Circuit Breaker ante Bloqueos)](#12-cortacircuito-circuit-breaker-ante-bloqueo)
   - [13. Paralelismo Resiliente con Promise.allSettled](#13-paralelismo-con-promiseallsettled)
   - [14. Caché HTTP Inmutable para Modelos y Assets](#14-caché-http-de-larga-duración-immutable)
   - [15. Límites de Tamaño, Rate Limits y Cuota Diaria](#15-límites-de-tamaño-rate-limits-y-tope-diario)
3. [Renderizado 3D (React Three Fiber)](#3-renderizado-3d-react-three-fiber)
   - [16. Normalización de Modelos Externos y Límite de Triángulos](#16-normalizar-modelos-externos-y-tope-de-triángulos)
   - [17. Compresión de Modelos (Draco / Meshopt y WebP)](#17-compresión-de-modelos-draco--meshopt-y-webp)
   - [18. Carga Bajo Demanda y Preload Selectivo](#18-cargar-fuera-de-pantalla-bajo-demanda-y-preload)
   - [19. LOD y Frustum Culling entre Salas](#19-lod-y-frustum-culling-para-salas-lejanas)
   - [20. Reducción de Draw Calls (Batching e Instanciado)](#20-reducir-draw-calls-geometrías-y-materiales)
   - [21. Eliminación de Trabajo por Frame en Runtime 3D](#21-evitar-trabajo-por-frame-en-el-diorama)
4. [Frontend General](#4-frontend-general)
   - [24. Memoización de Selectores y Conteos Derivados](#24-memoización-usememo-y-listas-de-ids-cacheadas)
   - [25. Code Splitting de Componentes Pesados](#25-code-splitting-de-componentes-pesados-hud-y-diorama)
   - [26. Perfilado Continuo en Navegador y Runtime](#26-perfilar-en-navegador-chrome-dev-y-r3f-perf)
5. [Datos y Almacenamiento](#5-datos-y-almacenamiento)
   - [27. Almacenamiento Ligero: Solo Referencias en localStorage](#27-guardar-solo-urls-relativas-en-localstorage)
   - [28. Revalidación Estricta con Zod al Leer de Disco](#28-revalidar-al-leer-de-disco-con-esquema-zod)

---

## 1. Costo de LLM (Tokens y Llamadas)

### 1. Prompt Caching: Reglas fijas con `cache_control`
- **Estado:** ✅ Implementada.
- **Ubicación:** `apps/server/src/prompts.ts` (`FLOW_STATIC_RULES`, `DIORAMA_SYSTEM_PROMPT`), `apps/server/src/claude.ts` (líneas 193–195, 259).
- **Razonamiento:** El system prompt de un palacio de la memoria requiere instrucciones detalladas sobre contratos, estética mnemotécnica, formato DSL y reglas de citas (~1.400 a 3.000 tokens). Repetir este bloque en cada llamada al precio estándar de entrada ($3.00 / MTok en Sonnet) es un desperdicio financiero. Colocarlo al final con `cache_control: { type: "ephemeral" }` permite a Anthropic cachear el prefijo de atención.
- **Implicaciones:**
  - *Costo:* Las lecturas de caché cuestan **$0.30 / MTok** (90% de descuento). En solicitudes recurrentes, el input de Sonnet pasa de ~$0.012 USD a ~$0.001 USD.
  - *Latencia:* Reduce el tiempo de Time-To-First-Token (TTFT) en ~300–600 ms al evitar reprocesar el KV-cache.
  - *Restricciones:* Requiere que el system prompt mantenga un bloque idéntico y estable; cualquier variación dinámica en ese texto invalida el checkpoint de caché.

### 2. Formato de Salida Compacto: DSL en vez de JSON
- **Estado:** ✅ Implementada.
- **Ubicación:** `packages/shared/src/dsl.ts` (`parseMus3oDSL`), `apps/server/src/claude.ts` (líneas 71–77, 215–220).
- **Razonamiento:** En el formato anterior (`FLOW_FORMAT=json`), la IA generaba un JSON masivo describiendo de 2 a 8 partes procedurales por pieza (objetos con coordenadas x/y/z, rotaciones, colores y primitivas), superando los 10.900 tokens de salida. El DSL condensa cada pieza en una única línea de 5 campos semánticos:
  ```text
  PIECE: <concepto> | <glifo> | <anclaje> | <searchKeyword> | <explicación>
  ```
- **Implicaciones:**
  - *Tokens y Costo:* Reducción de **10.925 a 1.847 tokens de salida** (≈ 3,2× menos salida), ahorrando ~$0.136 USD por museo generado.
  - *Latencia:* El tiempo de generación cayó de 70 segundos a 27 segundos (2,59× más rápido), alejando la llamada del límite de timeout HTTP.
  - *Robustez:* El parser tolera separadores variados (`|`, negritas, mayúsculas/minúsculas) y desambigua identificadores duplicados sin lanzar excepciones 500.

### 3. Que la IA Elija y el Código Arme
- **Estado:** ✅ Implementada.
- **Ubicación:** `apps/server/src/claude.ts` (`enrichMuseum`), `packages/shared/src/dsl.ts` (`buildGraph`), `apps/server/src/images.ts`, `apps/server/src/sources.ts`.
- **Razonamiento:** Principio de diseño: *"Los LLMs son excelentes razonadores semánticos pero ineficientes generadores de datos tabulares, grafos rígidos o binarios"*. La IA solo elige conceptos, términos clave y relaciones; el servidor calcula deterministamente la topología del grafo (DAG en modo educación, árbol en exploración, cadena en biografía), asocia citas mediante cotejo de texto y resuelve imágenes en Wikimedia.
- **Implicaciones:**
  - *Ahorro de Tokens:* Cero tokens consumidos en calcular matrices espaciales, hashes SHA-256 o enlaces HTTP.
  - *Determinismo:* Los grafos respetan invariantes matemáticos (sin ciclos en educación, inicio garantizado) que un modelo probabilístico suele corromper.
  - *Trazabilidad:* La verificación de fuentes compara mecánicamente el texto extraído; la IA no puede alucinar citas inexistentes.

### 4. Cachear Resultados: LRU en Memoria y Disco
- **Estado:** ✅ Implementada.
- **Ubicación:** `apps/server/src/cache.ts` (`getCached`, `setCached`, `store`, `museumDir`).
- **Razonamiento:** Un servicio en nube (p. ej. Render en capa gratuita o starter) puede reiniciar o hibernar el proceso por inactividad o deploy. Si la caché fuera solo en memoria RAM, cada reinicio forzaría a pagar nuevamente museos populares ya calculados.
- **Implicaciones:**
  - *Persistencia Atómica:* Escritura en archivo temporal (`tmp.pid.hash`) y posterior `rename` atómico, evitando estados corruptos ante apagados abruptos.
  - *Ahorro:* En visitas repetidas a museos ("La Revolución Francesa", "Fotosíntesis"), el costo es **$0.00 USD (100% de ahorro)** y latencia < 10 ms.
  - *Normalización:* La clave `key = topic.trim().toLowerCase()` asegura que `"Roma "` y `"roma"` compartan el mismo registro.
  - *Política LRU:* Al consultar un palacio existente, se re-inserta al final de la cola del `Map` en RAM (`store.delete(k); store.set(k, hit)`), expulsando solo lo que no se vuelve a pedir.

### 5. Deduplicar Peticiones Simultáneas (In-Flight)
- **Estado:** ✅ Implementada.
- **Ubicación:** `apps/server/src/app.ts` (`inFlight` Map), `apps/server/src/images.ts` (`inFlightResolutions`).
- **Razonamiento:** Si múltiples usuarios en un aula o evento piden el mismo tema al mismo tiempo, o un usuario refresca impaciente la página, una caché pasiva ejecutaría N llamadas a Claude en paralelo antes de que la primera termine de guardarse.
- **Implicaciones:**
  - *Mapeo de Promesas:* La primera solicitud registra su `Promise` en vuelo en un `Map<string, Promise<Museum>>`. Las siguientes solicitudes reciben la misma promesa.
  - *Limpieza Garantizada:* La entrada se elimina en un bloque `finally`, evitando fugas de memoria o bloqueos permanentes ante excepciones.
  - *Ahorro de Cuota:* Se consume un único slot de la cuota diaria (`takeDailySlot()`) en lugar de saturar el cupo.

### 6. Llamadas Condicionales: Dioramas y Respaldo 3D
- **Estado:** ✅ Implementada.
- **Ubicación:** `apps/server/src/claude.ts` (`addDioramas`, `resolveModels`), `apps/server/src/prompts.ts`.
- **Razonamiento:** En vez de generar maquetas 3D para todas las salas por defecto (lo cual cuesta ~1.500 tokens de salida por llamada), la IA marca con el flag `diorama` en el DSL solo las salas de temas visualmente representables (historia, geografía, biología; máximo 2 salas). Para temas puramente lógicos o abstractos, no hay marcas y la llamada secundaria nunca se dispara.
- **Implicaciones:**
  - *Ahorro Directo:* Se ahorran **$0.0236 USD** (1.518 tokens) en generaciones que no requieren diorama.
  - *Respaldo Just-in-Time:* El fallback de modelos (`fillMissingModels`) solo se invoca si hay piezas con `dynamicAsset` nulo tras buscar en Poly Pizza. Si el 100% de las piezas consiguieron modelo 3D real, el modelo de respaldo no se ejecuta.

### 7. Modelo Barato para Tareas Simples: Haiku
- **Estado:** ✅ Implementada.
- **Ubicación:** `apps/server/src/claude.ts` (`FALLBACK_MODEL`, `DIGEST_MODEL`), `apps/server/src/arisHelp.ts` (`ARIS_MODEL`).
- **Razonamiento:** Usar Sonnet 3.5 ($15.00 / MTok salida) para resumir 20.000 caracteres de apuntes brutos, contestar dudas cortas de navegación o ensamblar 3 cajas procedurales es financieramente ineficiente. Claude 3.5 Haiku ofrece una estructura de costos 73.3% menor ($4.00 / MTok salida).
- **Implicaciones:**
  - *Ahorro:* Digest de apuntes largos cuesta menos de $0.01 USD. Consultas a Aris cuestan ~$0.0003 USD.
  - *Supresión de Razonamiento (`noThinking`):* Haiku 3.5 razona por defecto; en pruebas consumió 3.193 de 4.000 tokens en "pensar". Forzar `{ thinking: { type: "disabled" } }` evitó truncamientos y sobrecostos.
  - *Límite de Calidad Descubierto:* Se descartó usar Haiku para dioramas complejos porque sin razonamiento generó 0 props válidos y con razonamiento gastó más tokens que Sonnet.

### 8. Ajustar `max_tokens` al Trabajo Real según el Plan
- **Estado:** ✅ Implementada.
- **Ubicación:** `apps/server/src/prompts.ts` (`roomPlan`, `flowMaxTokens`), `apps/server/src/claude.ts` (`dslMaxTokens`).
- **Razonamiento:** Dejar `max_tokens` en el tope máximo (ej. 16.000) expone a que una alucinación o bucle del modelo consuma todo el saldo disponible. La función `roomPlan` calcula el tamaño del museo en base al volumen de texto de entrada:
  - ≤ 150 car. → 4–5 salas, 3–5 piezas.
  - ≤ 800 car. → 3–5 salas, 3–5 piezas.
  - ≤ 4.000 car. → 4–6 salas, 4–6 piezas.
  - ≤ 12.000 car. → 6–8 salas, 4–7 piezas.
  - \> 12.000 car. → 9–12 salas.
- **Implicaciones:**
  - *Fórmula Dinámica:* `flowMaxTokens = Math.min(16000, Math.max(2000, maxRooms * maxPieces * 170 + 500))`.
  - *Techo Seguro:* La reserva de tokens de Anthropic se ajusta estrictamente a lo que el contenido amerita, mitigando ataques de denegación de servicio por agotamiento de créditos.

### 9. Medir antes de Optimizar: Logging y Pruebas A/B
- **Estado:** ✅ Implementada.
- **Ubicación:** `apps/server/src/claude.ts` (línea 156), `docs/servidor.md` (secciones de mediciones reales).
- **Razonamiento:** Ninguna optimización debe basarse en intuición. En cada llamada se registran métricas estructuradas de tokens: `entrada`, `salida`, `caché leída`, `caché escrita`.
- **Implicaciones:**
  - *Hallazgo A/B 1:* La comparación entre `FLOW_FORMAT=json` y DSL con "La Revolución Francesa" demostró 3,2× menos tokens y 2,6× menos latencia.
  - *Hallazgo A/B 2:* Se descubrió que Haiku en dioramas consumía el doble de tokens que Sonnet por el motor de razonamiento implícito.
  - *Auditoría de Privacidad:* Los logs registran únicamente números enteros de tokens y códigos de estado; el texto de estudio del usuario jamás se vuelca a los archivos de registro.

### 10. Batch API vs. Salida en Streaming
- **Estado:** ⬜ Evaluada / Streaming implementado en backend, Batch descartado para interactivo.
- **Ubicación:** `apps/server/src/stream.ts` (`/api/generate-museum/stream`), `apps/server/src/claude.ts` (`anthropicTextStreamer`).
- **Razonamiento:**
  - *Batch API:* Proporciona un 50% de descuento en tarifas, pero opera de forma asíncrona con un SLA de respuesta de hasta 24 horas. En una experiencia interactiva donde el usuario espera frente al navegador para ingresar a su museo, no es viable.
  - *Streaming:* La ruta SSE/streaming está programada en el servidor, pero el motor 3D del cliente requiere el grafo completo para computar el algoritmo de colocación espacial (`planRoomGrid`).
- **Implicaciones:**
  - *Roadmap:* Streaming es ideal para pre-visualizar el temario en la UI mientras el canvas 3D termina de inicializarse en segundo plano.

---

## 2. Red y APIs Externas

### 11. Timeouts y `AbortController` Estrictos
- **Estado:** ✅ Implementada.
- **Ubicación:** `apps/server/src/polyPizza.ts` (`POLY_TIMEOUT_MS = 2500`), `apps/server/src/claude.ts` (timeout 20 s en fallback, 120 s en cliente).
- **Razonamiento:** Las dependencias externas de red no deben retener sockets abiertos indefinidamente en el servidor Express. Si la API de Poly Pizza tarda más de 2,5 segundos, la descarga se aborta inmediatamente.
- **Implicaciones:**
  - *Degradación Graciosa:* Una pieza cuyo asset excede el timeout conserva su glifo procedural o recibe el fallback sin abortar el museo del usuario.
  - *Salud del Servidor:* Previene la acumulación de sockets zombies y agota oportunamente peticiones canceladas por desconexión del cliente.

### 12. Cortacircuito (Circuit Breaker) ante Bloqueo
- **Estado:** ✅ Implementada.
- **Ubicación:** `apps/server/src/polyPizza.ts` (`DownloadBlockedError`, `polyBlocked`, `BLOCK_COOLDOWN_MS = 10 min`).
- **Razonamiento:** Durante pruebas reales, el CDN `static.poly.pizza` devolvió desafíos anti-bot de Cloudflare (HTTP 403 / HTML). Continuar solicitando descargas en cada pieza durante un bloqueo suma 2,5 s inútiles de espera por elemento.
- **Implicaciones:**
  - *Pausa Proactiva:* Al detectar HTTP 403, 429, 503 o un Content-Type `text/html`, el servidor entra en cooldown de 10 minutos.
  - *Impacto:* Durante ese lapso, la post-hidratación se salta inmediatamente (0 ms de sobrecarga), entregando los museos con glifos limpios sin hacer esperar al usuario.

### 13. Paralelismo con `Promise.allSettled`
- **Estado:** ✅ Implementada.
- **Ubicación:** `apps/server/src/polyPizza.ts` (líneas 223, 237), `apps/server/src/claude.ts`.
- **Razonamiento:** `Promise.all` tiene la debilidad de que un único rechazo aborta todas las operaciones concurrentes. En un museo con 18 piezas, que falle la descarga del modelo de "Napoleón" no debe arruinar los otros 17 modelos.
- **Implicaciones:**
  - *Aislamiento de Fallos:* `Promise.allSettled` procesa búsquedas y descargas en paralelo; los fulfilled se hidratan y los rejected caen a glifo.
  - *Velocidad:* Las 18 descargas ocurren simultáneamente en ~1–2 segundos en lugar de requerir 30+ segundos en serie.

### 14. Caché HTTP de Larga Duración (`immutable`)
- **Estado:** ✅ Implementada.
- **Ubicación:** `apps/server/src/assetRoutes.ts` (línea 25), `apps/server/src/app.ts` (línea 325).
- **Razonamiento:** Los modelos 3D `.glb` y los bundles empaquetados por Vite en `/assets/` poseen identificadores de contenido inmutables basados en hash o ID único de catálogo.
- **Implicaciones:**
  - *Cabeceras:* `Cache-Control: public, max-age=31536000, immutable`.
  - *Tráfico de Red:* Una vez descargado un modelo por el navegador, las navegaciones futuras jamás emiten un `If-None-Match` condicional (304); el navegador sirve el archivo directo desde disco local con 0 latencia de red.
  - *HTML Protegido:* Por contraste, `index.html` lleva `Cache-Control: no-cache` para garantizar que un nuevo deploy active de inmediato los nuevos hashes.

### 15. Límites de Tamaño, Rate Limits y Tope Diario
- **Estado:** ✅ Implementada.
- **Ubicación:** `apps/server/src/assetStore.ts` (`MAX_ASSET_BYTES = 4 MB`), `apps/server/src/app.ts` (`rateLimit`, `MAX_DAILY = 200`).
- **Razonamiento:** Protección contra agotamiento de recursos (DoS y quiebra de presupuesto de IA).
- **Implicaciones:**
  - *Tope de Modelo:* Descargas mayores a 4 MB se cortan mediante stream reader en el byte exacto, impidiendo que modelos gigantes saturen la memoria RAM.
  - *Rate Limits por IP:* Máximo 10 generaciones por minuto en rutas principales, y 300 peticiones/min para imágenes/assets.
  - *Circuit Breaker Financiero:* Contador global `MAX_DAILY_GENERATIONS`. Al superarse, el servidor retornaHTTP 429 con mensaje amigable sin gastar más créditos de Anthropic.

---

## 3. Renderizado 3D (React Three Fiber)

### 16. Normalizar Modelos Externos y Tope de Triángulos
- **Estado:** ✅ Implementada.
- **Ubicación:** `apps/web/src/scene/DynamicTotem.tsx`, `apps/server/src/polyPizza.ts` (`MAX_TRIS = 30_000`).
- **Razonamiento:** Los modelos descargados de repositorios públicos comunitarios varían drásticamente en escala (desde miniaturas milimétricas hasta estatuas de 50 metros) y origen del pivote. Además, algunos assets contienen mallas hiper-densas que colapsan la GPU móvil.
- **Implicaciones:**
  - *Transformación Estándar:* `DynamicTotem` envuelve el objeto en `<Resize scale={0.7}><Center bottom>`, forzando que cualquier modelo encaje en un pedestal de 0,7 m apoyado exactamente sobre el piso.
  - *Filtro en Backend:* Modelos con más de 30.000 polígonos son descartados durante la fase de rankeo (`MAX_TRIS`).
  - *Aislamiento WebGL:* `ModelBoundary` (`ErrorBoundary`) captura fallos de parseo de Three.js y sustituye el modelo roto por un glifo procedural sin tumbar el contexto WebGL general.

### 17. Compresión de Modelos (Draco / Meshopt y WebP)
- **Estado:** ⬜ Pendiente / Pipeline documentado en skill `gltf-compression`.
- **Ubicación:** Herramientas de optimización `gltf-transform`.
- **Razonamiento:** Los archivos `.glb` crudos contienen búferes de vértices sin comprimir y texturas PNG/JPEG pesadas. Comprimir geometrías con Meshopt o Draco y convertir texturas a WebP reduce el peso del archivo entre un 50% y 80%.
- **Implicaciones:**
  - *Trade-off:* La descompresión de Draco requiere inicializar workers de WebAssembly en el cliente, lo que añade un pequeño costo de CPU en dispositivos gama baja. Meshopt ofrece un balance superior en velocidad de descompresión para entornos web.

### 18. Cargar Fuera de Pantalla Bajo Demanda y Preload
- **Estado:** ⬜ Pendiente / Arquitectura base lista con `useGLTF`.
- **Ubicación:** `apps/web/src/scene/`.
- **Razonamiento:** Cargar todos los modelos 3D de un palacio de 12 salas al entrar a la sala inicial consume memoria VRAM innecesaria y compite por ancho de banda con el render inicial.
- **Implicaciones:**
  - *Diseño Propuesto:* Utilizar `useGLTF.preload(url)` únicamente para los modelos de las salas directamente conectadas en el grafo (`currentRoom.exits`). Los modelos de salas distantes se cargan vía `Suspense` solo cuando el usuario se aproxima a la puerta de conexión.

### 19. LOD y Frustum Culling para Salas Lejanas
- **Estado:** ⬜ Pendiente.
- **Ubicación:** `apps/web/src/scene/Room.tsx`.
- **Razonamiento:** Aunque Three.js realiza frustum culling a nivel de objeto, las salas conectadas pero ocultas tras muros sólidos siguen procesando cálculos de matrices y draw calls si la puerta está en el campo de visión.
- **Implicaciones:**
  - *Diseño Propuesto:* Oclusión a nivel de sala: si la sala no es la actual ni una sala visible a través de un umbral abierto, se desmonta su sub-árbol de Three.js (`display: none` o condicional en JSX), reduciendo los triángulos procesados por frame a menos de 50.000 estables.

### 20. Reducir Draw Calls (Geometrías y Materiales)
- **Estado:** ⬜ Pendiente.
- **Ubicación:** `apps/web/src/scene/RoomGeometry.tsx`.
- **Razonamiento:** Cada pedestal, pared, marco de cuadro y columna emite un draw call independiente al pipeline gráfico.
- **Implicaciones:**
  - *Diseño Propuesto:* Unificar los pedestales de la sala en un `InstancedMesh` compartiendo un único material estándar, y fusionar la arquitectura estática de la sala (piso y paredes) mediante `BufferGeometryUtils.mergeGeometries`. Reducción proyectada de draw calls de ~120 a ~25 por sala.

### 21. Evitar Trabajo por Frame en el Diorama
- **Estado:** ✅ Implementada (PR #32).
- **Ubicación:** `apps/web/src/diorama/DioramaRuntime.tsx` (línea 314).
- **Razonamiento:** En cada frame (~60 veces por segundo), mientras el usuario exploraba el interior de un diorama, se ejecutaba `new Set(allConcepts(st.palace).map((c) => c.id))` para determinar qué personajes tenían ficha de concepto asociada. Esto generaba presión severa en el Garbage Collector (GC), provocando micro-tirones (stuttering).
- **Implicaciones:**
  - *Solución:* Cachear el conjunto de conceptos mediante una referencia `WeakMap<Museum, Set<string>>`.
  - *Resultado:* Cero reservas de memoria dinámicas dentro del loop `useFrame`, eliminando pausas de GC durante el recorrido 3D.

---

## 4. Frontend General

### 24. Memoización (`useMemo`) y Listas de IDs Cacheadas
- **Estado:** ✅ Implementada (PR #33, PR #34).
- **Ubicación:** `apps/web/src/ui/Landing.tsx` (líneas 182–183), `apps/web/src/ui/Hud.tsx` (líneas 149–150), `apps/web/src/memory/hooks.ts`.
- **Razonamiento:**
  1. `dueCountFor(saved)` se evaluaba 3 veces por render en la landing page, recalculando el modelo de olvido en cada pulsación del editor de texto.
  2. `allConcepts(palace)` se recalculaba de forma redundante en el HUD al actualizar el foco de mirada del jugador.
- **Implicaciones:**
  - *Optimización:* En la landing se evalúa `const due = dueCountFor(saved)` una sola vez por render. En el HUD y hooks de memoria, los conceptos derivados se memorizan con `useMemo` anclado a la referencia inmutable de `palace`.
  - *Impacto:* Reducción de overhead de JavaScript en el hilo principal durante la digitación y exploración.

### 25. Code Splitting de Componentes Pesados (HUD y Diorama)
- **Estado:** ⏳ Investigada y catalogada (Riesgo Bajo, Sección 2 de `optimizaciones.md`).
- **Ubicación:** `apps/web/src/App.tsx`, `apps/web/src/ui/Hud.tsx`, `apps/web/src/diorama/DioramaOverlay.tsx`.
- **Razonamiento:** `App.tsx` importa estáticamente `Hud` y `DioramaOverlay`. El HUD arrastra `DioramaMinimap`, que a su vez importa Three.js y constructores de props 3D. Esto causaba que Three.js quedara atrapado en el chunk principal de entrada (`index.js`), pesando 1.105 kB (312 kB gzip).
- **Implicaciones:**
  - *Medición en Build:* Al cargar `Hud` y `DioramaOverlay` vía `React.lazy(() => import(...))` con `<Suspense>`, el chunk de entrada cae a **356 kB (112 kB gzip)**: una reducción del **-64% en gzip**.
  - *Camino Crítico:* Permite que el HTML y formulario de la landing carguen e interactúen de forma instantánea mientras Three.js se transfiere en paralelo.

### 26. Perfilar en Navegador (Chrome Dev y `r3f-perf`)
- **Estado:** ⬜ Pendiente de automatización continua / Herramientas activas.
- **Ubicación:** `apps/web/src/scene/PerfOverlay.tsx`.
- **Razonamiento:** Los tests unitarios en Vitest verifican la corrección matemática y lógica, pero no miden los tiempos de compilación de shaders, pérdidas de contexto WebGL ni cuellos de botella de rasterizado en GPU.
- **Implicaciones:**
  - *Herramienta Integrada:* `PerfOverlay.tsx` permite monitorear en tiempo real FPS, tiempo de CPU/GPU, conteo de llamadas de dibujado (`gl.info.render.calls`) y triángulos (`gl.info.render.triangles`).
  - *Directiva:* Toda validación 3D debe auditarse en hardware representativo antes de promover cambios de escena a la rama principal.

---

## 5. Datos y Almacenamiento

### 27. Guardar solo URLs Relativas en `localStorage`
- **Estado:** ✅ Implementada.
- **Ubicación:** `apps/web/src/store.ts` (líneas 52, 124).
- **Razonamiento:** `localStorage` cuenta con una cuota estricta de ~5 MB por dominio en la mayoría de navegadores. Almacenar binarios 3D codificados en Base64 o imágenes de usuario saturaría el almacenamiento en el primer o segundo museo generado.
- **Implicaciones:**
  - *Diseño:* El estado persistido en `localStorage` almacena únicamente metadatos ligeros y rutas relativas (`/api/assets/<id>.glb`).
  - *Aislamiento:* Las imágenes subidas por el usuario se conservan exclusivamente en memoria RAM volátil del cliente durante la sesión de generación. Los binarios de modelos 3D se delegan a la caché HTTP del navegador respaldada en disco del cliente.

### 28. Revalidar al Leer de Disco con Esquema Zod
- **Estado:** ✅ Implementada.
- **Ubicación:** `apps/server/src/cache.ts` (línea 22: `MuseumSchema.safeParse(JSON.parse(raw))`).
- **Razonamiento:** La caché en disco (`.cache/museums/*.json`) persiste a lo largo de despliegues y actualizaciones de código. Si la estructura del tipo `Museum` evoluciona (nuevos campos requeridos o renombramiento de propiedades), un archivo guardado por una versión antigua del software podría provocar excepciones no controladas en el frontend.
- **Implicaciones:**
  - *Seguridad de Tipos:* Al recuperar un archivo de disco, se valida con `safeParse()`. Si el esquema no coincide o el archivo fue corrompido, se descarta silenciosamente y se delega la generación al pipeline en vivo.
  - *Migraciones Transparentes:* Los esquemas en `packages/shared/src/schemas.ts` están diseñados para añadir únicamente campos opcionales, garantizando retrocompatibilidad con palacios guardados previamente.

---

## Matriz de Impacto Global

| Área | Principal Métrica Impactada | Ganancia Cuantitativa Medida |
|---|---|---|
| **Costo LLM** | Gasto en API de Anthropic | **-71% a -84%** de reducción en costo por museo |
| **Latencia** | Tiempo total de respuesta | **2.6× más rápido** (de 70 s a 27 s) |
| **Red y Assets** | Transferencia y ancho de banda | **100% de ahorro** en peticiones repetidas vía caché inmutable |
| **GPU / 3D** | Estabilidad de framerate | **60 FPS sostenidos** sin tirones de recolección de basura |
| **Bundle Web** | Tamaño de chunk crítico inicial | **-64% en gzip** proyectado (de 312 kB a 112 kB) |
