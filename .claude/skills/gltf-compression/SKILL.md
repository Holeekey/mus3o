---
name: gltf-compression
description: "Trigger: comprimir glb, optimizar 3d, gltf compression, reducir peso glb. Optimiza modelos GLTF/GLB reduciendo texturas a WebP 1024px y preservando calidad visual."
license: Apache-2.0
metadata:
  author: "antigravity"
  version: "1.0"
---

## Activation Contract

Activar siempre que el usuario solicite:
- Comprimir o aligerar un modelo 3D (.glb o .gltf).
- Reducir el peso de assets gráficos sin pérdida visible de fidelidad.
- Aplicar técnicas estilo consola / Nintendo de budgeting de texturas para web.

## Hard Rules

- **Nunca usar npm o npx**: Usar siempre `pnpm dlx @gltf-transform/cli`.
- **Backup obligatorio**: Antes de transformar un archivo original en el repo, asegurar un duplicado de seguridad (`*.backup.glb`) excluido de git.
- **Mantener integridad**: No aplicar simplificación destructiva de malla (`simplify`) a menos que el polycount supere los límites de render (e.g., >50k tris para props).
- **Normal maps protegidos**: Si se usa compresión lossy en texturas, la calidad nunca debe bajar de 80-85% para evitar banding en normales.

## Decision Gates

| Escenario | Estrategia recomendada | Comando / Pipeline |
|---|---|---|
| Web Three.js / R3F (Default) | WebP 1024px + Lanczos3 | `resize --width 1024 --height 1024` seguido de `webp --quality 85` |
| Low-end mobile / VRAM crítica | KTX2 / Basis Universal | `etc1s` o `uastc` (requiere `KTX2Loader` en runtime) |
| Malla pesada (>50k tris) | Draco o Meshopt | `draco` o `meshopt` |

## Execution Steps

1. **Inspeccionar anatomía del asset**:
   ```bash
   pnpm dlx @gltf-transform/cli inspect path/to/model.glb
   ```
   Identificar si el peso proviene de mallas (buffers de vértices) o de texturas (PNG/JPEG).

2. **Crear backup**:
   ```bash
   cp path/to/model.glb path/to/model.backup.glb
   ```

3. **Reescalar texturas a presupuesto (1024×1024)**:
   ```bash
   pnpm dlx @gltf-transform/cli resize input.glb /tmp/step_resized.glb --width 1024 --height 1024 --filter lanczos3
   ```

4. **Comprimir texturas a WebP**:
   ```bash
   pnpm dlx @gltf-transform/cli webp /tmp/step_resized.glb output.glb --quality 85
   ```

5. **Validar spec glTF**:
   ```bash
   pnpm dlx @gltf-transform/cli validate output.glb
   ```
   Confirmar 0 errores y verificar que el peso final cumpla con el objetivo (usualmente < 500 KB para props/compañeros).

6. **Limpieza**:
   Eliminar archivos temporales de `/tmp/`.

## Output Contract

Reportar siempre:
- Peso original vs. peso final resultante.
- Porcentaje exacto de reducción obtenido.
- Validación de spec y confirmación de que no se rompieron extensiones ni jerarquía de nodos.
