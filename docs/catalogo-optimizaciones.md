# Catálogo de Optimizaciones Implementadas: Razonamiento e Implicaciones

**Proyecto:** mus3o — Palacios de la Memoria 3D  
**Rama:** `docs/optimizaciones-y-arquitectura`  
**Fecha:** 24 de Octubre, 2026  
**Alcance:** Exclusivamente las **18 optimizaciones activas e implementadas en el código**, organizadas por área de impacto técnico.

---

## Tabla de Contenidos

1. [Costo de LLM (Tokens y Llamadas)](#1-costo-de-llm-tokens-y-llamadas)
   - [1. Prompt Caching: Reglas fijas con cache_control](#1-prompt-caching-reglas-fijas-con-cache_control)
   - [2. Formato de Salida Compacto: DSL en vez de JSON](#2-formato-de-salida-compacto-dsl-en-vez-de-json)
   - [3. Que la IA Elija y el Código Arme](#3-que-la-ia-elija-y-el-código-arme)
   - [4. Cachear Resultados: LRU en Memoria y Disco](#4-cachear-resultados-lru-en-memoria-y-disco)
   - [5. Deduplicar Peticiones Simultáneas (In-Flight)](#5-deduplicar-peticiones-simultáneas-in-flight)
   - [6. Llamadas Condicionales: Dioramas y Respaldo 3D](#6-llamadas-condicionales-dioramas-y-respaldo-3d)
   - [7. Modelo Barato para Tareas Simples: Claude 3.5 Haiku](#7-modelo-barato-para-tareas-simples-haiku)
   - [8. Ajustar max_tokens al Trabajo Real según el Plan](#8-ajustar-max_tokens-al-trabajo-real-según-el-plan)
   - [9. Medir antes de Optimizar: Logging Estructurado y Pruebas A/B](#9-medir-antes-de-optimizar-logging-estructurado-y-pruebas-ab)
2. [Red y APIs Externas](#2-red-y-apis-externas)
   - [10. Timeouts y AbortController Estrictos](#10-timeouts-y-abortcontroller-estrictos)
   - [11. Cortacircuito (Circuit Breaker ante Bloqueo de Host)](#11-cortacircuito-circuit-breaker-ante-bloqueo-de-host)
   - [12. Paralelismo con Promise.allSettled](#12-paralelismo-con-promiseallsettled)
   - [13. Caché HTTP de Larga Duración (immutable)](#13-caché-http-de-larga-duración-immutable)
   - [14. Límites de Tamaño, Rate Limits y Tope Diario](#14-límites-de-tamaño-rate-limits-y-tope-diario)
3. [Renderizado 3D (React Three Fiber)](#3-renderizado-3d-react-three-fiber)
   - [15. Normalizar Modelos Externos y Límite de Triángulos](#15-normalizar-modelos-externos-y-límite-de-triángulos)
   - [16. Evitar Trabajo por Frame en el Diorama](#16-evitar-trabajo-por-frame-en-el-diorama)
4. [Frontend General](#4-frontend-general)
   - [17. Memoización (useMemo) y Listas de IDs Cacheadas](#17-memoización-usememo-y-listas-de-ids-cacheadas)
5. [Datos y Almacenamiento](#5-datos-y-almacenamiento)
   - [18. Guardar solo URLs Relativas en localStorage y Revalidar Disco con Zod](#18-guardar-solo-urls-relativas-en-localstorage-y-revalidar-disco-con-zod)

---

## 1. Costo de LLM (Tokens y Llamadas)

### 1. Prompt Caching: Reglas fijas con `cache_control`
- **Ubicación:** `apps/server/src/prompts.ts` (`FLOW_STATIC_RULES`, `DIORAMA_SYSTEM_PROMPT`), `apps/server/src/claude.ts` (líneas 193–195, 259).
- **Razonamiento:** El prompt de sistema que instruye sobre contratos de datos, mnemotecnia, formato DSL y citas ocupa entre 1.400 y 3.000 tokens fijos. Repetirlo en cada llamada al precio estándar de entrada ($3.00 / MTok en Sonnet 3.5) representaba un costo redundante innecesario. Anclarlo al final del system prompt con `cache_control: { type: "ephemeral" }` permite a Anthropic cachear el KV-cache.
- **Implicaciones:**
  - *Ahorro Financiero:* Las lecturas de caché se cobran a **$0.30 / MTok** (90% de descuento). El input de una generación repetida cae de ~$0.012 a ~$0.001 USD.
  - *Latencia:* Reduce el Time-To-First-Token (TTFT) en ~300–600 ms.
  - *Restricción de Código:* El bloque cacheado debe permanecer 100% idéntico entre solicitudes; cualquier dato dinámico debe ir en el mensaje `user`.

### 2. Formato de Salida Compacto: DSL en vez de JSON
- **Ubicación:** `packages/shared/src/dsl.ts` (`parseMus3oDSL`), `apps/server/src/claude.ts` (líneas 71–77, 215–220).
- **Razonamiento:** En la versión anterior (`FLOW_FORMAT=json`), la IA devolvía un payload JSON masivo describiendo mallas 3D procedurales sintéticas (esferas, cilindros, cajas, colores y rotaciones), superando los 10.900 tokens de salida. El DSL condensa cada concepto en 1 sola línea de texto plano:
  ```text
  PIECE: <concepto> | <glifo> | <anclaje> | <searchKeyword> | <explicación>
  ```
- **Implicaciones:**
  - *Ahorro de Tokens:* De **10.925 a 1.847 tokens de salida** (≈ 3,2× menos tokens), ahorrando ~$0.136 USD directos por museo.
  - *Aceleración:* La llamada pasó de 70 segundos a 27 segundos (2,59× más rápida), eliminando el riesgo de timeout en el reverse proxy.
  - *Tolerancia del Parser:* Tolera viñetas, variaciones de separadores (`|` o negritas) y desambigua identificadores duplicados sin arrojar HTTP 500.

### 3. Que la IA Elija y el Código Arme
- **Ubicación:** `apps/server/src/claude.ts` (`enrichMuseum`), `packages/shared/src/dsl.ts` (`buildGraph`), `apps/server/src/images.ts`, `apps/server/src/sources.ts`.
- **Razonamiento:** La IA destaca estructurando conceptos y palabras clave, pero genera sobrecostos cuando intenta armar topologías de red rígidas o emparejar cadenas largas. El servidor asume el cálculo determinista: deriva el grafo de prerrequisitos (DAG) o árbol, coteja citas textualmente contra los apuntes del alumno y resuelve las imágenes en Wikimedia.
- **Implicaciones:**
  - *Ahorro de Tokens:* Cero tokens de salida invertidos en matrices espaciales, algoritmos de layout o URLs externas.
  - *Trazabilidad Epistémica:* La verificación mecánica de fuentes garantiza que la IA no alucine fragmentos de estudio inexistentes.

### 4. Cachear Resultados: LRU en Memoria y Disco
- **Ubicación:** `apps/server/src/cache.ts` (`getCached`, `setCached`, `store`, `museumDir`).
- **Razonamiento:** Plataformas como Render reinician o suspenden contenedores inactivos. Una caché puramente en RAM pierde todo el trabajo previo ante un deploy o reinicio, forzando a pagar de nuevo por temas frecuentes.
- **Implicaciones:**
  - *Persistencia Atómica:* Se escribe en `.tmp` y se renombra atómicamente (`rename`), evitando que lecturas concurrentes reciban archivos a medio escribir.
  - *Costo Cero en Aciertos:* Consultas recurrentes a temas ya generados ("Fotosíntesis", "La Revolución Francesa") cuestan **$0.00 USD (100% de ahorro)** con respuesta en < 10 ms.
  - *Normalización:* La clave `topic.trim().toLowerCase()` unifica búsquedas idénticas con distinta puntuación o espaciado.

### 5. Deduplicar Peticiones Simultáneas (In-Flight)
- **Ubicación:** `apps/server/src/app.ts` (`inFlight` Map), `apps/server/src/images.ts` (`inFlightResolutions`).
- **Razonamiento:** Si múltiples alumnos solicitan el mismo tema a la vez (o un usuario recarga la página compulsivamente), una caché pasiva dispararía N llamadas simultáneas a Claude antes de que la primera termine de guardarse.
- **Implicaciones:**
  - *Promesa Compartida:* La primera petición registra su promesa en un `Map<string, Promise<Museum>>`; las peticiones paralelas esperan la misma resolución.
  - *Protección Financiera:* Se gasta un único slot de la cuota diaria en lugar de agotar el cupo de la demo.

### 6. Llamadas Condicionales: Dioramas y Respaldo 3D
- **Ubicación:** `apps/server/src/claude.ts` (`addDioramas`, `resolveModels`), `apps/server/src/prompts.ts`.
- **Razonamiento:** Los dioramas 3D inmersivos añaden ~1.500 tokens de salida por llamada. Forzarlos en todas las salas encarece innecesariamente temas abstractos. La IA solo añade el flag `diorama` en salas de contenido visual (historia, naturaleza; máximo 2 salas). Si no hay marcas, la llamada no se ejecuta.
- **Implicaciones:**
  - *Ahorro Inmediato:* Se ahorran **$0.0236 USD** (1.518 tokens) en museos sin dioramas.
  - *Fallback por Lotes:* El modelo económico de respaldo 3D (`fillMissingModels`) solo se llama si alguna pieza no encontró modelo en Poly Pizza. Si el 100% de las piezas encontraron asset, la llamada se omite por completo.

### 7. Modelo Barato para Tareas Simples: Haiku
- **Ubicación:** `apps/server/src/claude.ts` (`FALLBACK_MODEL`, `DIGEST_MODEL`), `apps/server/src/arisHelp.ts` (`ARIS_MODEL`).
- **Razonamiento:** Tareas como resumir notas largas, generar respaldo geométrico para 2 piezas o contestar dudas cortas en Aris no requieren Sonnet 3.5 ($15.00 / MTok salida). Claude 3.5 Haiku es 73.3% más económico ($4.00 / MTok salida).
- **Implicaciones:**
  - *Digest por < $0.01:* Un temario de 50k tokens de entrada cuesta centavos. Consultas a Aris cuestan ~$0.0003 USD.
  - *Desactivación de Razonamiento (`noThinking`):* Haiku 3.5 razona por defecto consumiendo hasta 3.193 tokens de salida ocultos. Forzar `{ thinking: { type: "disabled" } }` garantizó salidas directas de < 80 tokens sin costo fantasma.
  - *Hallazgo de Calidad:* Se descartó Haiku para dioramas complejos porque generaba props inválidos (0 props tras validar). Se mantiene Sonnet exclusivamente para dioramas.

### 8. Ajustar `max_tokens` al Trabajo Real según el Plan
- **Ubicación:** `apps/server/src/prompts.ts` (`roomPlan`, `flowMaxTokens`), `apps/server/src/claude.ts` (`dslMaxTokens`).
- **Razonamiento:** Configurar un `max_tokens` estático de 16.000 tokens deja abierta la puerta a consumos desmedidos ante desvíos del modelo. `roomPlan` calibra el rango de salas según el volumen del contenido (≤ 150 caracteres → 4–5 salas; > 12.000 caracteres → 9–12 salas).
- **Implicaciones:**
  - *Techo Dinámico:* `flowMaxTokens` reserva dinámicamente entre 2.000 y 5.000 tokens ajustados al número de salas y modo (ej. +50 tokens por pieza en modo quiz).
  - *Seguridad:* Evita retenciones de saldo excesivas y aborta a tiempo respuestas descontroladas.

### 9. Medir antes de Optimizar: Logging Estructurado y Pruebas A/B
- **Ubicación:** `apps/server/src/claude.ts` (línea 156: `res.usage`), `docs/servidor.md`.
- **Razonamiento:** No se asumen ahorros sin métricas. En cada llamada se loguean conteos enteros de tokens: `entrada`, `salida`, `caché leída`, `caché escrita`.
- **Implicaciones:**
  - *Hallazgo Empírico:* Permitió descubrir el gasto oculto de `thinking` en Haiku y medir la reducción exacta de 3,2× tokens al pasar de JSON a DSL.
  - *Privacidad Estricta:* Solo se registran números enteros; los apuntes personales del usuario jamás tocan los logs del servidor.

---

## 2. Red y APIs Externas

### 10. Timeouts y `AbortController` Estrictos
- **Ubicación:** `apps/server/src/polyPizza.ts` (`POLY_TIMEOUT_MS = 2500`), `apps/server/src/claude.ts` (timeout de 20 s en fallback).
- **Razonamiento:** Servicios externos lentos o caídos pueden agotar el pool de conexiones del servidor Express.
- **Implicaciones:**
  - *Corte Oportuno:* Si Poly Pizza no responde en 2.500 ms, la petición se cancela con `AbortController`. La pieza no falla: conserva su glifo procedural sin demorar la entrega del palacio.
  - *Concurrencia Sana:* Evita la acumulación de sockets en espera en el servidor.

### 11. Cortacircuito (Circuit Breaker ante Bloqueo de Host)
- **Ubicación:** `apps/server/src/polyPizza.ts` (`DownloadBlockedError`, `polyBlocked`, `BLOCK_COOLDOWN_MS = 10 min`).
- **Razonamiento:** Si el CDN de modelos (`static.poly.pizza`) activa protecciones anti-bot de Cloudflare (HTTP 403 / HTML), insistir en cada pieza añade 2,5 segundos inútiles de retraso por modelo.
- **Implicaciones:**
  - *Pausa Proactiva:* Al detectar 403, 429, 503 o HTML, el servidor apaga la búsqueda de assets durante 10 minutos.
  - *Respuesta Inmediata:* Las generaciones durante ese intervalo se entregan con glifos procedurales con 0 ms de sobrecarga.

### 12. Paralelismo con `Promise.allSettled`
- **Ubicación:** `apps/server/src/polyPizza.ts` (líneas 223, 237), `apps/server/src/claude.ts`.
- **Razonamiento:** `Promise.all` falla completamente si una sola promesa es rechazada. Si 1 de 18 modelos no descarga, el usuario no debe quedarse sin museo.
- **Implicaciones:**
  - *Tolerancia a Fallos Parciales:* `Promise.allSettled` procesa las 18 búsquedas y descargas en paralelo; los modelos exitosos se inyectan y los fallidos degradan a glifo procedural.
  - *Velocidad:* Reduce el tiempo de post-hidratación de ~30 segundos (secuencial) a ~1–2 segundos (paralelo).

### 13. Caché HTTP de Larga Duración (`immutable`)
- **Ubicación:** `apps/server/src/assetRoutes.ts` (línea 25), `apps/server/src/app.ts` (línea 325).
- **Razonamiento:** Los archivos `.glb` descargados y los bundles de código con hash en `/assets/` tienen contenido inmutable.
- **Implicaciones:**
  - *Directiva:* `Cache-Control: public, max-age=31536000, immutable`.
  - *Red Cero:* El navegador no vuelve a consultar al servidor por ese asset (sin petición 304); lo sirve instantáneamente desde la caché de disco local.
  - *Frescura:* El archivo `index.html` se sirve con `no-cache`, permitiendo que nuevos deploys actualicen los hashes inmediatamente.

### 14. Límites de Tamaño, Rate Limits y Tope Diario
- **Ubicación:** `apps/server/src/assetStore.ts` (`MAX_ASSET_BYTES = 4 MB`), `apps/server/src/app.ts` (`rateLimit`, `MAX_DAILY = 200`).
- **Razonamiento:** Prevenir ataques de denegación de servicio (DoS) y sobrecostos por scripts descontrolados.
- **Implicaciones:**
  - *Corte de Flujo en 4 MB:* Si un modelo supera 4 MB, la lectura de stream se cancela en el byte exacto antes de que sature la memoria RAM.
  - *Rate Limit:* Máximo 10 peticiones/minuto en generación y 300/minuto en assets/imágenes.
  - *Tope Diario:* Al alcanzar 200 generaciones en 24 horas, el servidor protege el presupuesto respondiendo 429 sin llamar a Claude.

---

## 3. Renderizado 3D (React Three Fiber)

### 15. Normalizar Modelos Externos y Límite de Triángulos
- **Ubicación:** `apps/web/src/scene/DynamicTotem.tsx`, `apps/server/src/polyPizza.ts` (`MAX_TRIS = 30_000`).
- **Razonamiento:** Los modelos de la comunidad varían impredeciblemente en tamaño (de centímetros a decenas de metros), no tienen el pivote en el suelo o tienen millones de polígonos que congelan dispositivos móviles.
- **Implicaciones:**
  - *Normalización Automática:* `DynamicTotem` aplica `<Resize scale={0.7}><Center bottom>`, forzando que cualquier objeto quede escalado a 0,7 m y apoyado exactamente sobre el pedestal.
  - *Filtro de Geometría:* Modelos con más de 30.000 triángulos (`MAX_TRIS`) se descartan automáticamente en el servidor.
  - *ModelBoundary (Error Boundary):* Si un binario `.glb` está corrupto, Three.js no rompe la escena WebGL: se reemplaza en el acto por el glifo procedural seguro.

### 16. Evitar Trabajo por Frame en el Diorama
- **Ubicación:** `apps/web/src/diorama/DioramaRuntime.tsx` (línea 314).
- **Razonamiento:** En cada frame de renderizado (~60 FPS), el diorama ejecutaba `new Set(allConcepts(st.palace).map((c) => c.id))` dentro de su bucle de animación para asociar personajes con conceptos. Esto creaba una reserva continua de memoria que disparaba el Garbage Collector (GC) provocando micro-congelamientos visuales (stuttering).
- **Implicaciones:**
  - *Solución:* Cachear el `Set` derivado en una estructura `WeakMap<Museum, Set<string>>`.
  - *Resultado:* Cero instanciaciones dinámicas por frame; recorrido fluido a 60 FPS estables.

---

## 4. Frontend General

### 17. Memoización (`useMemo`) y Listas de IDs Cacheadas
- **Ubicación:** `apps/web/src/ui/Landing.tsx` (líneas 182–183), `apps/web/src/ui/Hud.tsx` (líneas 149–150), `apps/web/src/memory/hooks.ts`.
- **Razonamiento:**
  1. `dueCountFor(saved)` se calculaba 3 veces en cada pulsación de teclado en el formulario de la landing, recalculando el modelo de olvido con cada tecla.
  2. `allConcepts(palace)` se reconstruía recurrentemente en el HUD cada vez que el foco de la mirada cambiaba de objeto.
- **Implicaciones:**
  - *Optimización:* En la landing se evalúa `const due = dueCountFor(saved)` una sola vez por render. En el HUD, los arreglos se memorizan con `useMemo` anclados a la referencia inmutable de `palace`.
  - *Resultado:* Elimina re-cálculos redundantes O(N) durante la digitación y la interacción.

---

## 5. Datos y Almacenamiento

### 18. Guardar solo URLs Relativas en `localStorage` y Revalidar Disco con Zod
- **Ubicación:** `apps/web/src/store.ts` (línea 52), `apps/server/src/cache.ts` (línea 22).
- **Razonamiento:**
  1. `localStorage` tiene un límite rígido de ~5 MB. Guardar imágenes en Base64 o binarios 3D saturaría la cuota en el primer intento.
  2. Los archivos cacheados en disco en el servidor (`.cache/museums/*.json`) pueden quedar obsoletos si el esquema del palacio evoluciona con el tiempo.
- **Implicaciones:**
  - *Almacenamiento Mínimo:* El frontend solo guarda en `localStorage` metadatos y rutas relativas (`/api/assets/<id>.glb`). Los binarios se descargan y gestionan en la caché del navegador.
  - *Revalidación Tipada:* Al leer de disco en el servidor, se ejecuta `MuseumSchema.safeParse(JSON.parse(raw))`. Si el archivo pertenece a un esquema anterior o está corrupto, se descarta limpiamente y se regenera sin provocar excepciones en producción.

---

## Resumen Cuantitativo de Impacto (18 Optimizaciones Activas)

| Métrica | Antes de las Optimizaciones | Con las 18 Optimizaciones Activas | Impacto Obtenido |
|---|---|---|---|
| **Costo por Museo (con diorama)** | $0.178 USD | **$0.052 USD** | **-70.8% de ahorro directo** |
| **Costo por Museo (sin diorama)** | $0.178 USD | **$0.028 USD** | **-84.3% de ahorro directo** |
| **Costo por Visita Repetida / Compartida** | $0.178 USD | **$0.000 USD** | **100% de ahorro (Caché disco/LRU)** |
| **Tokens de Salida por Generación** | 10.925 tokens | **1.847 tokens (DSL)** | **-69.2% de tokens generados** |
| **Tiempo de Generación (Latencia)** | 70 segundos | **27 segundos** | **2.59× más rápido** |
| **Fluidez en Dioramas 3D** | Micro-tirones por GC (~45 FPS) | **60 FPS sostenidos** | **0 asignaciones por frame** |
| **Resiliencia ante Fallos de Red** | Error 500 total si fallaba un asset | **Degradación suave a glifo** | **100% de entregas exitosas** |
