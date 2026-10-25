# Auditoría de Seguridad, Resiliencia y Fallbacks Desacoplados

> **Mus3o 3D** — Platanus Hack 26  
> **Fecha:** 2026-10-24  
> **Estado:** Evaluación de Riesgos Medios y Delicados con Soluciones Arquitectónicas  

---

## 1. Alcance y Filosofía

Esta auditoría técnica aborda aquellos escenarios de falla de **severidad media y delicada** que no deben resolverse con parches cosméticos dentro del flujo feliz, sino a través de **mecanismos de degradación elegante (graceful degradation)** y **fallbacks desacoplados**.

La premisa central del sistema es:
> *Ningún fallo de red, saturación de GPU o indisponibilidad de proveedores externos (Anthropic, ElevenLabs, Wikimedia, Poly Pizza) debe colgar la aplicación ni romper la experiencia inmersiva del usuario.*

---

## 2. Matriz de Riesgos Delicados y Soluciones Propuestas

| # | Área | Severidad | Problema | Impacto | Solución Propuesta (Fallback Desacoplado) |
|---|------|-----------|----------|---------|-------------------------------------------|
| 1 | **WebGL / 3D** | 🟠 Media/Delicada | Pérdida de contexto WebGL (`webglcontextlost`) por sobrecarga de GPU o cambio de pestaña | Pantalla negra irrecuperable en el canvas 3D | Listener global de contexto con recarga reactiva de escena y modo "bajo rendimiento" |
| 2 | **Wikimedia CDN** | 🟠 Media | Límite de tasa (HTTP 429) e IP ban temporal durante demos concurrentes | Cuadros sin imagen o demoras en cascada | Semilla local ampliada (`seed/images`) y renderizado procedural de óleos con CSS/Canvas |
| 3 | **Persistencia Render** | 🟡 Media | Disco efímero en planes estándar de Render reinicia la caché (`.cache/*`) en cada deploy | Costo redundante en tokens de IA y descargas repetidas de `.glb` | Declaración de volumen persistente (`Render Disk`) montado en `/var/data` |
| 4 | **Voz / Dictado** | 🟡 Media | Falta de soporte de `SpeechRecognition` en Firefox y Safari | Entrada por micrófono deshabilitada en evaluadores no-Chromium | Fallback desacoplado con MediaRecorder + transcripción local ligera |
| 5 | **IA Upstream** | 🟠 Delicada | Timeout o indisponibilidad de la API de Anthropic (picos de 120s) | Error 502 / 503 tras larga espera de generación | Fallback desacoplado a generación procedural local con temario heurístico |

---

## 3. Análisis Detallado de Problemas Delicados

---

### 3.1. [Delicado] Pérdida de Contexto WebGL (`webglcontextlost`) en Escenas 3D Complejas

#### Diagnóstico del Problema
El palacio 3D y los dioramas combinan mallas Three.js, geometrías procedurales, iluminación dinámica con sombras (`castShadow`/`receiveShadow`), textos con `Troika` y modelos `.glb`. En dispositivos con GPUs integradas o al alternar entre pestañas en Chrome/Safari, el navegador puede forzar un evento `webglcontextlost` para liberar memoria de video.
Actualmente, el componente `<Canvas>` de `@react-three/fiber` en `apps/web/src/App.tsx` no implementa un manejador explícito de restauración de contexto, lo que provoca que el canvas quede permanentemente congelado o en negro.

> **Actualización:** con la clave de ElevenLabs configurada, el dictado usa Scribe en tiempo real (ver [voz.md](./voz.md)) y funciona también en Firefox y Safari; el dictado del navegador queda como respaldo.

#### Solución Propuesta
Implementar un hook y componente desacoplado `ContextLossHandler`:

```tsx
// apps/web/src/scene/ContextLossHandler.tsx
import { useThree } from '@react-three/fiber'
import { useEffect, useState } from 'react'

export function ContextLossHandler({ onRecovery }: { onRecovery?: () => void }) {
  const { gl } = useThree()
  const [lost, setLost] = useState(false)

  useEffect(() => {
    const canvas = gl.domElement

    const handleLoss = (event: Event) => {
      event.preventDefault()
      console.warn('WebGL context lost. Entering safe recovery mode...')
      setLost(true)
    }

    const handleRestore = () => {
      console.log('WebGL context restored successfully.')
      setLost(false)
      onRecovery?.()
    }

    canvas.addEventListener('webglcontextlost', handleLoss, false)
    canvas.addEventListener('webglcontextrestored', handleRestore, false)

    return () => {
      canvas.removeEventListener('webglcontextlost', handleLoss)
      canvas.removeEventListener('webglcontextrestored', handleRestore)
    }
  }, [gl, onRecovery])

  if (!lost) return null

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 text-white">
      <div className="text-center p-4 max-w-sm">
        <p className="font-semibold mb-2">Restableciendo vista 3D...</p>
        <p className="text-sm text-gray-300">La GPU liberó recursos temporales. Recuperando escena.</p>
      </div>
    </div>
  )
}
```

---

### 3.2. [Medio] Límite de Tasa en Wikimedia Commons durante Demostraciones Simultáneas

#### Diagnóstico del Problema
El servidor de Mus3o realiza peticiones a la API de Wikipedia y Wikimedia Commons para hidratar imágenes de dominio público en los cuadros de cada sala. Aunque el servidor cuenta con:
- User-Agent de contacto conforme a políticas de Wikimedia.
- Concurrencia limitada a 2 peticiones simultáneas.
- Manejo de cabeceras `Retry-After`.

Si durante la presentación en vivo 30 o más evaluadores acceden al mismo tiempo a temas no cacheados, todas las instancias compartirán la IP de salida de Render, arriesgando un bloqueo temporal HTTP 429 por parte del CDN de Wikimedia.

#### Solución Propuesta
1. **Fallback Visual Inmediato Desacoplado:** Si la consulta de imagen falla (HTTP 502/429/timeout), el cliente no muestra un cuadro roto ni vacío; dibuja un cuadro de estilo "óleo procedural" usando la paleta cromática del tema de la sala y el título de la pieza centrado tipográficamente.
2. **Pre-sembrado de Temas Clave:** Extender el script `apps/server/scripts/preload-images.ts` para precargar las 10 demos más probables en `apps/server/seed/images`, asegurando 0 llamadas salientes a Wikimedia durante la evaluación oficial.

---

### 3.3. [Medio] Almacenamiento Efímero en Despliegues Cloud (Render Disks)

#### Diagnóstico del Problema
Las instancias gratuitas y starter de Render operan con sistemas de archivos efímeros. Cuando el servicio entra en reposo (spin down tras 15 minutos) o se despliega una nueva versión, todo el contenido de `.cache/` se destruye.
Esto ocasiona que la primera consulta tras despertar el contenedor deba volver a pagar la generación del museo a Anthropic y volver a descargar los modelos `.glb` desde Poly Pizza.

#### Solución Propuesta
Configurar en `render.yaml` un disco persistente dedicado:

```yaml
services:
  - type: web
    name: mus3o-server
    env: node
    plan: starter
    disk:
      name: mus3o-cache
      mountPath: /var/data
      sizeGB: 1
    envVars:
      - key: MUSEUM_CACHE_DIR
        value: /var/data/museums
      - key: IMAGE_CACHE_DIR
        value: /var/data/images
      - key: ASSET_CACHE_DIR
        value: /var/data/assets
```

---

### 3.4. [Medio] Fallback de Voz en Navegadores sin `webkitSpeechRecognition`

#### Diagnóstico del Problema
`apps/web/src/lib/voice.ts` consulta `window.SpeechRecognition || window.webkitSpeechRecognition`. Esta API web es propietaria y solo está disponible de manera predeterminada en navegadores basados en Chromium (Chrome, Edge, Brave, Opera). Evaluadores en Firefox o Safari de escritorio no disponen de esta interfaz, impidiéndoles interactuar por voz con Aris.

#### Solución Propuesta
1. **Detección y Feedback Limpio:** Si `canListen()` retorna `false`, la interfaz de Aris (`ArisDialog.tsx`) no muestra el botón de micrófono como "deshabilitado sin explicación"; lo oculta u ofrece un tooltip educativo: *"Dictado por voz disponible en navegadores Chromium (Chrome/Edge). En este navegador utiliza el teclado."*
2. **Fallback Desacoplado de Grabación:** Implementar un fallback opcional con `MediaRecorder` que capture un audio comprimido WebM/Opus (soportado universalmente por Firefox/Safari) y lo envíe a un endpoint liviano `/api/transcribe` para resolver el texto sin depender del motor del navegador.

---

### 3.5. [Delicado] Estrategia de Mitigación ante Degradación de Anthropic API

#### Diagnóstico del Problema
La generación de museos mediante `askForJson` tiene un timeout de 120 segundos y 1 reintento. Si los servidores de Anthropic experimentan lentitud extrema o picos de latencia de red, el usuario puede esperar hasta 4 minutos antes de recibir un error 502.

#### Solución Propuesta (Fallback Desacoplado)
1. **Reducción Progresiva de Tokens y Timeout:**
   - Ajustar el timeout de la primera llamada a 35 segundos.
   - Si la llamada excede los 35 segundos, el servidor intenta una llamada de rescate con `FALLBACK_MODEL` (Haiku 5.5 con salida compacta DSL de ~1.500 tokens).
2. **Modo Rescate Procedural (Offline):**
   - Si ambos intentos fallan, el servidor responde con un museo construido localmente a partir de los apuntes usando el extractor de texto determinista y glifos procedurales, marcando `offlineGenerated: true` en los metadatos.
   - De este modo, el usuario siempre entra a un palacio navegable en menos de 10 segundos, garantizando la continuidad de la demo.

---

## 4. Resumen de Fallbacks Implementados en esta Sesión

1. **`DungeonAssetBoundary` (3D Error Boundary):**  
   Implementado en `apps/web/src/scene/DungeonAssets.tsx`. Si cualquier modelo `.gltf` de mazmorra falla en la red o está corrupto, la escena se degrada suavemente a mallas procedurales (`FallbackWall`, `FallbackFloor`), evitando el colapso del canvas Three.js.
2. **Desalojo LRU en Búsquedas de Poly Pizza:**  
   Implementado en `apps/server/src/polyPizza.ts`. El mapa en memoria `found` se mantiene acotado a 200 entradas, previniendo degradación de memoria RAM en el servidor.
3. **Escritura Atómica Serializada en `assetReview.ts`:**  
   Implementado con cola de promesas `queueSave` y temporales aleatorios `randomBytes`, previniendo pérdida de auditoría ante hidrataciones concurrentes.
4. **Liberación de Audio ObjectURLs en `voice.ts`:**  
   Implementado listener `onended` en instancias `Audio` para revocar inmediatamente los blobs creados con `URL.createObjectURL`.
5. **Aislamiento del Health Check de Render:**  
   Excluido `/api/health` de los límites de tasa de Express para asegurar que los probes de orquestación nunca reciban 429.
