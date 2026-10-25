# mus3o · Palacios de la Memoria 3D con IA y citas verificadas

> **Platanus Hack 26 — Caracas (46 horas)**  
> **Track:** 🧊 Three-Dimensional  
> **Despliegue:** [mus3o.onrender.com](https://mus3o.onrender.com/) · **Código:** [Repositorio GitHub](https://github.com/platanus-hack/platanus-hack-26-ve-team-5)  

---

## ▶️ Pruébalo en 60 segundos

1. Entra a [mus3o.onrender.com](https://mus3o.onrender.com/) desde un navegador de escritorio (Chrome o Edge).
2. **Sin esperar a la IA:** elige uno de los museos listos (Biología Celular, Imperio Romano o Arquitectura de Computadores) y entra con un clic.
3. Muévete con **WASD** y el mouse. Acércate a un pedestal y pulsa **E** para examinar la pieza, **M** para marcarla como memorizada, **T** para hablar con Aris y **N** para el narrador.
4. Busca el cuadro principal de la sala y pulsa **E** frente a él: entras al diorama 3D.
5. **Con tus apuntes:** vuelve al inicio, pega tu texto o adjunta un PDF, Word, Excel o CSV y pulsa **Generar con Aris**. Verás el museo construirse en vivo; cada concepto trae la cita de tus apuntes y una marca si no se encontró en ellos. Si prefieres no usar IA, **Construir offline** arma el museo con un parser local.
6. Opcional, en el teléfono: el modo VR funciona con WebXR o con un Cardboard.

---

## 🏛️ 1. Visión del Producto y Problema que Resuelve

### El Problema: Sobrecarga Cognitiva del Texto Plano
Estudiar temarios densos, apuntes académicos o documentación técnica en documentos bidimensionales planos genera una rápida saturación cognitiva. La retención pasiva de listas y textos lineales se degrada drásticamente en pocas horas debido a la curva natural del olvido humano y la falta de anclajes contextuales.

### La Solución: mus3o
**mus3o** convierte apuntes libres, documentos estructurados o un tema en un **palacio de la memoria 3D navegable en primera persona**, generado proceduralmente en el navegador:
- **Salas Temáticas:** Cada tema principal conforma una galería arquitectónica conectada mediante grafos de aprendizaje (DAGs o árboles jerárquicos).
- **Tótems y Glifos Mnemotécnicos:** Cada concepto se ancla visualmente en un pedestal central con un modelo 3D reconocible, rotación, cartela y metáfora visual.
- **Ventanas a Dioramas Vivos:** Cuadros interactivos que permiten "entrar" a maquetas 3D (batallas históricas, anatomía celular, topografía).
- **Citas verificadas:** Cada concepto cita el fragmento original de los apuntes y el servidor comprueba que esa cita exista de verdad en el texto fuente. Si la IA inventó algo, el concepto queda señalado como `No está en tus apuntes`.
- **Curva de Olvido y Gamificación:** Un modelo de olvido (Ebbinghaus) calcula la fuerza del recuerdo y desmorona visualmente las piezas 3D en yeso conforme se olvidan. Dominar una sala otorga su llave para abrir las puertas hacia temas avanzados.
- **Aris Companion:** Un compañero de estudio 3D que guía al alumno en la sala con voz, reglas locales (responde al instante, sin red) y, cuando hace falta, Claude.

---

## 🧠 2. Fundamento Neurocognitivo: Método de Loci y Curva de Ebbinghaus

### 2.1 El Método de Loci (Palacio de la Memoria)
Utilizado desde la Grecia clásica por Simónides de Ceos, aprovecha la corteza retroesplenial y el hipocampo humano (evolutivamente diseñados para la navegación espacial) para almacenar datos abstractos. mus3o automatiza este proceso:
1. **Jerarquización Semántica:** Descompone el material en la jerarquía matemática `Museo → Salas → Conceptos`.
2. **Anillos de Recorrido:** En cada sala, los pedestales se distribuyen en anillo euclidiano (`ringAngles`) empezando junto a la puerta de entrada y avanzando en sentido de lectura mnemotécnica.
3. **Consolidación Multi-Sensorial:** Asociación de estímulos espaciales, cromáticos, auditivos (Aris) y visuales (cuadros de época y dioramas).

### 2.2 Curva de Olvido Matemática y Decaimiento Físico 3D
El cliente calcula la retención de cada concepto con el modelo exponencial de Hermann Ebbinghaus:

```
R = e^(−Δt / S)
```

Donde `Δt` son los días transcurridos desde el último repaso y `S` es la estabilidad del recuerdo.
- **Progresión de estabilidad:** Un acierto en el examen multiplica la estabilidad (`S × 2.5`, máx. 365 días). Un fallo la desploma a `0.3` días.
- **Decaimiento visual en 3D:** La fuerza `R` se refleja en la geometría del tótem:
  - `R ≥ 0.85`: **Intacto** (escultura de yeso blanco).
  - `0.60 ≤ R < 0.85`: **Agrietado** (fisuras visibles).
  - `0.30 ≤ R < 0.60`: **Roto** (hasta 20 fragmentos de yeso en el suelo).
  - `R < 0.30`: **Olvidado** (pedestal en ruina, repaso urgente).

---

## 🏗️ 3. Arquitectura del Sistema: "La IA Razona, el Código Ensambla"

El proyecto es un **monorepo** con TypeScript estricto (`"strict": true`) y más de **750 pruebas unitarias automatizadas** (Vitest) sobre el contrato, el servidor y la lógica del cliente:

```
platanus-hack-26-ve-team-5/
├── apps/
│   ├── web/            # Frontend SPA: Vite, React 18, React Three Fiber, Zustand, Tailwind
│   └── server/         # API REST & Streaming: Express, Claude SDK, Zod, Proxy de medios
├── packages/
│   ├── shared/         # Contrato universal tipado: esquemas Zod, verificación de citas, límites
│   └── dungeon-core/   # Motor de navegación procedural para mazmorras adaptadas
└── dev-ai-toolkit/     # Herramientas de soporte y skills del equipo
```

### Pipeline de Datos de Extremo a Extremo

```
┌────────────────────────────────────────────────────────────────────────┐
│ NAVEGADOR (Client-Side Privacy-First)                                  │
│ Ingesta local de archivos (PDF, DOCX, XLSX, CSV, JSON, TXT, Imágenes)  │
│ Extracción de texto puro en navegador (pdfjs-dist, mammoth, excel)    │
│ Truncamiento y delimitación: <user_notes>                              │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ POST /api/generate-museum (JSON ≤ 8 MB)
┌───────────────────────────────────▼────────────────────────────────────┐
│ SERVIDOR EXPRESS (Bajo Costo & Resiliencia)                            │
│ 1. Rate Limiting por IP (10 req/min) & Exclusión de Health Checks      │
│ 2. Deduplicación In-Flight (Promesas compartidas en paralelo)         │
│ 3. Verificación de Caché de Disco (Atomic .tmp rename)                 │
│ 4. Control de Presupuesto Diario (Tope: 200 generaciones/día)          │
│ 5. Pipeline Low-Token DSL con Claude Sonnet 5.5 (Prompt Caching)      │
│ 6. Parser Tolerante de DSL a Árbol de Museo                            │
│ 7. Verificación de Citas contra los apuntes (`verifySources`)          │
│ 8. Hidratación 3D: Biblioteca Local (80 items) → Poly Pizza → Haiku    │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Museum validado por MuseumSchema
┌───────────────────────────────────▼────────────────────────────────────┐
│ MOTOR 3D EN CLIENTE (React Three Fiber & Three.js)                     │
│ Layout matemático euclidiano: Grilla de salas, vanos y corredores     │
│ Render: DynamicTotem, MeshPortalMaterial, viento en GPU                │
│ Modo VR Dual: WebXR (Android) / Cardboard Stereo con Sensor Fusion    │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 🧩 4. Qué hay detrás (y no es el LLM)

La IA solo elige conceptos, metáforas y citas. Todo lo demás es código nuestro, probado y medible:

| # | Pieza de ingeniería | Capa / Módulo | Qué hace |
|:---:|---|---|---|
| 1 | **Pipeline Low-Token DSL** | `server` / `shared` | Condensa cada concepto en 1 línea (`PIECE: ...`). Reduce tokens de salida de 10.925 a 1.847 (−69 %) y la entrega de 70 s a 27 s (2,6×), medido con IA real. |
| 2 | **Prompt Caching** | Anthropic API | Las reglas y el contrato fijos van en `cache_control`; la entrada repetida cuesta ~10 % del precio de lista. En nuestras mediciones durante el desarrollo, el 99 % de las lecturas pegó en caché. |
| 3 | **Portales a Dioramas 3D ("Entrar al Cuadro")** | `web/diorama` | Ventana con `MeshPortalMaterial`. Al pulsar `E` el jugador entra a una maqueta 3D con viento en GPU (`aWind`) y terreno facetado. |
| 4 | **Verificación de citas (`verifySources`)** | `shared/sources` | Busca cada cita en los apuntes (coincidencia exacta o subcadena común ≥ 60 %). Lo que no aparece se marca `unverified`: la alucinación no se oculta, se señala. |
| 5 | **Curva de olvido + decaimiento 3D** | `web/memory` | Modelo de Ebbinghaus desacoplado del render. Fragmentación de esculturas (20 fragmentos de yeso) y desvanecimiento del suelo según la fuerza del recuerdo. |
| 6 | **Modo VR híbrido (WebXR + Cardboard)** | `web/vr` | WebXR en Chromium Android; Cardboard con fusión de giroscopio y acelerómetro, shader de lente de barril y panel de calibración. |
| 7 | **Dos modelos, cada uno en lo suyo** | `server/claude` | Sonnet 5.5 para la estructura del museo y la visión de los cuadros; Haiku 5.5 sin razonamiento extendido para resumir fuentes largas y ayudar a Aris. |
| 8 | **Biblioteca curada de modelos 3D (80 ítems)** | `seed/library` | 80 objetos sembrados una sola vez con Sonnet y versionados en Git LFS. Se reutilizan a costo $0 en todos los museos. |
| 9 | **Ingesta en el navegador** | `web/lib/files` | PDF, Word, Excel, CSV y Markdown se extraen en el cliente (`pdfjs-dist`, `mammoth`, `read-excel-file`). Al servidor solo viaja texto; nada se guarda. |
| 10 | **Caché multinivel y deduplicación in-flight** | `server/cache` | LRU en memoria + escritura atómica en disco + unión de promesas concurrentes. Repetir un tema responde en < 10 ms y cuesta $0. |
| 11 | **Layout procedural determinista** | `web/layout` | Hasta 12 salas en árbol o DAG, con puertas y pasillos sin colisiones. Cero tokens gastados en posiciones. |
| 12 | **Aris: reglas locales + voz** | `web/arisBrain` | Responde por reglas al instante, consulta a Haiku solo cuando no sabe, y habla con Web Speech API (ElevenLabs opcional). Guía con A* hacia la sala que toca repasar. |
| 13 | **Contrato Zod y aislamiento de prompts** | `shared/schema` | Apuntes encerrados en `<user_notes>` con delimitadores saneados; validación del JSON de la IA y del `localStorage` en ambos extremos. |
| 14 | **Proxy Wikimedia con filtro contextual** | `server/images` | Obras y retratos de dominio público con lista blanca de hosts, reintentos, caché y filtro por país/contexto. |
| 15 | **Normalización 3D y render sin basura** | `web/DynamicTotem` | Modelos externos ajustados con `<Resize><Center bottom>`, descarte de mallas > 30 k triángulos y `WeakMap` para no recalcular por frame. |

---

## ⚡ 5. Las 18 Optimizaciones Técnicas Implementadas (Métricas Reales)

El proyecto cuenta con un catálogo exhaustivo de **18 optimizaciones de producción**, documentadas en [`docs/catalogo-optimizaciones.md`](./docs/catalogo-optimizaciones.md):

### Grupo 1: Costo y Latencia de LLM
1. **Pipeline DSL Compacto:** Sustituyó el payload JSON procedural de 10.925 tokens por un DSL compacto de 1.847 tokens. Reducción de costo del 69.2% y latencia reducida de 70s a 27s.
2. **Prompt Caching:** El contrato y las reglas fijas se marcan con `cache_control`, así la entrada repetida cuesta ~10 % del precio de lista. En nuestras mediciones durante el desarrollo, el 99 % de las lecturas pegó en caché.
3. **Que la IA Elija y el Código Arme:** Cero tokens gastados en matrices de posición o topologías espaciales; el servidor y cliente arman los grafos matemáticamente.
4. **Caché Multi-Nivel LRU y Atómica en Disco:** Persistencia en `.cache/museums` mediante `.tmp` y rename atómico. Visitas recurrentes cuestan **$0.00 USD**.
5. **Deduplicación de Peticiones In-Flight:** Mapeo de promesas concurrentes (`inFlight`). Si 10 usuarios piden el mismo tema al unísono, se ejecuta una sola llamada a Claude.
6. **Llamadas Condicionales a Dioramas:** Micro-DSL (`DIO`/`D_PROP`) integrado en el prompt maestro. Evita llamadas HTTP redundantes y ahorra $0.024 USD por museo.
7. **Haiku sin razonamiento extendido para tareas auxiliares:** Desactiva el `thinking` de Haiku 5.5, eliminando hasta 3.193 tokens de salida ocultos por llamada.
8. **Ajuste Dinámico de `max_tokens`:** Rango dinámico calibrado (2.000 a 5.000 tokens) según el volumen de caracteres de entrada.
9. **Telemetría de Tokens en Crudo:** Registro estructurado de `entrada`, `salida`, `caché leída` y `caché escrita`, protegiendo la privacidad de los apuntes.

### Grupo 2: Red, APIs Externas y Resiliencia
10. **Timeouts y AbortController Estrictos:** Timeout de 2.500 ms para Poly Pizza y 20s para fallbacks, cancelando sockets colgados en Node.js.
11. **Circuit Breaker ante Bloqueo de Host:** Al detectar bloqueos o desafíos anti-bot (Cloudflare 403), el sistema pausa consultas por 10 minutos y sirve glifos inmediatos.
12. **Paralelismo con `Promise.allSettled`:** 18 descargas concurrentes de modelos 3D; si uno falla, no aborta el museo, sino que degrada suavemente a glifo.
13. **Caché HTTP `immutable` para Assets 3D:** Cabecera `Cache-Control: public, max-age=31536000, immutable` para binarios `.glb`. Red cero en visitas posteriores.
14. **Tope Diario y Rate Limiting:** Límite de 10 req/min por IP y tope diario duro de 200 generaciones (`MAX_DAILY_GENERATIONS`) que protege el presupuesto ante bots.

### Grupo 3: Renderizado 3D y Frontend WebGL
15. **Normalización Automática 3D y Límite de Triángulos:** Filtro de modelos con más de 30.000 triángulos y ajuste con `<Resize scale={0.7}><Center bottom>`. `ModelBoundary` aísla fallos de Three.js.
16. **Sin basura en el bucle de render:** `WeakMap` para cachear conjuntos de conceptos en dioramas, eliminando asignaciones por frame y los micro-tirones del recolector de basura.
17. **Memoización Reactiva en HUD y Formulario:** Memoización con `useMemo` de las listas de IDs y llamadas de olvido, previniendo recálculos $O(N)$ al tipear en el editor.
18. **Almacenamiento Local de URLs Relativas y Revalidación Zod:** Guardado ligero en `localStorage` (evitando Base64) y validación defensiva con `MuseumSchema.safeParse` al leer disco.

---

## 📊 6. Tabla Comparativa de Rendimiento y Costos

| Métrica | Enfoque Convencional (JSON Monolítico) | mus3o Optimizado (DSL + Caching) | Impacto Obtenido |
|---|:---:|:---:|:---:|
| **Costo por Museo (con diorama)** | $0.178 USD | **$0.036 USD** | **−79.7% de ahorro** |
| **Costo por Museo (sin diorama)** | $0.117 USD | **$0.019 USD** | **−83.7% de ahorro** |
| **Costo de Visita Repetida o Compartida** | $0.178 USD | **$0.000 USD** | **100% gratis (Caché disco/LRU)** |
| **Tokens de Salida por Generación** | 10.925 tokens | **1.847 tokens** | **−69.2% de tokens generados** |
| **Latencia de Entrega** | 70 segundos | **27 segundos** | **2.59× más rápido** |
| **Trabajo repetido por frame en dioramas** | Recalcular el conjunto de conceptos cada frame | **Cacheado en `WeakMap`** | **0 asignaciones por frame** |
| **Escala: 1.000 alumnos generando un museo** | ~$117 USD | **~$19–$36 USD** | **Cabe en el presupuesto de un aula** |

---

## 🛡️ 7. Seguridad, Confianza y Hardening (Track Trust)

1. **Aislamiento Estricto de Prompts (OWASP LLM01):** Todo apunte de usuario se encierra en `<user_notes>` y delimitadores XML saneados recursivamente con `stripDelimiters`. El system prompt instruye tratar el texto exclusivamente como datos pasivos.
2. **Procesamiento Volátil Efímero:** Los apuntes jamás se escriben en disco ni en bases de datos en el servidor; la clave de caché es un hash unidireccional SHA-256.
3. **Auditoría Epistémica en Vivo:** El alumno y los evaluadores pueden contrastar cualquier concepto con la fuente original mediante el botón "Ver cita en apuntes". Si la IA inventó el concepto, el sistema no lo oculta: lo etiqueta en rojo como `unverified`.
4. **Defensa de Red:** Cabeceras HTTP `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, y proxy de imágenes restringido exclusivamente a dominios oficiales de Wikimedia.

---

## 🧰 8. Stack Tecnológico

| Capa | Tecnologías |
|---|---|
| **Frontend & UI** | React 18, Vite, TypeScript, Zustand (con persistencia separada), Tailwind CSS, Lucide Icons |
| **Motor 3D & WebGL** | Three.js, React Three Fiber (`@react-three/fiber`), `@react-three/drei`, shaders GLSL procedurales |
| **Realidad Virtual (XR)** | WebXR (`@react-three/xr`), Cardboard dual stereo camera, sensor fusion (`devicemotion`), lens distortion shader |
| **Backend & APIs** | Node.js 22, Express, `@anthropic-ai/sdk`, `express-rate-limit`, Zod, Vitest |
| **Modelos de IA** | Claude Sonnet 5.5 (`claude-sonnet-5-5`) y Claude Haiku 5.5 (`claude-haiku-5-5`) |
| **Procesamiento de Archivos** | `pdfjs-dist` (PDF), `mammoth` (Word .docx), `read-excel-file` (Excel .xlsx), parsers nativos CSV/JSON |
| **Voz & Audio** | Web Speech API (síntesis y reconocimiento en navegador), ElevenLabs API (`eleven_multilingual_v2`) |
| **Assets 3D & Modelos** | Biblioteca propia (80 modelos de catálogo en Git LFS), Poly Pizza API (CC0/CC-BY), KayKit Dungeon Pack |
| **Infraestructura & Despliegue**| Render (`render.yaml`, plan Starter sin arranques en frío), servidor Node que sirve la SPA y la API, caché en disco local del servicio, Git LFS para los assets |

---

## 👥 9. Equipo (Team 5)

**Mentor:** Anthony Nardelli

- **Jesus Rodolfo Gil Farias** — *Backend, seguridad y costo de IA* ([@jrgil20](https://github.com/jrgil20))
- **Daniel Bruno** — *Motor 3D, shaders y dioramas* ([@holeekey](https://github.com/holeekey))
- **Valeria Riera** — *Producto, UX/UI y frontend* ([@ingvaleriariera](https://github.com/ingvaleriariera))
- **Massiel Paola Perozo Ballestero** — *Dirección de arte, audio y textos* ([@massiperozo](https://github.com/massiperozo))
- **Gabriel Castellano** — *Integración frontend y estado* ([@gdcastellano](https://github.com/gdcastellano))

---

<p align="center">
  <strong>mus3o · Platanus Hack 26 Caracas</strong><br/>
  <em>Un lugar que recuerda contigo.</em>
</p>
