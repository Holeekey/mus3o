---
name: locigen-architecture
description: Arquitectura, contratos de datos y reglas de costo del backend y del generador de salas de LociGen (museo 3D a partir de apuntes). Usar al trabajar en el Worker de Cloudflare, los endpoints /api/structure y /api/image, la caché en R2, Workers AI (FLUX), el prompt de estructura, el contrato JSON, el generador de layout o las colisiones, y cuando el usuario diga "worker", "caché", "imagen del cuadro", "contrato", "generador de salas" o "layout".
---

# LociGen: arquitectura

Flujo: frontend React + R3F (Cloudflare Pages) extrae texto en el navegador, llama al Worker, y el Worker usa Claude Haiku 5.5 para la estructura y Workers AI (FLUX.1 schnell) para las imágenes, con caché en R2.

## Principios (no negociables)

1. La clave de la API de Claude vive solo en el Worker, nunca en el frontend.
2. Los documentos del usuario no se guardan en el servidor: se procesan en memoria o quedan en el navegador (IndexedDB).
3. Caché indexada por hash: `sha256(texto)` para estructuras; `hash(concepto normalizado + estilo)` para imágenes.
4. Toda imagen tiene cadena de respaldo: caché, generación, placeholder procedural.
5. No usar KV como caché de imágenes (1.000 escrituras diarias gratis). Usar R2.
6. Rate limit por IP y tope diario de generación en el Worker (detalle en "Tope diario" abajo).
7. Las claves de caché nunca usan los ids de sala o concepto (`r1`, `c1`): solo hashes de contenido.

## Endpoints

- `POST /api/structure`: recibe el texto y su hash. Si hay estructura en R2, la devuelve; si no, llama a Claude con bloques menores a 100k tokens, guarda y devuelve.
- `GET /api/image`: por concepto. Caché en R2; si falla y hay cuota, FLUX a 512×512 y 4 pasos con sufijo de estilo fijo; si no hay cuota, placeholder procedural.

## Tope diario y normalización (propuestas, ajustar con pruebas)

- **Normalización del concepto** (la hace el Worker, una sola vez): `trim`, minúsculas, quitar tildes (NFD), colapsar espacios. Clave de imagen: `sha256(normalizado + "|" + STYLE_VERSION)`. El cliente envía la etiqueta tal cual.
- **Tope diario:** 150 imágenes nuevas por día (UTC), por debajo de las ~230 que cubre la cuota gratuita a 512² *(est.)*. Contador por día (`imgcount:YYYY-MM-DD`) en KV: 150 escrituras al día entra en el límite gratuito de 1.000 y la consistencia eventual es aceptable para un tope aproximado.
- **Al superar el tope:** el Worker responde `429` con `{"fallback":"placeholder"}` y el frontend dibuja el placeholder procedural. Las imágenes ya en caché se siguen sirviendo.
- Verificar en el panel de Cloudflare que la cuenta está en el plan gratuito de Workers AI; en un plan de pago el tope propio es la única protección de gasto.

## Contrato de estructura

```json
{
  "title": "string",
  "rooms": [
    { "id": "r1", "title": "string", "color": "#4cc9f0",
      "concepts": [
        { "id": "c1", "label": "string", "summary": "una línea", "visualPrompt": "metáfora visual breve" }
      ] }
  ]
}
```

Reglas de salida (la salida cuesta 5× la entrada): 30–50 conceptos como máximo, un resumen de una línea por concepto. El detalle se pide al hacer clic.

Validación antes de guardar en R2: JSON válido, al menos una sala, máximo 50 conceptos en total, campos obligatorios presentes y `color` hex. Los ids son únicos en todo el palacio (`r1`, `r1-c1`, `r1-c2`…). Si falla, reintentar una vez; si vuelve a fallar, devolver error y no guardar nada.

## Generador de layout

- Función pura y determinista: misma entrada y semilla, mismo museo. Se prueba sin GPU.
- Galería lineal: salas encadenadas por puertas alineadas en un eje.
- Tamaño de sala crece con el número de conceptos, por ejemplo `ancho = max(6, ceil(n / 2) * 2.5 + 2)` metros (propuesta, ajustar con pruebas).
- Cuadros repartidos por el perímetro con separación fija, sin cruzar puertas.
- Cada sala tiene color y una pieza distintiva propios (refuerza el método de loci).
- Colisiones: AABB contra los límites de cada sala. No usar Rapier en el MVP.

## Costos de referencia *(est.)*

- Imagen FLUX schnell: ~USD 0.0005 a 512², 4 pasos.
- Notebook mediano (100 páginas, 40 conceptos) con Haiku: ~USD 0.02–0.05.
- Plan gratuito de Workers AI: al agotar la cuota las operaciones fallan en vez de cobrar.
- Pre-generar y cachear los palacios de la demo el día anterior.

## Antes de dar por terminado un cambio

- [ ] ¿La clave de Claude sigue solo en el Worker?
- [ ] ¿Hay hash y caché antes de cada llamada a Claude o FLUX?
- [ ] ¿Existe respaldo (placeholder) si falla la generación?
- [ ] ¿El layout sigue siendo una función pura con test?
