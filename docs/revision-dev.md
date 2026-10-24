# Informe de Revisión Formal: Rama `dev`

> Fecha de auditoría: 2026-10-24  
> Rama auditada: `dev` (HEAD: `50095e7`)  
> Estado: ✅ **Todos los hallazgos resueltos y verificados con tests automatizados**  
> Veredicto inicial: ⚠️ **Aprobar con cambios** (5 hallazgos: 1 Mayor, 3 Menores, 1 Nit)  
> Veredicto final: ✅ **Aprobado sin observaciones pendientes**

---

## 1. Resumen Ejecutivo

La rama `dev` presenta una base de código sólida, con excelente disciplina arquitectónica en la gestión de costos de LLM (Haiku 5.5 con `thinking: disabled`, topes diarios y por sesión, prompt caching de Anthropic) y resiliencia en la interfaz 3D (degradación suave a modelos procedurales y glifos vía `ErrorBoundary`).

Todos los problemas técnicos identificados durante la auditoría fueron corregidos mediante commits atómicos y modulares, respaldados por tests unitarios y de integración end-to-end:
1. Condición de carrera en `assetReview.ts` eliminada mediante nombres temporales criptográficamente únicos (`randomBytes`) y cola de serialización de promesas (`queueSave`).
2. Fuga de memoria en `polyPizza.ts` resuelta limitando el mapa de caché a 200 entradas con desalojo LRU.
3. I/O síncrono en `cache.ts` migrado a llamadas asíncronas con escritura atómica segura, corrigiendo la creación accidental de directorios `undefined/`.
4. Soporte para seguimiento seguro de redirecciones CDN en `assetStore.ts` verificando que la URL final pertenezca al dominio permitido.
5. Validación estricta de esquema en `DynamicAssetSchema.sourceUrl` exigiendo protocolo HTTP/HTTPS, neutralizando vectores de XSS almacenado.
6. Bypass de límite de tasa para `/api/health`, protegiendo el uptime monitor de Render.
7. Corrección de degradación visual en `security.ts` permitiendo códigos hex de 3 a 8 caracteres.
8. Liberación de memoria de Object URLs de audio tras finalización de reproducción en `voice.ts`.
9. Fallback desacoplado con `DungeonAssetBoundary` para assets 3D de mazmorras.

---

## 2. Hallazgos Detallados y Estado de Resolución

### 1. 🟠 [Mayor] Condición de carrera en escritura de `review.json.tmp`
- **Ubicación:** [`apps/server/src/assetReview.ts:41-43`](file:///home/jr_g/Develop/platanus-hack-26-ve-team-5/apps/server/src/assetReview.ts#L41-L43)
- **Estado:** ✅ **RESUELTO** (Commit `78720ed`)
- **Problema:**  
  La función `save(map)` escribía en un archivo temporal de nombre fijo (`review.json.tmp`). Múltiples promesas concurrentes de post-hidratación competían por el mismo archivo produciendo colisiones y excepciones `EBUSY`/`ENOENT`.
- **Corrección aplicada:**  
  Uso de sufijo temporal único (`${file()}.${process.pid}.${randomBytes(4).toString("hex")}.tmp`) y serialización estricta de escrituras mediante cola de promesas `queueSave(map)`. Test unitario agregado verificando 12 escrituras concurrentes sin colisión.

---

### 2. 🟡 [Menor] Crecimiento no acotado de memoria en caché `found`
- **Ubicación:** [`apps/server/src/polyPizza.ts:119-136`](file:///home/jr_g/Develop/platanus-hack-26-ve-team-5/apps/server/src/polyPizza.ts#L119-L136)
- **Estado:** ✅ **RESUELTO** (Commit `646ca38`)
- **Problema:**  
  El mapa en memoria `found` acumulaba búsquedas indefinidamente sin límite de entradas ni desalojo.
- **Corrección aplicada:**  
  Tope de 200 entradas (`MAX_FOUND_ENTRIES`) con política de desalojo LRU al insertar nuevas claves. Test unitario agregado validando persistencia y reuso de resultados cacheados.

---

### 3. 🟡 [Menor] I/O síncrono en disco dentro de rutas Express
- **Ubicación:** [`apps/server/src/cache.ts:18-28`](file:///home/jr_g/Develop/platanus-hack-26-ve-team-5/apps/server/src/cache.ts#L18-L28)
- **Estado:** ✅ **RESUELTO** (Commit `8a8c355`)
- **Problema:**  
  `getCached` y `setCached` realizaban operaciones I/O síncronas bloqueando el event loop. Además, una asignación `process.env.MUSEUM_CACHE_DIR = prev` con `prev === undefined` convertía el valor en el string `"undefined"`, creando un directorio huérfano `undefined/` en la raíz del proyecto.
- **Corrección aplicada:**  
  Migración total a `node:fs/promises` (`readFile`, `writeFile`, `mkdir`, `rename`, `unlink`) con escritura atómica. Corrección del cleanup en `cache.test.ts` mediante `delete process.env.MUSEUM_CACHE_DIR` y eliminación del directorio huérfano.

---

### 4. 🟡 [Menor] Rigidez ante redirecciones HTTP legítimas de CDN
- **Ubicación:** [`apps/server/src/assetStore.ts:52`](file:///home/jr_g/Develop/platanus-hack-26-ve-team-5/apps/server/src/assetStore.ts#L52)
- **Estado:** ✅ **RESUELTO** (Commit `bd5a289`)
- **Problema:**  
  `redirect: "error"` fallaba ante redirecciones legítimas (301, 302, 307) a buckets o subdominios CDN (`static.poly.pizza`).
- **Corrección aplicada:**  
  Se habilitó `redirect: "follow"` con verificación posterior de destino seguro (`isAllowedDownload(res.url)`). Cancelación explícita del stream si el tamaño supera `MAX_ASSET_BYTES`. Test de seguridad anti-SSRF agregado.

---

### 5. 🔵 [Nit] Validación de esquema de URL en `sourceUrl`
- **Ubicación:** [`packages/shared/src/schema.ts:101`](file:///home/jr_g/Develop/platanus-hack-26-ve-team-5/packages/shared/src/schema.ts#L101)
- **Estado:** ✅ **RESUELTO** (Commit `c4b5d6c`)
- **Problema:**  
  `DynamicAssetSchema` no exigía protocolo en `sourceUrl`, permitiendo teóricamente esquemas maliciosos como `javascript:`.
- **Corrección aplicada:**  
  Refuerzo con `z.string().url().max(300).refine((u) => /^https?:\/\//i.test(u))`. Test agregado descartando URLs no seguras o `javascript:` sin romper el museo.

---

## 3. Plan de Mitigación Recomendado

1. **Paso 1 (Prioridad Alta):** Corregir la concurrencia en `apps/server/src/assetReview.ts` agregando `randomBytes` en temporales y cola de escritura.
2. **Paso 2 (Prioridad Media):** Limitar la memoria en `apps/server/src/polyPizza.ts` agregando desalojo LRU al mapa `found`.
3. **Paso 3 (Prioridad Media):** Asincronizar lectura y escritura de caché en `apps/server/src/cache.ts`.
4. **Paso 4 (Prioridad Baja):** Mejorar el manejo de redirecciones en `apps/server/src/assetStore.ts` y validar URL en `packages/shared/src/schema.ts`.
