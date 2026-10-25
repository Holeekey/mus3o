# Arquitectura

## 1. Monorepo

npm workspaces (`package.json` raíz): `apps/*` y `packages/*`.

| Paquete | Nombre npm | Qué es | Stack |
|---|---|---|---|
| `apps/web` | `@mus3o/web` | Frontend: landing, parser de apuntes, palacio 3D, HUD, memoria | Vite, React, React Three Fiber, drei, postprocessing, Zustand, Tailwind |
| `apps/server` | `@mus3o/server` | API: genera el mus3o con Claude, valida, cachea, proxy de imágenes | Express, `@anthropic-ai/sdk`, express-rate-limit, Zod |
| `packages/shared` | `@mus3o/shared` | Contrato de datos (esquemas Zod), límites, verificación de citas, mock de ejemplo | Zod |
| `packages/dungeon-core` | `@mus3o/dungeon-core` | Sandbox de agente de mazmorras (KayKit). Solo lo usa `apps/web/src/mocks/dungeon.ts` | TypeScript |
| `dev-ai-toolkit/` | (submódulo) | Skills y agentes de apoyo para el equipo. No es código de la app | — |

Árbol útil (sin assets):

```
apps/
  server/src/
    app.ts          rutas, rate limits, tope diario, manejo de errores
    index.ts        arranque (PORT, default 3001)
    claude.ts       llamadas a Claude, reintento de JSON, mock sin API key
    prompts.ts      todos los prompts y reglas de la IA (`MUSEUM_WORDING`: al usuario se le dice "museo", nunca "palacio")
    cache.ts        caché en memoria de museos (100 entradas)
    images.ts       proxy de imágenes de Wikimedia (/api/image, /api/image/file)
  web/src/
    App.tsx         enruta landing / palacio y carga demos con ?demo=
    store.ts        estado global (Zustand) persistido en localStorage
    lib/api.ts      cliente de /api/generate-museum
    lib/images.ts   resolución y precarga de imágenes de cuadros
    palace/         parser de apuntes, layout del palacio, llaves, Aris, citas
    memory/         modelo de olvido, store de memoria, animaciones, fragmentos
    scene/          escena R3F: mundo, salas, jugador, cuadros, decaimiento
    diorama/        escena de maqueta "entrar al cuadro"
    ui/             landing, HUD, minimapa, diálogo de Aris, bloque de fuente
    mocks/          museos de ejemplo para demos
packages/
  shared/src/       schema.ts (contrato), sources.ts (citas), grid.ts, mock.ts
```

## 2. Flujo de punta a punta

```
┌────────── Navegador ──────────────────────────────────────────────────────────┐
│ Landing: texto o archivos (pdf/docx/xlsx/csv/txt) → texto plano en el navegador   │
│   · looksLikeTopic(): 1 línea ≤200 car. = tema; si no = apuntes              │
│   · "Generar con IA" → POST /api/generate-museum                             │
│   · o parsePalace() local (sin IA): texto, JSON o CSV                        │
│                                                                              │
│ MuseumSchema.safeParse(respuesta)  →  store.enterPalace(palace, apuntes)     │
│   buildLayout(palace) → PalaceLayout (muros, puertas, pedestales, cuadros)   │
│   World (R3F): salas, jugador, cuadros; HUD; minimapa; Aris                  │
└──────────────────────────────┬───────────────────────────────────────────────┘
                               │ POST /api/generate-museum (JSON ≤ 8 MB, con imágenes base64)
┌──────────────────────────────▼───────────────────────────────────────────────┐
│ Servidor (Express)                                                           │
│  1. Rate limit: 10 req/min por IP (no aplica a /api/image)                   │
│  2. Acepta { topic } (legacy) o { mode, prompt, sources[], images[] }         │
│  3. Caché por SHA-256 (no guarda apuntes en claro)                           │
│  4. Tope diario de llamadas a Claude (MAX_DAILY_GENERATIONS, def. 200)       │
│  5. Claude (askForJson): 1 reintento si el JSON no valida                    │
│  6. parse → sanitizeRawSources → MuseumSchema (+ reglas de modo y grafo)     │
│  7. verifySources: cada cita se busca literal en los apuntes                 │
│  8. Respuesta: Museum (con sourceTextHash)                                   │
└──────────────────────────────────────────────────────────────────────────────┘
```

Puntos clave del flujo:

- **Sin `ANTHROPIC_API_KEY`:** con `topic` el servidor devuelve `sampleMuseum` con el título del tema (mock). Con apuntes responde 503 y el cliente usa su parser local.
- **El cliente vuelve a validar** la respuesta con el mismo `MuseumSchema`. El servidor nunca es la única barrera.
- **Los apuntes no se guardan en el servidor.** Solo se guarda en caché el resultado, indexado por hash.

## 3. Dónde vive cada decisión importante

| Decisión | Dónde está | Documento |
|---|---|---|
| La IA elige de catálogos cerrados, nunca escribe código | `packages/shared/src/schema.ts` (`GlyphShape`, `KINDS`, `TERRAINS`, …) | [contrato-shared.md](./contrato-shared.md) |
| Límites de tamaño para que nada rompa la escena | `LIMITS`, `coord` ±5, `DIORAMA_HALF` 14 | [contrato-shared.md](./contrato-shared.md) |
| Un dato inválido se repara, no tumba el museo | `.catch(...)` en `DioramaSchema`, `RoomSchema.diorama` | [contrato-shared.md](./contrato-shared.md) |
| Las citas se verifican contra los apuntes | `verifySources` en `packages/shared/src/sources.ts` | [fuentes-e-imagenes.md](./fuentes-e-imagenes.md) |
| Progreso del usuario local, sin cuentas | `localStorage` (`mus3o-v1` para palacio y progreso, `mus3o-memory-v1` para la memoria por concepto) | [frontend.md](./frontend.md) |
| Memoria espaciada en el cliente | `apps/web/src/memory/model.ts` | [memoria-y-examen.md](./memoria-y-examen.md) |
| Aris no usa IA: reglas y búsqueda aproximada | `apps/web/src/palace/arisBrain.ts` | [frontend.md](./frontend.md) |
| Costo controlado | Rate limit, caché, tope diario, `max_tokens` fijo | [servidor.md](./servidor.md) |

## 4. Stack y versiones relevantes

- Modelo de IA por defecto: `claude-sonnet-5-5` (variable `ANTHROPIC_MODEL`).
- Node con workspaces de npm. Tests con Vitest en los tres paquetes principales.
- TypeScript estricto en todos los paquetes (`npm run typecheck`).
- Renderizado: three.js con geometrías `low-poly` construidas en código (`diorama/geo.ts`) y modelos de catálogo (`apps/web/public/models/`), con materiales planos sin brillo.
- Tipografías en `apps/web/public/fonts/` (Gloock y Hanken Grotesk, OFL). Son binarios: no se leen.

Ver [estado-y-pendientes.md](./estado-y-pendientes.md) para lo que ya está en pie y lo que falta.
