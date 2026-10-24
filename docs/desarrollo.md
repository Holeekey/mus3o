# Desarrollo: comandos, flujo y mantenimiento de la documentación

## 1. Puesta en marcha

```bash
git submodule update --init          # o clonar con --recurse-submodules
cp .env.example .env                 # añade ANTHROPIC_API_KEY (opcional, ver abajo)
npm install
npm run dev                          # web http://localhost:5173 · server http://localhost:3001
```

- **Después de cada `git pull` de `dev`, corre `npm install`.** El equipo suma dependencias seguido; si no se instalan, Vite falla con `Failed to resolve import` (ver §9).
- Sin `ANTHROPIC_API_KEY`: los temas devuelven un museo mock y los apuntes responden 503. El cliente usa su parser local.
- Atajos de navegador: `http://localhost:5173/?demo`, `?demo=ia`, `?demo=historia`, `?demo=dungeon`. Ver [frontend.md](./frontend.md) §1.

## 2. Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Server (tsx watch) y web (Vite) en paralelo |
| `npm run dev:web` / `npm run dev:server` | Uno solo |
| `npm run build` | Compila `shared` → `server` (tsup) → `web` (`tsc --noEmit` + `vite build`) |
| `npm run typecheck` | `tsc --noEmit` en todos los workspaces |
| `npm test -w @mus3o/shared` | Vitest de contratos y verificación de citas |
| `npm test -w @mus3o/server` | Vitest del servidor |
| `npm test -w @mus3o/web` | Vitest del frontend |
| `npm start -w @mus3o/server` | Corre el build del servidor (`dist/index.js`) |
| `npm run test:dungeon` | Pruebas del sandbox `dungeon-core` |

> `npm run test:dungeon` corre el sandbox `@mus3o/dungeon-core` (4 archivos, 7 pruebas, todas pasan). No forma parte del flujo principal del juego.

Antes de abrir un PR, como mínimo: `npm run typecheck` y `npm test` en los tres paquetes afectados.

## 3. Variables de entorno

Ver la tabla completa en [servidor.md](./servidor.md) §6. Resumen:

| Variable | Obligatoria | Default |
|---|---|---|
| `ANTHROPIC_API_KEY` | No (sin ella hay mock) | — |
| `ANTHROPIC_MODEL` | No | `claude-sonnet-5-5` |
| `ANTHROPIC_DIGEST_MODEL` | No | `claude-haiku-5-5` (modelo barato de `/api/digest-sources`) |
| `PORT` | No | `3001` |
| `WEB_ORIGIN` | No | `http://localhost:5173` |
| `MAX_DAILY_GENERATIONS` | No | `200` |
| `MAX_DAILY_ARIS_HELP` | No | `300` |
| `ANTHROPIC_ARIS_MODEL` | No | `claude-haiku-5-5` |
| `ENABLE_DEBUG_ROUTES` | No | — (`true` activa `/api/improve-prompt` y `/api/assets-review`) |
| `POLY_PIZZA_API_KEY` | No | — (sin ella no se buscan modelos 3D; los pedestales usan glifos) |
| `ASSET_CACHE_DIR` | No | `.cache/assets` (`.glb` descargados y `review.json`) |
| `MUSEUM_CACHE_DIR` | No | `.cache/museums` (museos generados, sobrevive a reinicios) |
| `ANTHROPIC_FALLBACK_MODEL` | No | `claude-haiku-5-5` (respaldo creado de piezas sin asset) |
| `ANTHROPIC_DIORAMA_MODEL` | No | el principal (Haiku se probó y se descartó: ver `servidor.md`) |
| `FLOW_FORMAT` | No | `dsl` (`json` = formato anterior, más caro) |

**Reglas:** `.env` está ignorado por git. Solo el servidor lee variables. Nunca uses `VITE_*` para secretos.

### Archivo `.env.example`

Está en la raíz y sí se versiona (`.gitignore` lo excluye de la regla `.env.*` con `!.env.example`).
Para crear tu `.env` local: `cp .env.example .env`, y pon tu clave en `ANTHROPIC_API_KEY`.

```bash
# Solo el servidor lee este archivo. Nunca uses variables VITE_ para secretos.
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-sonnet-5-5
PORT=3001
# Origen permitido por CORS (frontend)
WEB_ORIGIN=http://localhost:5173
# Tope diario de generaciones con IA (fallos de caché)
MAX_DAILY_GENERATIONS=200
# Solo depuración: habilita POST /api/improve-prompt (con "true"). Déjalo vacío en producción.
ENABLE_DEBUG_ROUTES=
# Modelos 3D (Poly Pizza), cachés y flujo: ver .env.example y servidor.md
POLY_PIZZA_API_KEY=
ASSET_CACHE_DIR=
MUSEUM_CACHE_DIR=
ANTHROPIC_FALLBACK_MODEL=claude-haiku-5-5
ANTHROPIC_DIORAMA_MODEL=
FLOW_FORMAT=dsl
```

Si agregas una variable nueva, añádela aquí con un comentario y actualiza la tabla de arriba y [servidor.md](./servidor.md) §6.

## 4. Flujo de git (resumen de `CLAUDE.md`)

Gitflow simplificado con tres tipos de rama:

| Rama | Para qué | Regla |
|---|---|---|
| `main` | Siempre desplegable. Recibe merges desde `dev` en checkpoints | Nunca commit directo |
| `dev` | Integración. Debe compilar y correr | Nunca commit directo; no force-push |
| `feature/<tema>` o `fix/<tema>` | Una tarea corta | Se borra al hacer merge |

Pasos para cualquier tarea:

1. `git checkout dev && git pull`
2. `git checkout -b feature/<tema>`
3. Commits pequeños, en imperativo: `Add login form`, `Fix empty state crash`.
4. Antes del PR: la app corre y el cambio se probó (no basta con que compile).
5. PR `feature/*` → `dev`. Título corto. Descripción con qué cambió y cómo probarlo.
6. Si algo bloquea más de ~20 min, anótalo en un issue o en `TODO.md` y sigue con otra cosa.

Atribución de commits: el commit lleva la línea `Co-Authored-By` que indique el harness del agente.

Checkpoints: `dev` → `main` solo cuando `dev` esté estable. Freeze en las últimas 2–3 horas: solo bugs y pulido.

## 5. Assets y archivos binarios

- Modelos 3D (`.glb`, `.gltf`, `.bin`, `.fbx`, `.obj`), texturas (`.png`, `.jpg`) y tipografías (`.ttf`) van con **Git LFS** (`.gitattributes`).
- **No se leen ni se grepean** `Public/**`, `assets/**`, `apps/web/public/models/**` ni los binarios. Están en `.claudeignore`.
- Para saber qué modelos hay, lee `ASSETS.md` o `apps/web/public/models/catalog.json`.
- Atribución obligatoria: modelos de KayKit Dungeon Pack de Kay Lousberg, CC0 (`ASSETS.md`).
- Skills útiles: `assets`, `gltf-compression` (compresión de GLB a WebP 1024 px).

## 6. Skills y agentes del proyecto

Skills en `.claude/skills/` (algunas vienen del submódulo `dev-ai-toolkit`):

| Skill | Cuándo usarla |
|---|---|
| `architecture` | Tocar el servidor, endpoints, caché, contrato o el generador de layout |
| `3d-validation` | Probar el generador de salas, medir draw calls o FPS, capturas, "listo para la demo" |
| `assets` | Agregar modelos, props, texturas, HDRI, audio |
| `gltf-compression` | Reducir el peso de un GLB |
| `token-budget` | Elegir modelo, decidir si delegar, presupuesto de créditos |
| `code-review`, `commit-and-pr`, `test-strategy`, `tech-docs` | Revisión, commits y PR, diseño de tests, documentación |

## 7. Pruebas: qué probar después de cada tipo de cambio

| Cambio | Mínimo |
|---|---|
| `packages/shared` (contrato, citas) | `npm test -w @mus3o/shared` + `-w @mus3o/server` (el server lo consume) + `-w @mus3o/web` |
| `apps/server` | `npm test -w @mus3o/server` + probar el endpoint con `curl` o desde la interfaz |
| `apps/web` lógica (memoria, llaves, layout, parser) | `npm test -w @mus3o/web` |
| `apps/web` escena 3D, diorama, cuadros | Correr `npm run dev`, abrir `?demo=…`, revisar a mano |
| Cualquier cosa visible | Skill `3d-validation` antes de la demo |

## 8. Cómo añadir cosas sin romper nada

### Un campo nuevo en el contrato

1. Agrégalo como **opcional** (o con `.default` / `.catch`) en `packages/shared/src/schema.ts`.
2. Caso de prueba en `schema.test.ts`.
3. Si la IA debe producirlo: prompt en `apps/server/src/prompts.ts` y prueba en `flow.test.ts`.
4. Si se pinta: `apps/web`. Un palacio guardado en `localStorage` debe seguir validando.
5. Actualiza [contrato-shared.md](./contrato-shared.md).

### Un endpoint nuevo

1. Valida la entrada con un esquema de `@mus3o/shared`.
2. Rate limit, tope diario si gasta IA, caché si aplica.
3. Errores controlados: nunca expongas la respuesta cruda de la IA ni los apuntes.
4. Actualiza [servidor.md](./servidor.md).

### Una regla de memoria o de llaves

Lógica en `memory/model.ts` y `palace/keys.ts`, con tests. Actualiza [memoria-y-examen.md](./memoria-y-examen.md).

### Un tipo de prop del diorama

Constructor en `apps/web/src/diorama/props/`, registrarlo en `props/index.ts` (`buildProp`, `variantsFor`), valor nuevo en `KINDS` (schema) y en `DIORAMA_RULES`. Actualiza [diorama.md](./diorama.md).

## 9. Solución de problemas conocidos

| Síntoma | Causa probable | Qué hacer |
|---|---|---|
| `error: packfile … index unavailable` al hacer `git pull` | Un paquete de objetos de git incompleto en el clon local | Observado una vez en esta sesión; el pull terminó como fast-forward. Si vuelve, `git fsck` muestra el estado |
| Vite: `Failed to resolve import "mammoth" from "src/lib/files.ts"` (u otro paquete) | Se hizo `git pull` con dependencias nuevas sin instalarlas | `npm install` en la raíz; Vite lo toma solo, recarga la página |
| `git pull`: `git-lfs filter-process: git-lfs: command not found` | El repo usa Git LFS para assets y no está instalado | `brew install git-lfs` y repite el pull |
| "No pudimos generar el palacio con IA" y en el server `generate-museum falló tras … ms: Error` | La API de Anthropic rechaza la llamada; visto con `400 Your credit balance is too low` (cuenta sin créditos) | Revisa los créditos en la consola de Anthropic. Reintentar no sirve hasta cargarlos |
| La landing dice "IA no configurada" | Falta `ANTHROPIC_API_KEY` | Añádela en `.env` y reinicia el server |
| "Demasiadas solicitudes" (429) | Rate limit 10/min o tope diario de 200 | Espera un minuto; el tope diario se reinicia a medianoche UTC |
| Un palacio guardado no carga | No pasa `MuseumSchema` tras un cambio de contrato | `merge` lo descarta a propósito. Borra `mus3o-v1` en `localStorage` o regenera el palacio |
| Cuadros sin imagen | Wikimedia con límite de tasa o artículo sin imagen | Reintenta en un minuto; sin artículo no hay cuadro (es lo esperado) |
| Pointer lock no se activa | El navegador exige un clic del usuario | Haz clic en el palacio antes de moverte |

## 10. Cómo mantener esta documentación al día

Esta carpeta es la memoria técnica del proyecto. Cuando cambies código, actualiza el documento
correspondiente en el mismo PR:

| Si cambias… | Actualiza |
|---|---|
| Esquemas o límites de `packages/shared` | [contrato-shared.md](./contrato-shared.md) |
| Rutas, límites, prompts, caché, costos | [servidor.md](./servidor.md) |
| Pantallas, estado, controles, HUD, Aris, layout | [frontend.md](./frontend.md) |
| Curva de olvido, llaves, examen | [memoria-y-examen.md](./memoria-y-examen.md) |
| Diorama o props | [diorama.md](./diorama.md) |
| Citas o imágenes | [fuentes-e-imagenes.md](./fuentes-e-imagenes.md) |
| Algo que pasa de "pendiente" a "hecho" (o al revés) | [estado-y-pendientes.md](./estado-y-pendientes.md) |
| Comandos, variables de entorno, flujo | Este archivo |

Reglas de estilo para esta documentación:

- Escribe en español, con tablas y rutas de archivo. Cada afirmación debe poder comprobarse en el código.
- Si no está verificado, dilo ("no verificado" o "pendiente"). No inventes.
- Marca lo pendiente con claridad, en lugar de describirlo como si ya existiera.
- Usa `archivo.ts` con su función o constante cuando sea útil, por ejemplo `palace/keys.ts#canOpenDoor`.
