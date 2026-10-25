# Modo VR (visor de teléfono tipo "VR Box" / Cardboard)

Recorrer el palacio con el teléfono dentro de un visor, sin mandos y casi siempre sin botón: todo se maneja con la
**mirada**. Si hay un mando Bluetooth (§2b) también se camina con su joystick. Código en `apps/web/src/vr/`. En escritorio sin WebXR el modo no existe (no se descarga ni se monta nada).

## 1. Dos caminos, elegidos solo

`vr/mode.ts#selectVrMode` decide al montar el botón "Ver en VR" (panel de pausa del HUD, `vr/VrButton.tsx`):

| Dispositivo | Camino | Qué hace |
|---|---|---|
| Navegador con `navigator.xr.isSessionSupported('immersive-vr')` (Chrome en Android) | **`xr`** | Sesión WebXR con `@react-three/xr` 6.6.32 (`vr/xrStore.ts`, `vr/XrBridge.tsx`). La cabeza la lleva el navegador |
| Móvil/tableta sin WebXR (iOS Safari, otros) | **`cardboard`** | Estéreo lado a lado (`THREE.StereoCamera`, `VrRuntime.tsx#renderStereo`) y giro de cabeza con `DeviceOrientation` (`vr/head.ts`) |
| Escritorio sin WebXR | `none` | Sin botón |

Parámetros de URL: `?vr=cardboard` fuerza el respaldo en escritorio (el ratón arrastrado simula la cabeza, WASD sigue
moviendo); `?vr=xr` fuerza WebXR (con el emulador de dispositivo de `@pmndrs/xr`, solo en `localhost`); `?vr=off` lo desactiva.

El módulo de WebXR (~150 kB) y la escena VR (`vr/VrScene.tsx`) se cargan con `lazy`, solo si el dispositivo ofrece algún camino.

### Cardboard en detalle

- Al tocar "Ver en VR" (dentro del gesto): permiso de sensores (`DeviceOrientationEvent.requestPermission()` en iOS),
  pantalla completa, bloqueo a horizontal (donde se pueda) y `wakeLock` de pantalla.
- Cámara a 1,7 m fija, sin balanceo (en un cuadro sigue la altura del terreno, suavizada). Resolución con DPR 1,0 (un iPhone tiene 3; `?vrdpr=` para probar otro), sin sombras, `far` 120 m.
- Calibración, corrección de lente, cabeza y comodidad: ver §1b.
- Si no hay sensores (permiso denegado o escritorio), se mira arrastrando.
- El HUD y el resto del DOM se ocultan (`vr/vr.css`); queda un botón ✕ abajo al centro para salir.

## 1b. Calibración, cabeza y comodidad (cardboard)

**Cabeza (`vr/head.ts`).** Sin ningún filtro de suavizado (un paso bajo añade retraso y marea). `DeviceOrientation` da la orientación absoluta pero a ~60 Hz y con retraso;
`devicemotion.rotationRate` (giroscopio) se integra entre eventos (`integrateGyro`) y cada evento de orientación corrige la deriva con un peso pequeño
(`GYRO_CORRECT` 0,06). Al componer el frame se predice 16 ms con el último giro medido (`PREDICT_S`). La pose se aplica en `useFrame`, no por estado de React.
Ángulo de pantalla: `screen.orientation.angle` (Safari 16.4+, Chrome) con respaldo `window.orientation` (iOS: -90 ≡ 270); horizontal izquierda (90) y derecha (270) están probados por separado.
`alpha` en iOS es relativo a un arranque arbitrario: se calibra al entrar y no se usa `webkitCompassHeading` (saltaría). Sin permiso de `devicemotion` (iOS pide ambos) se usa solo la orientación.

**Estéreo y lente (`vr/distort.ts`, `vr/calib.ts`).** Cada ojo se dibuja a una textura y una pasada corrige el barril: radio de origen = r·(1 + k1·r² + k2·r⁴), con r en unidades de media altura y zoom para que el borde vertical quede justo.
El centro de cada imagen se desplaza hacia el centro de la pantalla hasta caer sobre su lente (`lens`, mm del centro de la pantalla al centro de cada lente; ~32 mm en un VR Box, unos 20 px en un iPhone de 6,1" apaisado).
Los mm se pasan a píxeles con `mmPerPx` (0,1655 iPhone, 0,159 Android; aproximado, se afina con `?vrmm=`). Sin k1, k2 ni lens se dibuja directo, sin pasada extra. El ancho que se usa es el de `visualViewport`
(la barra de Safari y el indicador de inicio cambian el alto visible; el lienzo sigue a `--vr-w/--vr-h`). La app instalada (PWA, #83) no tiene barras.

| Preset | FOV | k1 | k2 | Lente |
|---|---|---|---|---|
| VR Box (por defecto) | 92° | 0,22 | 0,06 | 32 mm |
| Google Cardboard | 90° | 0,34 | 0,15 | 30 mm |
| Sin corrección | 85° | 0 | 0 | — |

Parámetros de URL (mandan sobre lo guardado): `?vrpreset=vrbox|cardboard|none` `?vrfov=` `?vripd=` (m, o mm si >1) `?vrk1=` `?vrk2=` `?vrlens=` (mm) `?vrmm=` `?vrdpr=` `?vrcomfort=0|1` `?vrshadows=1`.
Antes de entrar (panel de pausa, "Ajustar el visor") hay botones de preset y campos numéricos; se guardan en `localStorage` (`mus3o.vr.calib`). Dentro del visor, el botón ◐ (abajo, junto a ✕) pasa al siguiente preset desde fuera sin quitarse el visor.
**Los valores de los presets son estimaciones, no están medidos con un visor real**: se afinan en el teléfono.

**Comodidad (`vr/comfort.ts`, `vr/Vignette.tsx`).** "Modo cómodo" (activo por defecto, casilla en el panel de ajustes): marcha ~1,4 m/s en el palacio (~1,6 en el cuadro) en vez de 3,4, y viñeta (bordes negros, dibujada en la escena para que salga bien en cada ojo, en cardboard y en WebXR)
mientras se empuja el stick o justo tras un giro por pasos. El giro sigue siendo por pasos de 30°. Sombras apagadas y `far` a 120 m mientras dura la VR; `AdaptiveQuality` no actúa en VR.

**WebXR en Android.** Chrome usa el perfil de visor del SDK de Cardboard: si el predeterminado no encaja con el tuyo, al entrar en la sesión toca el engranaje de Cardboard y escanea el código QR del visor (muchos VR Box traen uno; si no, busca el perfil de tu modelo).
El botón "Ver en VR" muestra un aviso con esto cuando el camino es WebXR. No se descarga ninguna imagen de QR.

## 2. Interacción por mirada (ambos caminos)

Retícula al centro con un anillo que se llena en ~1,5 s (`vr/dwell.ts`, `vr/Reticle.tsx`). Cualquier pulsación (toque en
pantalla, Enter/Espacio, botón de un mando Bluetooth o `select` de WebXR) dispara al instante lo que se mira.

| Objetivo | Al sostener la mirada |
|---|---|
| Pedestal | Abre un panel 3D con título, explicación, anclaje o dato, fuente y "para saber más" (`vr/VrPanel.tsx`, `vr/panelText.ts`). Botones "Marcar memorizado" y "Cerrar"; se cierra solo si se aparta la mirada >55° durante 1,2 s |
| Suelo | Marcador verde (rojo si no se puede) y teletransporte con velo negro (`vr/teleport.ts#validateTeleport`: alcance, suelo existente, sin colliders ni muros en el trayecto). **Dentro de un cuadro** igual, con el terreno como suelo y las colisiones del cuadro (`diorama/walk.ts#validateDioramaTeleport`: límites, obstáculos, agua en el punto y en el trayecto, no sobre el marco de regreso) |
| Boca de pasillo | Cruza a la sala del otro lado (`teleport.ts#corridorEnds`, `doorDestination`); abre la compuerta si hay llave |
| Cuadro vivo | Entra al cuadro con el flujo existente (`dioramaRequest.enter`). Dentro, botón "Salir del cuadro" (mirar hacia abajo); se camina por mirada al suelo, con el stick o con las flechas |

Selección (`vr/gaze.ts#pickGazeTarget`): gana el objetivo más cercano; en empate manda el tipo (botón > pedestal/cuadro > puerta);
lo que tapa un muro no cuenta; el suelo solo si no hay nada antes.

## 2b. Mando y teclado (joystick)

Código en `vr/pad.ts` (matemática pura, con pruebas) y `VrRuntime.tsx#runPad`. Funciona en `xr` y en `cardboard`, y lee
`navigator.getGamepads()` cada frame (en una sesión WebXR, además, `XRInputSource.gamepad`). Pensado para el mando pequeño
del visor "VR Box"; un gamepad normal también sirve.

| Entrada | Acción |
|---|---|
| Stick, eje vertical (ejes 0/1; 2/3 si el único stick sale ahí) | Caminar adelante/atrás según hacia donde mira la cabeza (en el plano, sin cabeceo). Zona muerta 0,25, velocidad proporcional al empuje, 75 % de la de escritorio |
| Stick, eje horizontal (mando de **un** stick, esquema por defecto) | Giro por pasos de 30° con un golpe fuerte (>0,6). Enfriamiento de 300 ms y hay que volver al centro para girar otra vez. Un empuje diagonal que domina en vertical solo camina |
| Mando de **dos** sticks (4+ ejes, y se han movido los dos) | Cambia solo al esquema doble: el primer stick camina y se desplaza de lado; el horizontal del segundo gira 30° |
| Botón 0 (A / principal) | Seleccionar lo que se mira (como un toque) |
| Botón 1 (B / secundario) | "Aris, repite" (la tecla G del cuadro vivo, `guideStore#repeatGuide`); fuera de un cuadro no hace nada |
| Cualquier otro botón, Enter, Espacio, `MediaPlayPause` | Seleccionar |
| Mando en modo teclado: ↑ / W | Avanzar |
| ↓ / S | Retroceder |
| ← / → (o A / D) | Giro por pasos de 30° |

- Una pulsación = una acción (flanco de subida, con 250 ms de debounce y una sola acción por frame aunque el mando emita varios botones).
- Mientras se empuja el stick (y 0,4 s después) se suprime el teletransporte por mirada **al suelo**, para que caminar no dispare saltos; pedestales, puertas, cuadros y botones siguen igual.
- El movimiento no duplica lógica: en VR `scene/moveInput.ts#moveAxes` devuelve `vrRuntime.move` (lo escribe `runPad`) e ignora el teclado y el
  joystick táctil, así que `Player` (palacio: colliders, compuertas cerradas salvo exploración libre) y `DioramaRuntime` (dentro del cuadro: límites, obstáculos y agua)
  caminan con sus propias colisiones. El giro por pasos suma al `rig.yaw` (cardboard: la pose; WebXR: el espacio de referencia).
- Emparejar (típico, no garantizado, depende del modelo): mantener **@ + B** (o **@ + A**) para el modo juego (gamepad HID); en otros modos el mando sale como teclado o
  teclas multimedia (flechas, `MediaPlayPause`), que también están cubiertos. Si el navegador no ve el mando, mover un stick o pulsar un botón una vez
  (el Gamepad API no lo anuncia hasta entonces).
- Probar sin mando: `?vr=cardboard` en escritorio y flechas ↑↓←→. En escritorio con VR activa, WASD ya no desplaza de lado: W/S caminan y A/D giran.

## 3. Cómo encaja con el resto

- `VrRuntime.tsx` reparte cada frame en cuatro prioridades de `useFrame` (-999 foto de la pose, 0 lógica del juego, 1 integra
  lo que la lógica movió en el *rig* y procesa la mirada, 2 elementos visuales, 3 dibujado). Player, Aris y el diorama siguen
  moviendo la cámara como siempre y el *rig* absorbe esos cambios. En WebXR, mover el rig desplaza el espacio de referencia
  de la sesión (`vr/rig.ts#rigOffset`).
- Ediciones mínimas fuera de `vr/`: `scene/World.tsx` (monta `VrScene` si hay camino VR y quita `AdaptiveQuality` en VR),
  `scene/PortalPainting.tsx` y `diorama/DioramaRuntime.tsx` (en VR la ventana viva del cuadro y el marco de regreso no se
  dibujan: se muestrean en coordenadas de pantalla, no por ojo; las transiciones son cortas), `ui/Hud.tsx` (botón) y `App.tsx` (`VrOverlay`).
- Al entrar a VR el modo examen pasa a exploración (no se puede escribir la respuesta).
- Dentro del cuadro: `DioramaRuntime` publica `dioramaWalk.model` (cajas, agua, altura del terreno) y atiende `dioramaWalk.goto` (salto por mirada). En WebXR el movimiento sigue pasando por el *rig*: `diorama/walk.ts#rigForHead` es la relación (rig = cabeza objetivo − R(yaw)·cabeza física) y está probada; el bucle usa el delta equivalente de `VrRuntime`.
- Tests (`npm test -w @mus3o/web`): `vr/mode.test.ts`, `dwell.test.ts`, `gaze.test.ts`, `teleport.test.ts`, `head.test.ts`, `rig.test.ts`, `pad.test.ts`, `calib.test.ts`, `comfort.test.ts`, `diorama/walk.test.ts`.

## 4. Probar en el teléfono (HTTPS)

WebXR, los sensores de movimiento y la pantalla completa solo funcionan en contexto seguro (HTTPS o `localhost`).
Dos formas; ninguna cambia `npm run dev`.

**A. HTTPS en la red local** (mismo Wi‑Fi para PC y teléfono):

```bash
npm run dev:server          # terminal 1 (la API; el proxy /api de Vite apunta a localhost:3001)
npm run dev:https           # terminal 2: Vite con --host --mode https (@vitejs/plugin-basic-ssl)
```

Abre `https://<IP-del-PC>:5173/?demo=historia` en el teléfono (Vite imprime la URL "Network"). El certificado es autofirmado:
el navegador avisa y hay que aceptarlo ("Avanzado" → continuar). En Windows, permite Node en el firewall para redes privadas.

**B. Túnel de cloudflared** (sin certificados que aceptar, funciona fuera de la red local):

```bash
npm run dev:server          # terminal 1
npm run dev:tunnel          # terminal 2: Vite normal, pero acepta hosts *.trycloudflare.com
cloudflared tunnel --url http://localhost:5173    # terminal 3
```

`cloudflared` imprime una URL `https://….trycloudflare.com`; ábrela en el teléfono. Sin `dev:tunnel`, Vite responde
`Blocked request. This host is not allowed` (solo se permite ese dominio, y solo en ese modo).

### Con el visor

- **Android (Chrome):** abre la URL, entra al palacio ("Ver en VR" está en el panel de pausa, junto a "Editar apuntes"),
  toca "Ver en VR" y pon el teléfono en el visor. Con WebXR el navegador pide permisos y arranca la sesión.
- **iPhone (Safari):** igual; al tocar, Safari pide permiso de "movimiento y orientación": acepta. Gira el teléfono a horizontal
  (iOS no puede bloquearlo). No hay pantalla completa en iPhone: oculta la barra de Safari con "Aa" → "Ocultar barra de herramientas".

## 5. Límites conocidos

- Verificado en Chrome de escritorio con `?vr=cardboard` (capturas y simulación de mirada) y con el emulador de WebXR
  (inicio y fin de sesión, render). **No verificado en un teléfono real**: el movimiento por *rig* en WebXR solo está probado
  con una prueba unitaria de la matemática (el emulador ignora el desplazamiento del espacio de referencia).
- La corrección de lente y los presets no están medidos con un visor real (ver §1b). `mmPerPx` es aproximado.
- WebXR dentro de un cuadro: el emulador de escritorio no se pudo arrancar en esta revisión, así que el salto por mirada y la marcha en WebXR solo tienen la prueba unitaria de la matemática; hay que confirmarlos en el teléfono.
- El mando está probado con un gamepad simulado (`navigator.getGamepads` sustituido en Chrome de escritorio) y con pruebas unitarias; **no con el mando real de un VR Box**: qué ejes y botones expone cada modelo, y si Chrome de Android lo ve al emparejarlo, solo se confirma en el teléfono.
- Giro por pasos en WebXR: gira alrededor del origen del rig, no de la cabeza; con la cabeza lejos del centro del área el punto de vista se desplaza un poco.
- La ficha de examen y la entrada por voz no existen en VR.
- En cardboard, el giroscopio integrado se corrige despacio con la orientación del teléfono: puede derivar un poco con el tiempo (arrastrar con el dedo recentra).
