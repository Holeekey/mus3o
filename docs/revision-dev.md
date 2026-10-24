# Informe de Revisión Formal: Rama `dev`

> Fecha de auditoría: 2026-10-24  
> Rama auditada: `dev` (HEAD: `50095e7`)  
> Veredicto: ⚠️ **Aprobar con cambios** (5 hallazgos: 1 Mayor, 3 Menores, 1 Nit)

---

## 1. Resumen Ejecutivo

La rama `dev` presenta una base de código sólida, con excelente disciplina arquitectónica en la gestión de costos de LLM (Haiku 5.5 con `thinking: disabled`, topes diarios y por sesión, prompt caching de Anthropic) y resiliencia en la interfaz 3D (degradación suave a modelos procedurales y glifos vía `ErrorBoundary`).

No obstante, se identificaron problemas técnicos que requieren atención, destacando una condición de carrera en operaciones de archivos temporales durante la post-hidratación paralela de assets y potenciales fugas de memoria por mapas no acotados.

---

## 2. Hallazgos Detallados

### 1. 🟠 [Mayor] Condición de carrera en escritura de `review.json.tmp`
- **Ubicación:** [`apps/server/src/assetReview.ts:41-43`](file:///home/jr_g/Develop/platanus-hack-26-ve-team-5/apps/server/src/assetReview.ts#L41-L43)
- **Problema:**  
  La función `save(map)` escribe en un archivo temporal de nombre fijo:
  ```ts
  const tmp = `${file()}.tmp`;
  await writeFile(tmp, JSON.stringify([...map.values()], null, 2));
  await rename(tmp, file());
  ```
  En [`apps/server/src/polyPizza.ts:225-231`](file:///home/jr_g/Develop/platanus-hack-26-ve-team-5/apps/server/src/polyPizza.ts#L225-L231), `hydrateMuseumAssets` invoca `recordAssignment` en paralelo para todas las piezas del museo mediante `Promise.allSettled`. Múltiples promesas concurrentes escriben y renombran simultáneamente sobre la misma ruta `.tmp`, produciendo colisiones, pérdida de entradas de auditoría o excepciones `EBUSY`/`ENOENT`.
- **Corrección propuesta:**  
  Usar sufijo temporal aleatorio para el archivo temporal y serializar las operaciones de escritura mediante una promesa en cadena (queue / mutex simple):
  ```ts
  const tmp = `${file()}.${randomBytes(4).toString("hex")}.tmp`;
  ```

---

### 2. 🟡 [Menor] Crecimiento no acotado de memoria en caché `found`
- **Ubicación:** [`apps/server/src/polyPizza.ts:119-136`](file:///home/jr_g/Develop/platanus-hack-26-ve-team-5/apps/server/src/polyPizza.ts#L119-L136)
- **Problema:**  
  El mapa en memoria `found` almacena indefinidamente los resultados de búsqueda por palabra clave:
  ```ts
  const found = new Map<string, PolyCandidate[]>();
  ```
  A diferencia de [`apps/server/src/cache.ts`](file:///home/jr_g/Develop/platanus-hack-26-ve-team-5/apps/server/src/cache.ts) (`MAX_ENTRIES = 100`) y [`apps/server/src/arisHelp.ts`](file:///home/jr_g/Develop/platanus-hack-26-ve-team-5/apps/server/src/arisHelp.ts) (`CACHE_MAX = 200`), `found` no cuenta con política de desalojo (LRU) ni tamaño máximo, lo que degrada el consumo de RAM en instancias Node de larga ejecución.
- **Corrección propuesta:**  
  Acotar el mapa a un tamaño máximo (ej. 200 entradas) desalojando la clave más antigua (`found.delete(found.keys().next().value)`).

---

### 3. 🟡 [Menor] I/O síncrono en disco dentro de rutas Express
- **Ubicación:** [`apps/server/src/cache.ts:18-28`](file:///home/jr_g/Develop/platanus-hack-26-ve-team-5/apps/server/src/cache.ts#L18-L28)
- **Problema:**  
  `getCached` y `setCached` utilizan llamadas bloqueantes síncronas (`readFileSync`, `writeFileSync`, `mkdirSync`):
  ```ts
  const parsed = MuseumSchema.safeParse(JSON.parse(readFileSync(fileFor(k), "utf8")));
  ```
  Al ser invocadas dentro del ciclo de solicitud de `/api/generate-museum`, detienen el event loop principal de Node.js durante la lectura/escritura en disco, incrementando la latencia concurrente en sistemas con volúmenes montados o I/O lento (e.g. Render disks).
- **Corrección propuesta:**  
  Migrar a las versiones asíncronas de `node:fs/promises` (`readFile`, `writeFile`, `mkdir`).

---

### 4. 🟡 [Menor] Rigidez ante redirecciones HTTP legítimas de CDN
- **Ubicación:** [`apps/server/src/assetStore.ts:52`](file:///home/jr_g/Develop/platanus-hack-26-ve-team-5/apps/server/src/assetStore.ts#L52)
- **Problema:**  
  La descarga de binarios `.glb` impone `redirect: "error"`:
  ```ts
  const res = await fetch(downloadUrl, { signal, redirect: "error" });
  ```
  Si el host de descargas de Poly Pizza emite una redirección temporal legítima (301, 302, 307) hacia un bucket o subdominio de contenido estático (`static.poly.pizza`), la petición falla de inmediato considerándose una descarga fallida.
- **Corrección propuesta:**  
  Permitir seguimiento de redirección (`redirect: "follow"` o manual) validando que la URL destino cumpla con la lista permitida de `isAllowedDownload(res.url)`.

---

### 5. 🔵 [Nit] Validación de esquema de URL en `sourceUrl`
- **Ubicación:** [`packages/shared/src/schema.ts:101`](file:///home/jr_g/Develop/platanus-hack-26-ve-team-5/packages/shared/src/schema.ts#L101)
- **Problema:**  
  `DynamicAssetSchema` valida `sourceUrl` únicamente como `z.string().max(300)` sin exigir esquema de protocolo. En el HUD ([`apps/web/src/ui/Hud.tsx:65`](file:///home/jr_g/Develop/platanus-hack-26-ve-team-5/apps/web/src/ui/Hud.tsx#L65)), este valor se asigna directamente al atributo `href` de un enlace `<a>`.
- **Corrección propuesta:**  
  Reforzar el esquema en Zod exigiendo URL segura:
  ```ts
  sourceUrl: z.string().url().max(300)
  ```

---

## 3. Plan de Mitigación Recomendado

1. **Paso 1 (Prioridad Alta):** Corregir la concurrencia en `apps/server/src/assetReview.ts` agregando `randomBytes` en temporales y cola de escritura.
2. **Paso 2 (Prioridad Media):** Limitar la memoria en `apps/server/src/polyPizza.ts` agregando desalojo LRU al mapa `found`.
3. **Paso 3 (Prioridad Media):** Asincronizar lectura y escritura de caché en `apps/server/src/cache.ts`.
4. **Paso 4 (Prioridad Baja):** Mejorar el manejo de redirecciones en `apps/server/src/assetStore.ts` y validar URL en `packages/shared/src/schema.ts`.
