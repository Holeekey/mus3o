# Plan de Arquitectura: Integración de Assets 3D Dinámicos (Poly Pizza CC0/CC-BY)

## Resumen
Extensión de Mus3o para dotar a los pedestales de modelos 3D low-poly (.glb) de Poly Pizza vía resolución concurrente en backend (`Promise.allSettled`), proxy con streaming y caché local en disco (`.cache/assets/`), y renderizado normalizado con fallback determinista en React Three Fiber.

---

## Archivos a Crear
- `apps/server/src/polyPizza.ts`: Cliente de búsqueda contra Poly Pizza con filtro CC0 y fallback a CC-BY, resolución concurrente y timeout estricto de 2500 ms (`AbortController`).
- `apps/server/src/assetStore.ts`: Gestión de caché en disco (`.cache/assets/`) para binarios `.glb` con tope de 4 MB por modelo.
- `apps/server/src/assetRoutes.ts`: Router Express para `GET /api/assets/:assetId.glb` con cabeceras `Content-Type: model/gltf-binary` y `Cache-Control: public, max-age=31536000, immutable`.
- `apps/server/src/polyPizza.test.ts`: Pruebas unitarias de timeouts, fallbacks y filtrado de licencias.
- `apps/web/src/scene/DynamicTotem.tsx`: Componente wrapper en R3F con `useGLTF`, `scene.clone()`, `<Resize scale={0.7}>`, `<Center top>`, `<ErrorBoundary>` y fallback automático a geometrías procedurales.

---

## Archivos a Modificar
- `packages/shared/src/schema.ts`: Incorporación en `PieceSchema` de `searchKeyword` (string opcional) y `dynamicAsset` (`DynamicAssetSchema`).
- `apps/server/src/prompts.ts`: Regla para que Claude genere un sustantivo físico en inglés por pieza (`searchKeyword`).
- `apps/server/src/claude.ts`: Integración de la etapa de post-hidratación paralela previa al almacenamiento en caché LRU SHA-256.
- `apps/server/src/app.ts`: Registro del endpoint `/api/assets`.
- `apps/web/src/scene/Room.tsx`: Sustitución del modelo procedural/glifo directo por `<DynamicTotem>` en el pedestal.
- `apps/web/src/ui/ConceptCard.tsx`: Muestra de atribución/licencia para modelos `CC-BY`.

---

## Archivos No Modificados
- `apps/web/src/scene/Player.tsx`: Mantiene intacto el sistema de proximidad euclidiana `(p.x, p.z)`.
- `apps/web/src/palace/layout.ts`: Mantiene intacta la generación y posicionamiento de salas y pedestales.
- `apps/web/src/memory/`: Mantiene intacto el estado de repetición espaciada (`mus3o-memory-v1`).
- `packages/dungeon-core/`: Módulo desacoplado.

---

## Orden de Implementación
1. **Contrato de Datos (`packages/shared`):** Extender `PieceSchema` con `searchKeyword` y `dynamicAsset`.
2. **Prompts del Servidor (`apps/server`):** Añadir directiva de `searchKeyword` en `SYSTEM_PROMPT`.
3. **Servicio y Tests de Poly Pizza (`apps/server`):** Implementar `polyPizza.ts` y validar con `polyPizza.test.ts`.
4. **Proxy y Caché de Binarios (`apps/server`):** Implementar `assetStore.ts`, `assetRoutes.ts` y montar en `app.ts`.
5. **Hidratación en Pipeline (`apps/server`):** Conectar `hydrateMuseumAssets` en `claude.ts` antes del caché LRU.
6. **Componente R3F Normalizado (`apps/web`):** Implementar `DynamicTotem.tsx` y sustituir en `Room.tsx`.
7. **Atribución en UI (`apps/web`):** Añadir crédito en `ConceptCard.tsx` si aplica licencia `CC-BY`.
8. **Verificación Integral:** Ejecutar typecheck y tests en todo el monorepo.

---

## Riesgos y Mitigaciones
- **Latencia:** Timeout global de 2500 ms con `AbortController`; si Poly Pizza no responde a tiempo, se responde con fallback procedural sin degradar la experiencia.
- **Normalización 3D:** Uso de `<Resize scale={0.7}>` y `<Center top>` para asegurar dimensiones homogéneas y base en `Y = 0`.
- **Rendimiento:** Límite de 4 MB por asset y caché de larga duración en disco y navegador.
- **Aislamiento en Scene Graph:** Uso de `scene.clone()` para evitar mutaciones cruzadas en mallas compartidas.
- **Cuota de LocalStorage:** Almacenamiento exclusivo de URLs relativas en `mus3o-v1`, delegando los binarios al Disk Cache HTTP.
