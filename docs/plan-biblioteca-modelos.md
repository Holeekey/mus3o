# Plan: biblioteca propia de modelos (que cada museo salga mejor y más barato)

Objetivo: que los objetos de los pedestales sean reconocibles y que el dibujo con IA se pague **una vez por objeto**, no una vez por museo.

## 1. Punto de partida (medido el 2026-10-25)

Problema: con Poly Pizza bloqueado (403 de Cloudflare), los pedestales dependían de Haiku, que dibuja bloques abstractos y oscuros. Se midió el dibujo de los mismos 12 objetos con el prompt de respaldo actual:

| Variante | Tokens de salida | Tiempo | Costo (12 piezas) | Costo por pieza |
|---|---|---|---|---|
| Haiku 5.5 (sin razonamiento) | 3.124 | 11 s | $0,0016 | $0,00014 |
| Sonnet 5.5 (`between_tools`, sin razonamiento previo) | 3.903 | 22 s | $0,0405 | $0,0034 |
| Sonnet 5.5 (razonamiento por defecto) | 3.526 | 21 s | $0,0368 | $0,0031 |

- **Sonnet no sale más barato por pieza: cuesta unas 25 veces más** (mismos tokens, tarifa 20× mayor). Pasar el respaldo de cada museo a Sonnet sumaría ~$0,06 por museo de 18 piezas sobre los ~$0,036 actuales.
- **Sonnet dibuja claramente mejor** (revisión visual lado a lado): objetos reconocibles (yunque, guante, pulpo con ojos, tobogán, botella con etiqueta); Haiku da formas pequeñas y simples.
- **Conclusión:** el ahorro está en dibujar con Sonnet **una sola vez** y guardar el resultado en la biblioteca. Un objeto sembrado cuesta $0,0034 y después es gratis en todos los museos.

## 2. Hecho en este PR

- Biblioteca propia (`library.ts`, PR #86): se consulta antes que Poly Pizza y que cualquier respaldo; cola de revisión; CLI y rutas de depuración.
- **Semilla de 80 objetos** dibujados con Sonnet (`seed/library/index.json`, aprobados, origen `ai`): palabras clave reales vistas en museos generados (zipper aparte: se descartó) más objetos cotidianos y educativos. 92 dibujados por $0,29; se descartaron 12 tras revisión visual (corona, arco, pirámide, bicicleta, teléfono, cremallera, hongo, péndulo, resorte, polea, prisma, balanza) y entraron 80. Lista: `seed/library/keywords.txt`.
- Herramientas: `npm run library:draw` (dibuja con Sonnet y avisa el costo) y `library import <json>` (alta en lote, aprobada).
- Test de integridad de la semilla (`librarySeed.test.ts`).

## 3. Fases siguientes

| # | Fase | Qué se hace | Hecho cuando |
|---|---|---|---|
| 1 | **Separar lo pendiente de lo curado** | Hoy cada generación local escribe entradas `pending` en `seed/library/index.json` (versionado) y ensucia git. Mover pendientes y contadores de uso (`uses`, que también reescriben el índice en cada generación) a `state.json`/`pending.json` (ignorados por git); `approve` pasa las entradas al índice versionado. | `git status` limpio tras generar museos; los tests de `library.test.ts` siguen en verde. |
| 2 | **Medir cobertura** | Registrar por generación cuántas piezas resolvió la biblioteca, Poly Pizza, Haiku y el determinista. Comando `library gaps`: palabras clave que cayeron al respaldo, ordenadas por frecuencia. | Hay una tasa de aciertos de la biblioteca (objetivo inicial ≥ 40 %) y una lista de las 30 palabras más repetidas sin cobertura. |
| 3 | **Palanca principal: vocabulario controlado** | Incluir en el system prompt (cacheado) las palabras clave de la biblioteca y pedir a la IA que elija de ahí cuando encaje y proponga un objeto literal si no. Coste: ~300 tokens cacheados (~$0,00006 por museo). | La tasa de aciertos sube (objetivo ≥ 60 %) sin bajar la calidad de las mnemotecnias; revisar con 5 temas distintos. |
| 4 | **Ciclo de siembra periódico** | `library gaps` → `library:draw` con Sonnet sobre las 30–50 palabras principales → revisión visual → `library import`. Presupuesto: ~$0,0034 por objeto (50 objetos ≈ $0,17). | Una tanda por semana de pruebas o al cambiar de demo; cada tanda sube la tasa de aciertos. |
| 5 | **Galería de revisión visual** | Página de depuración (`?demo=biblioteca`) que dibuja la biblioteca en rejilla con etiqueta y botones aprobar / rechazar sobre `/api/library`. Hoy la revisión se hizo con una página temporal. | Se revisan 50 objetos en menos de 5 minutos sin tocar la terminal. |
| 6 | **`.glb` propios** | Pipeline para tus modelos de Blender: exportar `.glb`, comprimir (skill `gltf-compression`: texturas WebP 1024 px), `library add-glb`, Git LFS. Tienen prioridad sobre las recetas. | Cinco `.glb` propios en la biblioteca, cada uno ≤ 500 KB y verificado en el pedestal en navegador. |
| 7 | **Calidad del respaldo** | Mejorar el prompt de Haiku (paleta clara, grosor mínimo, proporciones) para el resto de la cola larga; el cliente ya ajusta tamaño y aclara colores oscuros (PR #87). Probar con el mismo conjunto de 12 objetos antes y después. | Revisión visual lado a lado mejora sin subir el costo por pieza por encima de $0,0003. |

## 4. Decisiones y riesgos

- **No usar Sonnet en línea para el respaldo por museo**: ~25× el costo por pieza. Solo para sembrar.
- **La cola larga nunca se cubre del todo**: la IA elige objetos metafóricos («zipper», «blowtorch»). La fase 3 (vocabulario controlado) es lo que más mueve la tasa de aciertos.
- **Calidad sin garantizar**: la semilla pasó revisión a ojo, no un criterio objetivo; algunos objetos son simples (dados, espada fina). Rechazar con `library reject <id>` y re-dibujar si molestan.
- **Producción**: el disco del servidor es efímero; lo aprobado vive en el repo (`seed/library`) y se despliega con el código. Los `.glb` pesan: LFS y ≤ 4 MB por archivo.
- **Costos**: tarifas de lista de Sonnet 5.5 ($2 / $10 por MTok) y Haiku 5.5 ($0,10 / $0,50); verificar en la consola de facturación.

## 5. Cómo operar hoy

```bash
# Ver qué hay
npm run library -w @mus3o/server -- list approved
# Dibujar objetos nuevos con Sonnet (pide aprobación de gasto: ~$0,0034 por objeto) y revisarlos
npm run library:draw -w @mus3o/server -- --keywords "kettle,violin case" --out /tmp/dibujos.json
# Importar lo bueno (entra aprobado) y verificar
npm run library -w @mus3o/server -- import /tmp/dibujos.json
```
