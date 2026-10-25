# Memoria, llaves y examen

Cómo el juego registra lo que el usuario recuerda y cómo lo convierte en progreso (llaves,
puertas, repasos). Todo ocurre en el navegador. Es lógica pura y está testeada.

Archivos:

| Archivo | Responsabilidad |
|---|---|
| `apps/web/src/memory/model.ts` | Curva de olvido, niveles, marcar y examinar (puro) |
| `apps/web/src/memory/store.ts` | Store persistido (`mus3o-memory-v1`) y desfase del tiempo |
| `apps/web/src/memory/hooks.ts` | Hooks de React sobre la memoria (`useConceptLevel`, `useDueCount`, …) |
| `apps/web/src/memory/anim.ts` | Animación suave de la fuerza mostrada (decaer 1.5 s, restaurar 1.1 s) |
| `apps/web/src/memory/shards.ts` | Fragmentos de yeso deterministas que se desprenden al olvidar |
| `apps/web/src/memory/shown.ts` | Registros por frame que leen minimapa y objetos sin pasar por React |
| `apps/web/src/memory/demo.ts` | Solo demo: semillas de estabilidad, cámara y salto del reloj |
| `apps/web/src/palace/keys.ts` | Llaves de sala y apertura de puertas |
| `apps/web/src/palace/match.ts` | Corrección de la respuesta del examen |
| `apps/web/src/store.ts` | Acciones que unen todo: `toggleMemorized`, `recordExam`, `startReview` |

---

## 1. Curva de olvido

Modelo exponencial por concepto:

```
fuerza (retrievability) = exp( − díasDesdeÚltimoRepaso / estabilidad )     en [0, 1]
```

Constantes (`model.ts`):

| Constante | Valor | Significado |
|---|---|---|
| `DUE_THRESHOLD` | 0.7 | Por debajo de esto el concepto está **pendiente de repaso** |
| `MAX_STABILITY` | 365 días | Techo de la estabilidad |
| `HISTORY_CAP` | 20 | Últimos 20 repasos guardados por concepto |
| `TIME_STEPS` | [0, 1, 3, 7, 14, 30] | Saltos de días de la máquina del tiempo en el HUD (no es un calendario de repasos) |

Un concepto **sin registro** tiene fuerza 1 y no decae hasta su primer repaso.

### Niveles visibles

| Fuerza | Nivel | Cómo se ve |
|---|---|---|
| ≥ 0.85 | `intact` | Pieza entera |
| ≥ 0.60 | `cracked` | Pieza con grietas, fragmentos empiezan a aflojarse |
| ≥ 0.30 | `broken` | Pieza rota, varios fragmentos caídos |
| < 0.30 | `forgotten` | Pieza casi deshecha |
| (sin registro) | `new` | Aún no memorizado |

Los fragmentos de `shards.ts`: 20 por concepto, cada uno con un umbral de fuerza
(entre 0.6 y 0.05). `detach(thr, strength)` lo suelta al bajar del umbral, en una ventana de 0.12.

## 2. Acciones que cambian la memoria

| Acción | Efecto en `model.ts` | Dónde se dispara |
|---|---|---|
| **Marcar memorizado (M)** por primera vez | `markLearned`: estabilidad = 1 día, primer repaso | `store.toggleMemorized` |
| **M sobre un concepto ya memorizado pero olvidado** (fuerza < 0.85) | No lo desmarca: lo **restaura** (`learn`) | `store.toggleMemorized` |
| **M sobre uno memorizado y fresco** | Lo desmarca en la vista (`memorized`), el registro de memoria se conserva | `store.toggleMemorized` |
| **Examen acertado** | `applyExam(ok=true)`: estabilidad × 2.5 (máx. 365), `reviews + 1` | `recordExam` |
| **Examen fallado** | `applyExam(ok=false)`: estabilidad = **0.3 días**, `lapses + 1` | `recordExam` |

Cada registro guarda: `stability`, `lastReview`, `reviews`, `lapses` y `history` (últimos 20 `{t, ok}`).

> Regla de diseño: desmarcar con M **no borra** la memoria. Una llave ganada tampoco se pierde.

## 3. Llaves y puertas (`palace/keys.ts`)

- **Llave de una sala** = todas sus piezas están memorizadas, o acertadas en el examen.
  - `remainingToMemorize(room, memorized, exam)` cuenta las piezas sin memorizar **y** sin acierto (`exam[id] !== 'ok'`).
  - `earnedRoomKeys` devuelve las salas con cero pendientes. Una sala sin piezas ya tiene su llave.
- **Puerta:** `canOpenDoor(door, hasKey, roomKeys)` es verdadero si se tiene la llave de la sala de la que sale la puerta (`door.fromRoomId`), o la **llave de hierro** (`hasKey`, solo en la mazmorra, que la recoge con `E` sobre la pieza de tipo `key`).
- **Exploración libre** (`freeExplore`, por defecto **activa**): todas las puertas abiertas, sin llaves. Es una preferencia del usuario. `isDoorOpen` la considera.
- Al ganar una llave nueva, `lastKeyRoomId` se actualiza para avisar en el HUD.

## 4. Examen y repaso

### Modo examen completo

`store.setMode('exam')` (desde el HUD). Cada concepto pide la respuesta escrita:

1. `ExamCard` (`ui/Hud.tsx`) muestra una pista (primeras dos letras y largo del título) y pide escribir la respuesta.
2. `isCorrectAnswer(answer, expected)` (`palace/match.ts`) acepta sin importar tildes ni mayúsculas, y tolera errores menores de tipeo.
3. `recordExam(id, 'ok' | 'fail')` actualiza `exam[id]`, la memoria (`useMemory.exam`) y recalcula llaves.
4. En examen no se puede marcar M: el juego se mueve a responder.

### Repaso (`startReview`)

- `dueIds(mem, ids, now)` devuelve los conceptos con fuerza < 0.7.
- Si no hay ninguno, `startReview` devuelve `false` y el HUD muestra "Nada que repasar por ahora".
- Si hay, entra al examen **solo** con esos conceptos (`reviewIds`). `inExamScope` decide qué conceptos se preguntan.
- La landing muestra "· N repasos pendientes" en el botón "Continuar".

## 5. Máquina del tiempo (desfase del reloj)

`memory/store.ts` guarda `timeOffsetDays` (0 a 3650 días). `nowMs()` suma ese desfase.

- Sirve para **ver cómo envejece el palacio** sin esperar: al subir el desfase, las piezas se rompen según su estabilidad.
- Se controla con el parámetro `?dias=N` al entrar, o con `setOffset`. No tiene control en la interfaz (se quitó de la pausa): es solo para demos y pruebas.
- Animación: al cambiar el desfase, la fuerza mostrada persigue a la real en ~1.5 s (decaer) o ~1.1 s (restaurar). Con movimiento reducido, 250 ms (`anim.ts`).
- En la demo, `applyDemoSeed` da estabilidades distintas por concepto para que el envejecimiento sea desigual. `?salto=0@3000` salta el reloj a los 3 s. Solo para capturas.

## 6. Relación entre progreso y persistencia

| Dato | Clave | Dónde vive |
|---|---|---|
| Palacio, memorizados, llaves, puertas, `freeExplore`, apuntes | `mus3o-v1` | `store.ts` |
| Registros de memoria por palacio (`palaceKey` = hash FNV-1a del contenido) | `mus3o-memory-v1` | `memory/store.ts` |

`palaceKey` es un hash de ids y títulos de salas y piezas. Si cambia el contenido del palacio, la memoria previa no se aplica. Esto evita que un palacio nuevo herede recuerdos de otro.

## 7. Reglas para tocar esta parte

- La lógica vive en `model.ts` y `keys.ts`, puras y con tests. No pongas reglas de memoria dentro de componentes.
- Si cambias una constante (umbral, factor 2.5, 0.3 días), actualiza este documento y `model.test.ts`.
- Nunca borres la memoria al desmarcar ni al cambiar el examen. Es progreso del usuario.
- Valida todo lo que sale de `localStorage` (`sanitizePalaces`, `sanitizeConcept`), nunca lo confíes.
