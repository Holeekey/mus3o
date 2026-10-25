# mus3o: documentación para desarrolladores y modelos

> **Empieza aquí.** Este es el índice de toda la documentación técnica del proyecto.
> Está pensada para que una persona o un modelo de IA entienda rápido qué existe, dónde está
> y qué falta, sin tener que leer todo el código.

**mus3o** (LociGen) convierte apuntes de estudio o un tema en un **palacio de la memoria 3D**
explorable en primera persona (método de Loci). Cada sala es un tema, cada pieza es un concepto
que se memoriza con un objeto 3D, y el juego usa repaso espaciado y un examen para medir qué se
recuerda.

Equipo 5 del Platanus Hack 26. Alcance de la demo: solo escritorio (la rama VR añade un modo para visores de teléfono, ver [vr.md](./vr.md)).

---

## Mapa de la documentación

| Archivo | Qué responde | Léelo cuando… |
|---|---|---|
| [arquitectura.md](./arquitectura.md) | Monorepo, stack, flujo de punta a punta, dónde vive cada cosa | Llegas nuevo o necesitas ubicar algo |
| [contrato-shared.md](./contrato-shared.md) | Esquemas Zod de `packages/shared`: `Museum`, salas, piezas, grafo, diorama, límites | Tocas datos, validación o el JSON que devuelve la IA |
| [servidor.md](./servidor.md) | Endpoints, rate limits, caché, tope diario, llamadas a Claude, prompts, proxy de imágenes, **modelos 3D de Poly Pizza, flujo DSL, costos y mediciones** | Tocas `apps/server` |
| [frontend.md](./frontend.md) | Pantallas, store de Zustand, parser de apuntes, layout del palacio, escena 3D, HUD, controles, Aris | Tocas `apps/web` |
| [memoria-y-examen.md](./memoria-y-examen.md) | Curva de olvido, llaves, puertas, examen, repaso, "máquina del tiempo" | Tocas progreso, llaves o repaso |
| [vr.md](./vr.md) | Modo VR para visores de teléfono: WebXR y respaldo cardboard, interacción por mirada, HTTPS en el teléfono | Tocas `apps/web/src/vr`, o quieres probar en un visor |
| [diorama.md](./diorama.md) | "Entrar al cuadro": escena de maqueta, props, terreno, atmósfera | Tocas `apps/web/src/diorama` o el campo `diorama` |
| [fuentes-e-imagenes.md](./fuentes-e-imagenes.md) | Trazabilidad de citas, verificación contra los apuntes, imágenes de Wikimedia | Tocas `sources`, citas o cuadros con imagen real |
| [estado-y-pendientes.md](./estado-y-pendientes.md) | Qué está hecho, qué no, resultados de tests, discrepancias conocidas | Quieres saber el estado real antes de empezar |
| [optimizaciones.md](./optimizaciones.md) | Mejoras de rendimiento ya investigadas (6 seguras, con archivo, línea, prueba y medidas del build) | Vas a optimizar peso, CPU o trabajo repetido |
| [revision-dev.md](./revision-dev.md) | Informe de revisión formal de la rama `dev`: hallazgos de concurrencia, memoria e I/O (todos resueltos) | Vas a auditar o consultar el estado de hallazgos de `dev` |
| [auditoria-seguridad-y-fallbacks.md](./auditoria-seguridad-y-fallbacks.md) | Auditoría de fallos delicados/medios, resiliencia WebGL, upstream de IA y fallbacks desacoplados | Analizas estabilidad, resiliencia o arquitectura de contingencia |
| [desarrollo.md](./desarrollo.md) | Cómo correr, probar, variables de entorno, flujo de git, errores comunes | Vas a levantar el proyecto o abrir un PR |

Documentos previos (decisiones de producto y de seguridad, no cambian con el código):

- [idea.md](./idea.md): concepto, fundamento cognitivo y visión.
- [contrato-flujo.md](./contrato-flujo.md): propuesta original del contrato del flujo de generación (modo, grafo, imágenes).
- [seguridad.md](./seguridad.md): prompt injection, validación de salida, límites de costo y privacidad.

---

## Reglas rápidas para cualquier modelo que trabaje aquí

1. **Nunca leas ni grepees assets binarios** (`Public/**`, `assets/**`, `apps/web/public/models/**`, `*.glb`, `*.gltf`, `*.bin`, `*.png`, etc.). Están en `.claudeignore`. Para saber qué modelos existen usa `ASSETS.md` o `apps/web/public/models/catalog.json`.
2. **Antes de cualquier tarea:** `git checkout dev && git pull`, luego `feature/<tema>` desde `dev`. Nunca commitear directo a `dev` ni a `main`. Detalles en [desarrollo.md](./desarrollo.md).
3. **El contrato es la fuente de verdad.** Cualquier JSON que venga de la IA o del usuario pasa por `packages/shared` (Zod) antes de usarse. Si cambias un campo, cámbialo ahí primero.
4. **Solo se agregan campos opcionales** a `Museum`. Un palacio guardado en `localStorage` debe seguir validando.
5. **La IA nunca escribe código ni HTML.** Elige de catálogos cerrados (formas, props, terrenos). El cliente valida y repara.
6. **Los apuntes no se persisten en el servidor.** Se procesan en memoria; el navegador guarda lo que necesita en `localStorage`.
7. **Los archivos (pdf, docx, xlsx, csv, txt) se extraen en el navegador.** Solo viaja el texto.

## Glosario

| Término | Significado |
|---|---|
| **Palacio / mus3o / museo** | El conjunto completo generado a partir de un tema o apuntes. Tipo `Museum`. |
| **Sala (`room`)** | Un tema. Tiene piezas y una posición en el mapa. |
| **Pieza (`piece`)** | Un concepto memorizable. Se representa con un pedestal y un modelo 3D. |
| **Grafo (`graph`)** | Cómo se conectan las salas: `start` y aristas `next`, `prerequisite`, `related`. |
| **Modo** | `exploration`, `quiz`, `biography` o `education`. Cambia la forma del grafo y los campos obligatorios. |
| **Cuadro / painting** | Marco en un muro de la sala. Puede mostrar una imagen real (Wikimedia) o abrir un diorama. |
| **Diorama** | Maqueta 3D a la que se "entra" desde el cuadro principal de una sala. |
| **Llave** | Se gana al memorizar (o acertar en el examen) todas las piezas de una sala. Abre las puertas que salen de esa sala. |
| **Aris** | Compañero de estudio: asistente local por reglas (sin IA ni red). Se le habla con `T`. |
| **Repaso / examen** | Preguntas sobre conceptos vencidos según la curva de olvido. |
| **Fuerza (`strength`)** | Probabilidad estimada de recordar un concepto, entre 0 y 1. |
