# mus3o · team-5

![Track](https://img.shields.io/badge/Track-Three--Dimensional-orange?style=for-the-badge) ![Hackathon](https://img.shields.io/badge/Platanus%20Hack%2026-Caracas%2046h-blueviolet?style=for-the-badge) ![React](https://img.shields.io/badge/React%20Three%20Fiber-3D-blue?style=for-the-badge) ![Anthropic](https://img.shields.io/badge/Anthropic-Claude%203.5-black?style=for-the-badge)

<p align="center">
  <img src="./project-logo.png" alt="Logo de mus3o" width="220" />
</p>

<p align="center">
  <strong>Transforma apuntes de estudio y temas complejos en palacios de la memoria 3D explorables en primera persona.</strong><br/>
  Basado en el método de Loci, modelos 3D dinámicos, dioramas inmersivos y repaso espaciado con validación criptográfica y estricta disciplina de costos.
</p>

---

## 🏛️ Qué es mus3o

**mus3o** revoluciona el aprendizaje activo convirtiendo texto plano en una experiencia tridimensional inmersiva:
- **Salas Temáticas y Totems 3D:** Cada tema genera una sala arquitectónica conectada mediante grafos de prerrequisitos (DAG), con pedestales y modelos 3D que anclan visualmente cada concepto.
- **Ventanas a Dioramas:** Cuadros interactivos que permiten "entrar" a maquetas 3D vivas (con terreno procedural, atmósfera y personajes) para consolidar recuerdos de eventos históricos, geográficos y biológicos.
- **Curva de Olvido y Examen:** Algoritmo mnemotécnico que calcula qué conceptos requieren repaso. Al dominar una sala, desbloqueas su llave dorada para abrir las puertas hacia salas avanzadas.
- **Aris (Guía Inteligente):** Un asistente de estudio que te acompaña en el recorrido, orientándote mediante síntesis de voz y respuestas contextuales ultra-rápidas.
- **Trazabilidad Epistémica:** Cada concepto cita directamente el fragmento exacto de los apuntes originales; el servidor valida mecánicamente su veracidad contra el texto fuente.

---

## ⚡ Arquitectura de Alto Rendimiento y Control de Costos

Diseñado bajo el principio de que **la IA razona y el código ensambla**, mus3o implementa un pipeline optimizado que reduce el costo por museo en más de un **70%–84%**:

1. **Pipeline Low-Token DSL:** En lugar de generar JSON procedural masivo (~10.900 tokens), la IA produce un DSL compacto (~1.800 tokens) que el servidor traduce a geometría 3D y grafos sin fallas.
2. **Prompt Caching Ephemeral:** Instrucciones y contratos fijados en caché de Anthropic, reduciendo el 90% del costo en tokens de entrada recurrentes.
3. **Búsqueda e Hidratación 3D Externa:** Integración con Poly Pizza para descargar modelos `.glb` reales low-poly (0 tokens LLM). Solo los faltantes usan fallback económico con Claude 3.5 Haiku.
4. **Caché Multi-Nivel:** LRU en memoria y persistencia atómica en disco (`.cache/museums`) respaldada con validación Zod. Repeticiones y consultas concurrentes cuestan **$0.00 USD**.

> 📊 Al construir mus3o con un agente de código, la caché de prompts ahorró **~USD 246 en 7 días** (99 % de aciertos; gasto real USD 29 frente a ~USD 275). Consulta el desglose completo en el [Catálogo de Optimizaciones](./docs/catalogo-optimizaciones.md) y el [Reporte de Costos y Ahorro](./docs/reporte-costos-y-ahorros.md).

---

## 🚀 Inicio Rápido

### Requisitos
- **Node.js:** v20+
- **Gestor de paquetes:** `pnpm` (recomendado) o `npm`

### Instalación y Ejecución

```bash
# 1. Clona el repositorio y entra al directorio
git clone https://github.com/platanus-hack/platanus-hack-26-ve-team-5.git
cd platanus-hack-26-ve-team-5

# 2. Configura las variables de entorno
cp .env.example .env
# Añade tu ANTHROPIC_API_KEY (opcional: POLY_PIZZA_API_KEY)
# Sin API key: opera automáticamente con mocks interactivos y demos precargadas.

# 3. Instala dependencias y corre en desarrollo
pnpm install
pnpm run dev
```

La aplicación web estará disponible en `http://localhost:5173` y el servidor en `http://localhost:3001`.

### 🎮 Demos Rápidas (Parámetros de URL)

Puedes probar de inmediato palacios precargados y mecánicas avanzadas agregando parámetros a la URL:

| Parámetro | Experiencia |
|---|---|
| `?demo` | Museo de prueba general precargado |
| `?demo=historia` | Palacio histórico con diorama inmersivo ("Entrar al cuadro" con `E`) |
| `?demo=ia` | Museo técnico sobre conceptos y redes de Inteligencia Artificial |
| `?demo=medicina` | Recorrido anatómico y farmacológico |
| `?demo=dungeon` | Integración del generador procedural de mazmorras medievales |
| `?demo=compuesto` | Composición modular de dioramas por biblioteca |

---

## 📚 Documentación Técnica

Toda la especificación técnica vive en el directorio [`docs/`](./docs/README.md):

| Documento | Enfoque |
|---|---|
| [arquitectura.md](./docs/arquitectura.md) | Visión holística del monorepo, ciclo de datos y separación por capas |
| [catalogo-optimizaciones.md](./docs/catalogo-optimizaciones.md) | **18 optimizaciones activas implementadas** (LLM, red, WebGL/Three.js, frontend y almacenamiento) |
| [reporte-costos-y-ahorros.md](./docs/reporte-costos-y-ahorros.md) | Tarifas de Anthropic, métricas reales medidas y proyección de escala |
| [servidor.md](./docs/servidor.md) | Endpoints Express, DSL, rate limits, prompts, assets y deduplicación |
| [frontend.md](./docs/frontend.md) | React Three Fiber, Zustand, HUD, shaders y controles de cámara |
| [contrato-shared.md](./docs/contrato-shared.md) | Esquemas de datos universales validados con Zod (`@mus3o/shared`) |
| [memoria-y-examen.md](./docs/memoria-y-examen.md) | Mecánica de olvido espaciado, máquina del tiempo y llaves |
| [diorama.md](./docs/diorama.md) | Renderizado de maquetas 3D, atmósfera y shaders de viento |
| [seguridad.md](./docs/seguridad.md) | Políticas de privacidad efímera, aislamiento de prompts y mitigación DoS |
| [desarrollo.md](./docs/desarrollo.md) | Guía para colaboradores, convenciones de commit y testing |

---

## 👥 Equipo (Team 5)

**Mentor:** Anthony Nardelli

| Miembro | Rol / Enfoque | Perfil GitHub |
|---|---|---|
| **Daniel Bruno** | Core 3D, Three.js & Dioramas | [@holeekey](https://github.com/holeekey) |
| **Jesus Rodolfo Gil Farias** | Arquitectura, Backend & Optimización de IA | [@jrgil20](https://github.com/jrgil20) |
| **Valeria Riera** | UX/UI, Accesibilidad & Frontend | [@ingvaleriariera](https://github.com/ingvaleriariera) |
| **Massiel Paola Perozo Ballestero** | Diseño, Audio & Dinámicas Sensoriales | [@massiperozo](https://github.com/massiperozo) |
| **Gabriel Castellano** | Frontend, Integración de Estado & Audio | [@gdcastellano](https://github.com/gdcastellano) |

---

## 📍 Evento

- **Hackathon:** Platanus Hack 26: Caracas ft. Yummy Project
- **Duración:** 46 horas ininterrumpidas (23 al 25 de Octubre de 2026).
- **Lugar:** Edificio Centro Banaven (Cubo Negro), Torre A, piso 7, Caracas, Venezuela.

---

## 🎨 Assets y Atribución

- **KayKit Dungeon Asset Pack (1.1):** Creado por **Kay Lousberg** ([kaylousberg.com](https://www.kaylousberg.com)), bajo licencia [CC0](https://creativecommons.org/publicdomain/zero/1.0/).
- **Poly Pizza Assets:** Modelos 3D bajo licencias [CC0](https://creativecommons.org/publicdomain/zero/1.0/) y [CC-BY](https://creativecommons.org/licenses/by/3.0/) (con crédito automático en el HUD).
- **Git LFS:** Fuentes, texturas y modelos binarios gestionados bajo Git LFS. Detalle en [ASSETS.md](./ASSETS.md).

---

<p align="center">
  Construido con pasión, rigor arquitectónico y café durante la Platanus Hack 2026 🚀
</p>
