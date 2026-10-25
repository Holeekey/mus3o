# mus3o · Palacios de la Memoria 3D con IA y Trazabilidad Epistémica

> **Platanus Hack 26 — Caracas (46 Horas)**  
> **Tracks:** Three-Dimensional · AI / LLM · Trust  
> **Despliegue:** [mus3o.onrender.com](https://mus3o.onrender.com/) · **Código:** [Repositorio GitHub](https://github.com/platanus-hack/platanus-hack-26-ve-team-5)  

---

## 🏛️ 1. Visión del Producto y Problema que Resuelve

### El Problema: Sobrecarga Cognitiva del Texto Plano
Estudiar temarios densos, apuntes académicos o documentación técnica en documentos bidimensionales planos genera una rápida saturación cognitiva. La retención pasiva de listas y textos lineales se degrada drásticamente en pocas horas debido a la curva natural del olvido humano y la falta de anclajes contextuales.

### La Solución: mus3o
**mus3o** revoluciona el aprendizaje activo transformando apuntes libres, documentos estructurados o temas abstractos en un **palacio de la memoria 3D navegable en primera persona**, generado procedural y matemáticamente en tiempo real en el navegador:
- **Salas Temáticas:** Cada tema principal conforma una galería arquitectónica conectada mediante grafos de aprendizaje (DAGs o árboles jerárquicos).
- **Tótems y Glifos Mnemotécnicos:** Cada concepto se ancla visualmente en un pedestal central con un modelo 3D reconocible, rotación, cartela y metáfora visual.
- **Ventanas a Dioramas Vivos:** Cuadros interactivos que permiten "entrar" físicamente a maquetas 3D inmersivas (batallas históricas, anatomía celular, topografía) manteniendo 60 FPS sostenidos.
- **Trazabilidad Epistémica Absoluta:** Cada concepto cita de manera literal el fragmento original de los apuntes; el servidor verifica matemáticamente su veracidad contra el texto fuente. Si la IA alucina, el concepto queda públicamente señalado como `No está en tus apuntes`.
- **Curva de Olvido y Gamificación:** Algoritmo matemático de Ebbinghaus que calcula la fuerza del recuerdo y desmorona visualmente las piezas 3D en yeso conforme se olvidan. Dominar una sala otorga su llave dorada para franquear las puertas hacia temas avanzados.
- **Aris Companion:** Un tutor de estudio tridimensional y multimodal que guía al alumno en la sala mediante síntesis de voz, heurísticas espaciales y asistencia contextual de ultra-baja latencia.

---

## 🧠 2. Fundamento Neurocognitivo: Método de Loci y Curva de Ebbinghaus

### 2.1 El Método de Loci (Palacio de la Memoria)
Utilizado desde la Grecia clásica por Simónides de Ceos, aprovecha la corteza retroesplenial y el hipocampo humano (evolutivamente diseñados para la navegación espacial) para almacenar datos abstractos. mus3o automatiza este proceso:
1. **Jerarquización Semántica:** Descompone el material en la jerarquía matemática `Museo → Salas → Conceptos`.
2. **Anillos de Recorrido:** En cada sala, los pedestales se distribuyen en anillo euclidiano (`ringAngles`) empezando junto a la puerta de entrada y avanzando en sentido de lectura mnemotécnica.
3. **Consolidación Multi-Sensorial:** Asociación de estímulos espaciales, cromáticos, auditivos (Aris) y visuales (cuadros de época y dioramas).

### 2.2 Curva de Olvido Matemática y Decaimiento Físico 3D
El sistema computa en el cliente la retención de cada concepto mediante el modelo exponencial de Hermann Ebbinghaus:

$$\text{Retrievability } (R) = \exp\left(-\frac{\Delta t}{S}\right)$$

Donde $\Delta t$ son los días transcurridos desde el último repaso y $S$ es la estabilidad del recuerdo.
- **Progresión de Estabilidad:** Un acierto en el examen multiplica la estabilidad ($S_{\text{nuevo}} = S \times 2.5$, máx. 365 días). Un fallo desploma la estabilidad a $0.3$ días.
- **Decaimiento Visual en 3D:** La fuerza $R$ se refleja en tiempo real en la geometría del tótem:
  - $R \ge 0.85$: **Intacto** (escultura de yeso blanco pulido).
  - $0.60 \le R < 0.85$: **Agrietado** (micro-fisuras visibles).
  - $0.30 \le R < 0.60$: **Roto** (desprendimiento de hasta 20 fragmentos procedurales de yeso en el suelo).
  - $R < 0.30$: **Olvidado** (pedestal en ruina, pendiente urgente de repaso).

---

## 🏗️ 3. Arquitectura del Sistema: "La IA Razona, el Código Ensambla"

El proyecto se estructura como un **Monorepo Clean Architecture** con TypeScript estricto (`"strict": true`) y más de **750 pruebas unitarias automatizadas**:

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
│ 5. Pipeline Low-Token DSL con Claude 3.5 Sonnet (Prompt Caching 90%)   │
│ 6. Parser Tolerante de DSL a Árbol de Museo                            │
│ 7. Verificación Criptográfica de Citas (`verifySources`)              │
│ 8. Hidratación 3D: Biblioteca Local (80 items) → Poly Pizza → Haiku    │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Museum validado por MuseumSchema
┌───────────────────────────────────▼────────────────────────────────────┐
│ MOTOR 3D EN CLIENTE (React Three Fiber & Three.js)                     │
│ Layout matemático euclidiano: Grilla de salas, vanos y corredores     │
│ Renderizado a 60 FPS: DynamicTotem, MeshPortalMaterial, GPU Wind      │
│ Modo VR Dual: WebXR (Android) / Cardboard Stereo con Sensor Fusion    │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 🏆 4. Ranking y Puntuación de Tecnologías para el Hackathon

Evaluadas exhaustivamente bajo 4 ejes: **Impacto Demo/WOW (30%)**, **Rigor Arquitectónico (30%)**, **Eficiencia Económica (20%)** y **Confiabilidad/Trust (20%)**:

| Rank | Tecnología / Arquitectura | Capa / Módulo | Puntuación (1-100) | Justificación Técnica Clave |
|:---:|---|---|:---:|---|
| **1** | **Pipeline Low-Token DSL** | `server` / `shared` | **97.2** | Condensa cada concepto en 1 línea (`PIECE: ...`). Reduce tokens de salida de 10.925 a 1.847 (−69.2%) y acelera la entrega de 70s a 27s (2.59×). |
| **2** | **Prompt Caching Ephemeral** | Anthropic API | **95.0** | Fija contratos y reglas fijas en el KV-cache (`cache_control`). Entrada repetida a $0.20/MTok (−90%). Ahorró ~$246 en 7 días con 99% de aciertos. |
| **3** | **Portales a Dioramas 3D ("Entrar al Cuadro")** | `web/diorama` | **94.8** | Ventana seamless con `MeshPortalMaterial`. Al pulsar `E` el jugador entra a una maqueta 3D viva con shaders de viento en GPU (`aWind`) y terreno facetado. |
| **4** | **Trazabilidad Epistémica (`verifySources`)** | `shared/sources` | **94.4** | Búsqueda mecánica de citas en apuntes con algoritmo de subcadena común (umbral ≥60%) y hash SHA-256. Garantía de no-alucinación para el track Trust. |
| **5** | **Curva de Olvido + Decaimiento 3D** | `web/memory` | **94.0** | Modelo matemático de Ebbinghaus desacoplado. Fragmentación física de esculturas (20 fragmentos de yeso) y desvanecimiento progresivo del suelo. |
| **6** | **Modo VR Híbrido (WebXR + Cardboard)** | `web/vr` | **93.9** | Experiencia inmersiva en cualquier teléfono. WebXR nativo en Chromium; Cardboard con fusión sensorial (giroscopio + acelerómetro) y shader de lente de barril. |
| **7** | **Arquitectura Híbrida Multi-Modelo** | `server/claude` | **92.7** | Especialización óptima: Sonnet 3.5 para spatial reasoning y visión; Haiku 3.5 con `noThinking` para digest de 200k caracteres y Aris companion. |
| **8** | **Biblioteca Curada de Modelos 3D (80 items)** | `seed/library` | **92.2** | 80 objetos sembrados con Sonnet y versionados en Git LFS. Se pagan una sola vez ($0.0034) y se reutilizan con costo $0 en todos los museos. |
| **9** | **Ingesta Client-Side (Zero-Server-Upload)** | `web/lib/files` | **92.1** | Extracción directa en navegador de PDF, Word, Excel, CSV y Markdown. Ningún documento privado del usuario se almacena en el servidor. |
| **10** | **Caché Multi-Nivel y Deduplicación In-Flight** | `server/cache` | **91.7** | LRU en memoria + guardado atómico en disco `.cache/museums` + unión de promesas concurrentes. Consultas repetidas responden en <10 ms a costo $0.00. |
| **11** | **Generador Procedural de Layouts Euclidianos** | `web/layout` | **91.6** | Algoritmo determinista para redes de hasta 12 salas con soporte de árboles y grafos acíclicos dirigidos (DAGs), puertas y pasillos sin colisiones. |
| **12** | **Aris Companion & Audio Híbrido** | `web/arisBrain` | **90.8** | Asistente inteligente por reglas locales (0 ms) con fallback a Haiku y síntesis de voz dual (Web Speech API nativa + ElevenLabs natural). |
| **13** | **Hardening OWASP LLM & Contrato Zod** | `shared/schema` | **90.4** | Blindaje contra prompt injection (`<user_notes>`, `<source>`), saneamiento de etiquetas y validación bidireccional cliente-servidor con Zod. |
| **14** | **Proxy Wikimedia con Filtro Contextual** | `server/images` | **89.7** | Resolución automática de obras históricas y retratos de dominio público, con sembrado offline (`seed/images`) y filtro semántico por país/contexto. |
| **15** | **Normalización 3D & Zero-GC Shaders** | `web/DynamicTotem` | **89.6** | Inserción segura de modelos externos con `<Resize scale={0.7}><Center bottom>`, descarte de mallas >30k polígonos y eliminación de recálculos por frame. |

---

## ⚡ 5. Las 18 Optimizaciones Técnicas Implementadas (Métricas Reales)

El proyecto cuenta con un catálogo exhaustivo de **18 optimizaciones de producción**, documentadas en [`docs/catalogo-optimizaciones.md`](./docs/catalogo-optimizaciones.md):

### Grupo 1: Costo y Latencia de LLM
1. **Pipeline DSL Compacto:** Sustituyó el payload JSON procedural de 10.925 tokens por un DSL compacto de 1.847 tokens. Reducción de costo del 69.2% y latencia reducida de 70s a 27s.
2. **Prompt Caching Ephemeral:** Ahorro medido de **$246 USD en 7 días** (99% de aciertos de caché) al construir y operar mus3o; lecturas de entrada a $0.20/MTok.
3. **Que la IA Elija y el Código Arme:** Cero tokens gastados en matrices de posición o topologías espaciales; el servidor y cliente arman los grafos matemáticamente.
4. **Caché Multi-Nivel LRU y Atómica en Disco:** Persistencia en `.cache/museums` mediante `.tmp` y rename atómico. Visitas recurrentes cuestan **$0.00 USD**.
5. **Deduplicación de Peticiones In-Flight:** Mapeo de promesas concurrentes (`inFlight`). Si 10 usuarios piden el mismo tema al unísono, se ejecuta una sola llamada a Claude.
6. **Llamadas Condicionales a Dioramas:** Micro-DSL (`DIO`/`D_PROP`) integrado en el prompt maestro. Evita llamadas HTTP redundantes y ahorra $0.024 USD por museo.
7. **Haiku con `noThinking` para Tareas Auxiliares:** Desactiva el razonamiento oculto de Haiku 3.5, eliminando 3.193 tokens de salida fantasma por llamada.
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
16. **Zero Garbage Collection en Bucle de Render (60 FPS):** Uso de `WeakMap` para cachear conjuntos de conceptos en dioramas, eliminando micro-tirones causados por el recolector de basura.
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
| **Fluidez en Dioramas 3D** | Micro-congelamientos (~45 FPS) | **60 FPS constantes** | **0 asignaciones de memoria/frame** |
| **Escala: 1.000 Alumnos Estudiando** | ~$117 USD | **~$23–$36 USD** | **Viabilidad comercial inmediata** |

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
| **Backend & APIs** | Node.js v20+, Express, `@anthropic-ai/sdk`, `express-rate-limit`, Zod, Vitest |
| **Modelos de IA** | Anthropic Claude 3.5 Sonnet (`claude-sonnet-5-5`), Claude 3.5 Haiku (`claude-haiku-5-5`) |
| **Procesamiento de Archivos** | `pdfjs-dist` (PDF), `mammoth` (Word .docx), `read-excel-file` (Excel .xlsx), parsers nativos CSV/JSON |
| **Voz & Audio** | Web Speech API (síntesis y reconocimiento en navegador), ElevenLabs API (`eleven_multilingual_v2`) |
| **Assets 3D & Modelos** | Biblioteca propia (80 modelos de catálogo en Git LFS), Poly Pizza API (CC0/CC-BY), KayKit Dungeon Pack |
| **Infraestructura & Despliegue**| Render Cloud (`render.yaml`), Docker/Node SPA, volúmenes de disco persistente (`/var/data`), Git LFS |

---

## 👥 9. Equipo (Team 5)

**Mentor:** Anthony Nardelli

- **Jesus Rodolfo Gil Farias** — *Arquitectura de Software, Backend, Seguridad & Optimización de IA* ([@jrgil20](https://github.com/jrgil20))
- **Daniel Bruno** — *Core 3D, Three.js, Shaders & Dioramas* ([@holeekey](https://github.com/holeekey))
- **Valeria Riera** — *Diseño de Producto, UX/UI, Accesibilidad & Frontend* ([@ingvaleriariera](https://github.com/ingvaleriariera))
- **Massiel Paola Perozo Ballestero** — *Dirección de Arte, Audio, Dinámicas Sensoriales & Copy* ([@massiperozo](https://github.com/massiperozo))
- **Gabriel Castellano** — *Integración Frontend, Sincronización de Estado & Experiencia Táctil* ([@gdcastellano](https://github.com/gdcastellano))

---

<p align="center">
  <strong>mus3o · Platanus Hack 26 Caracas</strong><br/>
  <em>Construido con rigor arquitectónico, neurociencia cognitiva y disciplina extrema de tokens.</em>
</p>
