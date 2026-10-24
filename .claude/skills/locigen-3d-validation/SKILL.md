---
name: locigen-3d-validation
description: Validación del museo 3D de LociGen en cuatro capas (lógica, rendimiento, visual, humana) y checklist previo a la demo. Usar al probar el generador de salas, medir draw calls o FPS, tomar capturas, revisar la escena antes de desplegar, y cuando el usuario diga "valida el 3D", "draw calls", "rendimiento", "captura", "tests del layout" o "listo para la demo".
---

# LociGen: validación del 3D

Ejecutar las capas en orden; cada una es más cara que la anterior.

## Capa A: lógica (Vitest, USD 0)

Tests sobre el generador de layout, sin GPU:

- Todas las salas son alcanzables desde la primera.
- No hay solapes entre salas.
- Las puertas están alineadas.
- N conceptos producen N cuadros.
- Ningún cuadro queda sobre el hueco de una puerta (margen libre alrededor de cada puerta).
- Ningún par de cuadros se solapa, incluida la sala de ancho mínimo (6 m) con 2 conceptos o más.
- Misma entrada y semilla producen el mismo layout.

## Capa B: rendimiento (USD 0)

Alcance: la demo es solo en escritorio. Presupuesto: menos de 300 draw calls. El presupuesto móvil (menos de 100) solo aplica si el equipo decide soportar móvil. Geometrías y texturas estables en el tiempo (sin fugas al cambiar de sala).

```ts
const { render, memory } = gl.info;
console.table({ drawCalls: render.calls, triangles: render.triangles,
                geometries: memory.geometries, textures: memory.textures });
```

Herramientas: `gl.info`, `Stats`, r3f-perf. El WebGL sin cabeza de Playwright no sirve para medir FPS; medir en un navegador real.

## Capa C: visual (~USD 0.05 por ronda *(est.)*)

1. Con Playwright, tomar 6–10 capturas desde posiciones fijas y con semilla fija.
2. Revisarlas con Claude en una sola llamada con todas las imágenes. Mejor aún, subirlas al chat de claude.ai para no gastar créditos de API.
3. Buscar: atravesar paredes, texto ilegible, materiales de estilos mezclados, cuadros sin textura.

## Capa D: humana (15 min, USD 0)

- No se atraviesan paredes al caminar.
- El texto se lee a 2 m.
- Hay estado de carga mientras llegan las imágenes.
- Probar en una laptop con GPU integrada.
- Presentar en escritorio; el control con ratón no es fiable en móviles y móvil está fuera de alcance.

## Checklist previo a la demo

- [ ] Palacios demo pre-generados y en caché de R2.
- [ ] Placeholder procedural verificado (simular cuota agotada).
- [ ] Desplegado en Cloudflare Pages y Worker; assets autoalojados.
- [ ] Capas A y B en verde; capa C revisada.
- [ ] Ensayo completo del recorrido.

## Reporte (formato fijo)

```
Capa A: OK | FALLA <detalle>
Capa B: draw calls <n>, triángulos <n>, geometrías <n>, texturas <n>
Capa C: <hallazgos o "sin hallazgos">
Capa D: <hallazgos o "pendiente">
Veredicto: LISTO | BLOQUEADO por <causa>
```
