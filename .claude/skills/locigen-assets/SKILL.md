---
name: locigen-assets
description: Reglas para reutilizar assets y código prehechos en LociGen en vez de construir desde cero. Usar al agregar o modificar modelos 3D, props, texturas, HDRI, audio o un fork de galería, y cuando el usuario diga "agrega un pedestal", "busca un modelo", "textura", "licencia", "optimiza el GLB", "ASSETS.md" o "fork de galería".
---

# LociGen: assets prehechos

Principio rector: reutilizar y modificar; construir desde cero solo lo que no existe.

## Paso 1: decidir de dónde sale (orden fijo)

1. ¿Ya está en el repo (`public/models`, `ASSETS.md`)? Reutilizarlo.
2. ¿Existe en un pack CC0 (Kenney, KayKit, Poly Haven, ambientCG)? Descargarlo y adaptarlo.
3. ¿Se resuelve con cajas y texturas PBR (paredes, suelo, techo)? Hacerlo procedural.
4. Solo si nada de lo anterior sirve, construirlo desde cero.

Nunca generar modelos 3D con IA en el MVP (USD 0.20–0.60 cada uno, más normalización y compresión).

## Paso 2: reglas de estilo y peso

- Un solo estilo: **low-poly estilizado + neón**. No mezclar texturas fotorrealistas con modelos estilizados.
- Máximo 8–12 props únicos (pedestal, banco, planta, columna, lámpara, marco).
- Presupuesto *(est.)*: ≤ 300 KB por prop optimizado y ≤ 5 MB de assets estáticos en total. Texturas a 512–1K.
- Recolorear materiales y normalizar escala en vez de buscar otro modelo.
- Autoalojar HDRI, fuentes y texturas en el proyecto; ninguna CDN externa durante la demo.

## Paso 3: licencias

| Fuente | Licencia | Acción |
|---|---|---|
| Kenney, KayKit, Poly Haven, ambientCG | CC0 | Usar; verificar cada pack |
| Quaternius (contenido nuevo) | Quaternius Asset Licence (QAL v1.0) | Leer la licencia antes de usar |
| Poly Pizza | Mayormente CC-BY | Exige atribución; evitar salvo necesidad |

## Paso 4: pipeline de cada asset

1. Registrar en `ASSETS.md` antes de usarlo.
2. Optimizar: `npx gltf-transform optimize in.glb out.glb` con compresión meshopt y texturas WebP (confirmar flags con `--help`).
3. Copiar a `public/models`.
4. Generar el componente tipado con `npx gltfjsx out.glb --types`.
5. Instanciar con `Instances` de drei los objetos repetidos.
6. Medir draw calls (ver `locigen-3d-validation`). Si pasan el presupuesto, volver al paso 2.

## Paso 5: evaluar forks de galería (primera hora)

Candidatos (no revisados): `cynthiachiu/3D-Art-Gallery`, `HashashinMaster/art-gallery`. Criterios de go/no-go: licencia MIT, versión de R3F compatible, código limpio y layout reemplazable por el generador de salas. Si no sirven, partir de una plantilla first-person con `PointerLockControls` de drei y no perder más tiempo.

## Formato de `ASSETS.md`

```
| Nombre | Fuente | URL | Licencia | Fecha | Modificado |
|---|---|---|---|---|---|
| pedestal | Kenney | <url> | CC0 | 2026-10-24 | recolor + escala |
```
