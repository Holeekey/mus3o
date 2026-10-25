# Voz natural (ElevenLabs)

La voz de Aris y del narrador usa **ElevenLabs** si el servidor tiene clave, y la voz del navegador
si no. El dictado del examen usa **ElevenLabs Scribe en tiempo real**, con el reconocimiento del
navegador como respaldo. Todo es opcional: sin clave funciona igual, solo suena más genérico.

Código: servidor `apps/server/src/tts.ts` y `stt.ts`, cliente `apps/web/src/lib/voice.ts` y `scribe.ts`,
adaptador de Aris `apps/web/src/palace/arisAudio.ts`.

## Cómo funciona

```
Navegador                       Servidor (proxy)                 ElevenLabs
lib/voice.ts  ── GET /api/tts/status ──▶ { enabled }   (una vez por carga de página)
              ── POST /api/tts {text} ─▶ valida, descuenta tope ─▶ text-to-speech/{voz}
              ◀── audio/mpeg ─────────── (sin caché)  ◀────────────── mp3
```

- La clave vive **solo en el servidor**. El navegador nunca la ve ni la recibe.
- Si `status` dice `enabled: false`, el cliente ni intenta `/api/tts` y usa la voz del navegador.
- Si la petición falla, devuelve error o tarda más de **2,5 s**, el cliente cae a la voz del navegador
  (`REMOTE_TIMEOUT_MS` en `lib/voice.ts`). Si la frase se cancela mientras espera, no hay fallback.
- Aris limpia el texto antes de hablar (quita el prefijo `Aris:`, markdown y URLs) y usa pitch 1.25 /
  rate 1.05 en el fallback del navegador.

## Configurar la clave, el modelo y la voz

Las variables se leen del `.env` de la **raíz del repo** (`apps/server/src/loadEnv.ts`; lo ya definido
en el entorno manda sobre el archivo). `.env` está ignorado por git; la plantilla es `.env.example`.

```bash
cp .env.example .env     # solo si aún no existe
```

La clave se crea en <https://elevenlabs.io/app/developers/api-keys> (**Create API Key**; se muestra
completa una sola vez). Si la pantalla lo permite, restríngela a los permisos **Text to Speech** (voz) y
**Speech to Text** (dictado); el resto déjalo en No Access.

Edita estas líneas del `.env`:

```bash
ELEVENLABS_API_KEY=sk_...                  # clave de la cuenta (obligatoria para activar la voz)
ELEVENLABS_VOICE_ID=                       # id de la voz; vacío = voz por defecto
ELEVENLABS_MODEL=eleven_multilingual_v2    # modelo de síntesis
MAX_DAILY_TTS_CHARS=30000                  # tope diario de caracteres enviados a ElevenLabs
ELEVENLABS_STT_MODEL=scribe_v2_realtime    # modelo del dictado en tiempo real
MAX_DAILY_STT_SESSIONS=300                 # tope diario de sesiones de dictado
```

**Reinicia el servidor** tras cambiar el `.env` (el modo `watch` solo vigila `src/`) y **recarga la
página**: el cliente guarda el resultado de `/api/tts/status` mientras la página está abierta.

| Variable | Obligatoria | Por defecto | Notas |
|---|---|---|---|
| `ELEVENLABS_API_KEY` | Sí, para activar | — | Sin ella: `status` devuelve `enabled: false` y `POST /api/tts` responde 503. |
| `ELEVENLABS_VOICE_ID` | No | `EXAVITQu4vr4xnSDxMaL` | Debe ser alfanumérico de 10-40 caracteres; si no cumple, se usa la de por defecto sin avisar. |
| `ELEVENLABS_MODEL` | No | `eleven_multilingual_v2` | Cualquier id de modelo TTS de ElevenLabs. Para menos latencia prueba uno "flash"; cambia el costo y la calidad, mídelo antes de adoptarlo. |
| `MAX_DAILY_TTS_CHARS` | No | `30000` | Al agotarse responde 429 y el cliente usa la voz del navegador hasta el día siguiente (UTC). |
| `ELEVENLABS_STT_MODEL` | No | `scribe_v2_realtime` | Modelo del dictado. Debe coincidir con `[a-z0-9_]{3,40}`; si no, se usa el de por defecto. Hay variantes `_turbo` y `_lite`; mídelas antes de adoptarlas. |
| `MAX_DAILY_STT_SESSIONS` | No | `300` | Cada sesión es un token de un solo uso. Al agotarse responde 429 y el cliente usa el dictado del navegador. |

### Elegir la voz

1. En ElevenLabs entra a **Voices**, elige una (conviene una multilingüe que hable bien español).
2. Copia su **Voice ID** y pégalo en `ELEVENLABS_VOICE_ID`.
3. Reinicia el servidor y prueba con la verificación de abajo.

Valores fijos en el código (no configurables por entorno): formato `mp3_44100_64`, texto de 1-500
caracteres, timeout del proveedor de 15 s.

### En producción (Render)

Define las mismas variables en el panel del servicio (**Environment**), nunca en el repo ni con prefijo
`VITE_`. Ver [deployment-render.md](./deployment-render.md).

## Dictado (speech-to-text)

El examen por voz (`ExamCard`) escucha con **Scribe en tiempo real** y mantiene el contrato de `listen()`:
texto parcial mientras hablas (`onInterim`), frase confirmada (`onFinal`) y códigos de error (`onError`).

```
Navegador                                  Servidor                         ElevenLabs
lib/voice.ts ── POST /api/stt/token ─────▶ mintea token de un solo uso ───▶ single-use-token
             ◀── { token, modelId } ─────
lib/scribe.ts ═══ websocket + audio del micrófono (con el token) ══════════▶ Scribe realtime
             ◀═══ parciales y frase confirmada (corta sola tras ~0,8 s de silencio) ═══
```

- **El audio no pasa por nuestro servidor**: va del navegador a ElevenLabs. El servidor solo entrega el token.
- `lib/scribe.ts` se carga bajo demanda (`import()`), así el SDK `@elevenlabs/client` no pesa en el bundle inicial.
- **Contexto del museo:** se pasan como `keyterms` los títulos de los conceptos (primero los de la sala del
  concepto, luego los demás; máximo 50 de hasta 20 caracteres, los más largos se omiten). Incluye todos, no solo
  la respuesta, para no favorecer a la correcta. Ayuda a reconocer nombres propios y términos técnicos del museo.
- **Respaldo:** si no hay clave, el tope diario se agotó, falla el token o la conexión, o el SDK no carga antes de
  oír una frase, se sigue con el dictado del navegador. Sin permiso de micrófono no hay respaldo posible y se
  avisa `not-allowed` (la tarjeta pasa a escribir). Si pasan 10 s sin una frase confirmada, se da por "no se oyó".
- `canListen()` ahora es true también en navegadores sin `SpeechRecognition` (Firefox, Safari) cuando el
  servidor tiene dictado remoto y hay micrófono. El estado se consulta al cargar la página (`warmVoice()`).
- Solo devuelve una transcripción (el del navegador daba hasta 5 alternativas).

## Verificar que funciona

Con el servidor levantado (`npm run dev`, puerto 3001):

```bash
curl -s localhost:3001/api/tts/status
# {"enabled":true}

curl -s -X POST localhost:3001/api/tts \
  -H 'content-type: application/json' \
  -d '{"text":"Hola, soy Aris, tu guía del palacio."}' \
  -o /tmp/aris.mp3 -w '%{http_code} %{content_type} %{time_total}s\n'
# 200 audio/mpeg 0.9s   (el tiempo es orientativo)

curl -s localhost:3001/api/stt/status        # {"enabled":true}
curl -s -X POST localhost:3001/api/stt/token # {"token":"...","modelId":"scribe_v2_realtime"}
```

Reproduce `/tmp/aris.mp3` para oír la voz. El dictado solo se prueba de verdad en el navegador (micrófono):
abre un examen y comprueba que aparece el texto mientras hablas. En el navegador, abre la app, pide ayuda a Aris y comprueba
en la pestaña Network que `POST /api/tts` responde 200 y suena audio.

## Límites y respuestas

| Capa | Límite | Qué pasa al superarlo |
|---|---|---|
| Rate limit | 30 peticiones/min por IP en `/api/tts` | 429 `Demasiadas solicitudes de voz`; el cliente cae al navegador |
| Tope diario | `MAX_DAILY_TTS_CHARS` caracteres por día | 429 con `fallback: "browser"` |
| Texto | 1-500 caracteres, cuerpo `.strict()` | 400 |
| Proveedor | 15 s en el servidor | 502 con `fallback: "browser"` |
| Rate limit del dictado | 20 peticiones/min por IP en `/api/stt` | 429; el cliente usa el dictado del navegador |
| Tope diario del dictado | `MAX_DAILY_STT_SESSIONS` sesiones por día | 429 con `fallback: "browser"` |
| Cliente | 2,5 s hasta tener el audio | Cae a la voz del navegador |

El cuerpo de error de ElevenLabs nunca se reenvía al cliente; en el log del servidor solo queda el
código HTTP (`tts falló: HTTP 401`). Más sobre el diseño en [seguridad.md](./seguridad.md).

## Problemas comunes

| Síntoma | Causa probable | Qué hacer |
|---|---|---|
| Suena siempre la voz del navegador | `status` en `false`: falta la clave o no reiniciaste el servidor | Revisa `ELEVENLABS_API_KEY`, reinicia y recarga la página |
| `tts falló: HTTP 401` en el log | Clave inválida o sin permisos de TTS | Genera otra clave en ElevenLabs |
| `tts falló: HTTP 402/429` en el log | Sin créditos o límite de la cuenta de ElevenLabs | Revisa el plan y el saldo |
| Otra voz distinta a la elegida | `ELEVENLABS_VOICE_ID` con formato inválido (se ignora) | Copia el id completo, sin espacios ni comillas |
| Silencio de 2-3 s antes de la voz del navegador | ElevenLabs tardó más de 2,5 s | Prueba un modelo más rápido o una región con mejor latencia |
| No suena nada en el primer clic | Política de autoplay del navegador | Requiere una interacción previa del usuario |
| El dictado siempre usa el navegador | `/api/stt/status` en `false`, o la clave sin permiso **Speech to Text** | Revisa la clave y los permisos; mira el log (`stt token falló: HTTP 401 (...)`) |
| `stt token falló: HTTP 401 (missing_permissions)` | La clave no tiene Speech to Text | Edita la clave en ElevenLabs y actívalo |
| El texto del examen no aparece en vivo | Se cayó al dictado del navegador (Firefox/Safari no lo tienen) | Revisa Network: `POST /api/stt/token` debe dar 200 y abrirse un websocket |
