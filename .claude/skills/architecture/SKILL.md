---
name: architecture
description: Arquitectura mínima del proyecto (museo 3D a partir de apuntes): monorepo simple con frontend React + R3F y un servidor Express. Usar al tocar el servidor Express, sus endpoints, la caché, el contrato JSON de la estructura o el generador de layout, y cuando el usuario diga "servidor", "endpoint", "caché", "contrato", "generador de salas" o "layout".
---

# Arquitectura (versión mínima)

Monorepo simple: el frontend vive en `app/` (React + Vite + R3F) y el servidor es Express. Sin infraestructura extra: mantener todo lo más plano y barato posible.

## Principios

1. La clave de la API de Claude vive solo en el servidor, en variables de entorno. Nunca en `app/` ni en el repo.
2. Los documentos del usuario no se guardan: se procesan en memoria. Extraer el texto en el navegador y enviar solo texto.
3. Caché simple por hash (`sha256` del texto para estructuras). En memoria o en disco; no añadir base de datos ni servicios.
4. Cada generación tiene respaldo: si falla o se agota el tope, el frontend muestra un placeholder procedural.
5. Tope diario de generaciones y rate limit por IP en el servidor, para cuidar el presupuesto (ver `token-budget`).

## Endpoints mínimos

- `POST /api/structure`: recibe el texto y devuelve la estructura del palacio. Usa la caché por hash antes de llamar a Claude. Si el texto supera ~100k tokens, partirlo en bloques.
- Imágenes por concepto: solo si el equipo las incluye; proveedor por definir. Misma regla: caché por concepto normalizado (`trim`, minúsculas, sin tildes) y respuesta `429` con `{"fallback":"placeholder"}` al superar el tope.

## Contrato de estructura

La fuente de verdad es el código: `app/src/palace/schema.ts` (rama `feature/phase-1-core`, no revisada al escribir esta skill). Si el código y esta forma difieren, manda el código. Forma de referencia:

```json
{ "title": "string",
  "rooms": [ { "id": "r1", "title": "string", "color": "#4cc9f0",
    "concepts": [ { "id": "r1-c1", "label": "string", "summary": "una línea", "visualPrompt": "metáfora breve" } ] } ] }
```

- Salida compacta (la salida cuesta 5× la entrada): 30–50 conceptos como máximo, un resumen de una línea. El detalle se pide al hacer clic.
- Validar el JSON antes de guardarlo o devolverlo: al menos una sala, ids únicos, campos obligatorios. Si falla, reintentar una vez; si vuelve a fallar, devolver error.

## Layout

Función pura y determinista (misma entrada y semilla, mismo museo), en `app/src/palace/layout.ts`. Se prueba sin GPU (ver `3d-validation`). Galería lineal, colisiones AABB, sin Rapier.

## Antes de dar por terminado un cambio

- [ ] ¿La clave de Claude está solo en el servidor?
- [ ] ¿Hay caché antes de cada llamada a Claude?
- [ ] ¿Hay respaldo si falla la generación?
- [ ] ¿El layout sigue siendo una función pura con test?
