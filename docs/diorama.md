# Diorama: "entrar al cuadro"

Cuando el cuadro principal de una sala tiene un diorama, se vuelve una **ventana** a una maqueta 3D
explorable. Con `E` se entra; con `Q` se vuelve a la sala.

**De dónde sale el diorama** (en este orden):

1. **Biblioteca** (`library.ts`, hecha a mano: Carabobo, corazón, célula, neurona): manda donde el tema coincide.
2. **La foto real del cuadro** (`photoDiorama.ts`, `usePhotoDiorama.ts`, servidor `POST /api/diorama-from-image`, ver `servidor.md`): cuando la imagen del cuadro principal ya se resolvió, Claude (visión) clasifica si es una escena recreable (batalla, paisaje, lugar, interior, escena microscópica) y, si lo es, la describe con la biblioteca de props. **Si no es una escena (retrato, diagrama, mapa, texto, logo) o no hay IA, el cuadro queda normal, sin portal.** Nunca se arma un mundo con los conceptos de la sala.
3. Nada más. El compositor por conceptos (`compose.ts`) ya no se usa por defecto; solo lo llama la demo `?demo=compuesto`.

Dentro del mundo de foto, la imagen original se ve como **panel curvo al fondo** (`Backdrop` en `DioramaScene.tsx`, campo `diorama.backdrop`) para reconocer la escena, los props siguen la composición de la imagen y la paleta sale de ella. Cada prop lleva un `label` en español (qué representa en la imagen), útil para la narración.

Cliente: pide **solo** el cuadro principal sin diorama de biblioteca, con imagen de Wikimedia (no las subidas por el usuario ni las clasificadas como `diagram`), solo cuando la sala está a ≤ 64 m de la del jugador (o de la inicial), **2 peticiones a la vez** y la sala del jugador primero; cada imagen se pide una sola vez por sesión y un fallo transitorio se reintenta pasado 1 min. `usePhotoDioramaStore.ready` hace que `World` cargue el runtime de dioramas aunque ninguna sala traiga uno de biblioteca.

La IA **no escribe geometría**. Elige de una biblioteca cerrada (tipos de prop, terrenos, horas
del día) y coloca. El cliente construye todo con primitivas low-poly.

---

## 1. Dónde está

| Archivo | Qué hace |
|---|---|
| `packages/shared/src/schema.ts` | `DioramaSchema` (con `backdrop` opcional), `DioramaPropSchema`, `KINDS`, `POSES`, `TERRAINS`, `TIMES`, `MAX_PROPS`, `PhotoDioramaRequestSchema` y `PhotoDioramaResponseSchema` |
| `apps/web/src/diorama/photoDiorama.ts`, `usePhotoDiorama.ts` | Cola de peticiones (2 a la vez), caché por imagen y hook que decide el portal de cada cuadro |
| `apps/server/src/photoDiorama.ts` | Endpoint que recrea la escena de una imagen real |
| `apps/server/src/prompts.ts` (`DIORAMA_RULES`) | Qué pedirle a la IA y cómo colocar (dioramas que la IA marca al generar el museo; los de foto usan `PHOTO_SYSTEM_PROMPT`) |
| `apps/web/src/diorama/dioramaStore.ts` | Fase de la transición, portales registrados, atajos `E` y `Q` |
| `apps/web/src/diorama/DioramaRuntime.tsx` | Transiciones, cámara, colisiones dentro del diorama, cuadro-portal (`MeshPortalMaterial`) |
| `apps/web/src/diorama/DioramaScene.tsx` | Escena de la maqueta: cielo, luz, suelo, props instanciados |
| `apps/web/src/diorama/DioramaOverlay.tsx` | Capa DOM: velo, "E · Entrar al cuadro", recordatorio de salida |
| `apps/web/src/diorama/DioramaMinimap.tsx` | Minimapa dentro del diorama |
| `apps/web/src/diorama/RoomEcho.tsx` | Versión ligera de la sala, vista por el marco de regreso |
| `apps/web/src/diorama/model.ts` | Construcción y caché del modelo por diorama, precalentado en tiempo libre |
| `apps/web/src/diorama/layout.ts` | Colocación determinista de props, formaciones y colisionadores circulares |
| `apps/web/src/diorama/terrain.ts` | Suelo facetado y altura por tipo de terreno |
| `apps/web/src/diorama/props/*.ts` | Constructores de cada tipo de prop |
| `apps/web/src/diorama/atmosphere.ts` | Cielo, luz y niebla según `time` y `palette` |
| `apps/web/src/diorama/material.ts` | Un único material para toda la maqueta, viento en la GPU |
| `apps/web/src/diorama/geo.ts` | `Builder`: junta primitivas en una sola geometría por prop |
| `apps/web/src/diorama/random.ts` | Ruido y aleatoriedad **determinista** (misma escena en cualquier cliente) |

Tests: `apps/web/src/diorama/diorama.test.ts` y `packages/shared/src/diorama.test.ts`.

## 2. Esquema (resumen)

```ts
Diorama = {
  title, terrain, time,
  backdrop?,                          // solo dioramas de foto: ruta del proxy de imágenes
  palette: { ground, sky, accent },   // hex de 6 dígitos
  props: DioramaProp[]                // máx. 24; inválidos se descartan
}
```

| Valor | Opciones |
|---|---|
| `terrain` | `plain`, `hills`, `mountains`, `coast`, `river`, `forest`, `city`, `interior`, `desert`, `abstract` |
| `time` | `day`, `sunset`, `night`, `storm` |
| `kind` | `figure`, `rider`, `horse`, `flag`, `cannon`, `tree`, `rock`, `tent`, `house`, `church`, `ship`, `column`, `arch`, `campfire`, `custom` |
| `pose` | `standing`, `pointing`, `charging`, `fallen`, `seated`, `raising-arm` |
| `pattern` (solo `flag`) | `stripes` (franjas), `saltire` (aspa, p. ej. Cruz de Borgoña) |

Campos de cada prop: `pos: [x, z]` (±14 m), `rotY` (±7 rad), `scale` (0.5–3), `count` (1–30),
`spread` (0–8 m), `color`, `secondary`, `label` (≤40), `pieceId` (id de una pieza **de la misma sala**), `parts` (solo `custom`, ≤10).

> `custom` requiere `parts`. Sin ellas el prop se descarta. Las `parts` usan las mismas cotas que `ProceduralModel` (`buildCustom`).

### Reglas de degradación

Todo campo tiene `.catch(valor por defecto)`. Un valor malo se corrige en silencio; un prop
inválido se quita; el exceso se recorta a 24; un diorama inválido se descarta (`RoomSchema.diorama`
usa `.catch(undefined)`). **Nunca** tumba el museo.

## 3. Cómo funciona en ejecución

### Fases (`dioramaStore.ts`)

```
room ──E──▶ entering (1.05 s) ──▶ inside ──Q──▶ leaving (0.8 s) ──▶ room
```

- `hintId`: cuadro al alcance que se mira; ofrece "E · Entrar al cuadro".
- `nearReturn`: el jugador está cerca del marco de regreso.
- `dioramaRequest` es una cola de peticiones que atiende `DioramaRuntime` dentro del bucle de render.
- `dioramaFx.fade` es el velo de color; se muta por frame sin pasar por React.
- Se respeta `prefers-reduced-motion`: sin easing ni tiempos de transición largos.

### Mismo Canvas, otro mundo

El diorama vive en `DIORAMA_ORIGIN = (1500, 0, 1500)`, lejos del palacio, **dentro del mismo
Canvas**. Entrar es mover la cámara y cambiar la atmósfera; no hay segundo renderer ni recarga.

### El cuadro-portal

`PortalPainting.tsx` y `MeshPortalMaterial` (drei) muestran el diorama dentro del marco de la sala.
Cada cuadro se registra con `registerPortal` (`PortalInfo`: diorama, centro, rotación, tamaño y sala).

### Modelo y caché

- `getDioramaModel(d)` construye geometrías, colocación y grupos de props una vez, y los cachea por objeto. Así el portal y el mundo a escala real comparten el mismo modelo.
- `warmDioramaModel(d)` lo construye en un hueco libre del hilo principal, antes de que el jugador se acerque.
- Cada `prop` se agrupa en un `InstancedMesh` por variante. Un pelotón entero son pocos draw calls.

### Props y variantes

- `buildProp(kind, ctx, variant)` despacha a los constructores de `props/` (`figure`, `rider`, `horse`, `flag`, `nature`, `structures`).
- `variantsFor(kind, count)`: tipos como `figure`, `tree`, `rock`, `house` tienen 2 o 3 variantes si hay muchos ejemplares. Así una multitud no repite el mismo modelo.
- `layout.ts` coloca los props: formaciones para tropas y dispersión (`spread`) para el resto. Genera colisionadores circulares.

### Terreno

- `heightField(terrain, seed)` da la altura por tipo de terreno, con ruido determinista (`fbm`, `ridged`).
- `buildTerrainGeometry` produce un suelo **facetado**: un triángulo, un color plano. Es el look low-poly.
- `TERRAIN_EXTENT = 130` m (medio lado del suelo).

### Viento y material

- Un único material (`makeDioramaMaterials`) para toda la escena, color por vértice, sombreado plano, sin brillo.
- El viento vive en la GPU: el atributo `aWind` (x = balanceo, y = ondulación de tela) se mueve con un uniform `time`. Coste de CPU cero.

### Atmósfera

`atmosphereOf(diorama)` deriva cielo, luz y niebla de `time` y `palette`. Sol duro y luz plana, sin bloom: el cielo es una escalera de tonos, no un degradado.

### Piezas enlazadas

Un prop con `pieceId` y `label` queda enlazado a una pieza de la sala (`Linked`). Dentro del diorama,
`DioramaRuntime` busca el enlace más cercano a menos de 7 m (`REACH`) y que el jugador mire de frente
(coseno ≥ 0.9). Si lo encuentra, lo pone como `focusedId`: el mismo foco que usa `E` para examinar la
pieza. Máximo 5 enlaces recomendados en el prompt.

## 4. Reglas para la IA (resumen de `DIORAMA_RULES`)

- Solo en 1 o 2 salas, las más representables. En salas abstractas, no.
- 8 a 16 props. Usa `count` para multitudes en vez de repetir.
- Personas y animales: siempre `figure`, `rider` o `horse`, nunca partes sueltas.
- `pos` en metros dentro de ±14. Deja libre `z > 6`: ahí entra la vista.
- Máximo 5 enlaces `pieceId` a piezas de **esa misma sala**.

## 5. Cómo probarlo

- Demo rápida: `?demo=historia` (Carabobo de biblioteca; Boyacá, Angostura y Maracaibo se recrean desde su foto, con semillas del repo) o el palacio con una sala que tenga `diorama`.
- Validación visual y de rendimiento (draw calls, FPS, capturas): skill `3d-validation`.
- Lógica (colocación, terreno determinista, esquema): `npm test -w @mus3o/web` y `-w @mus3o/shared`.

## 6. Limitaciones conocidas

- Solo escritorio.
- `caraboboDiorama.ts` (mock) es un ejemplo de contenido, no es un diorama real generado por IA.
- No hay pruebas automáticas de render; la validación visual es manual.
