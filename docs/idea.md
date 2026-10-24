# Documento Técnico de Concepto y Arquitectura: mus3o (LociGen)

**Proyecto:** mus3o (NotebookLM 3D / Generador de Palacios de la Memoria)  
**Evento:** Platanus Hack 26  
**Fecha:** Octubre 2026  
**Estado:** Aprobado / En desarrollo  

---

## 1. Visión y Resumen Ejecutivo

**mus3o** es un generador web que transforma datasets estructurados y apuntes de estudio densos en un **museo o palacio 3D explorable en primera persona**, generado procedural y matemáticamente en tiempo real en el navegador.

Aprovechando la técnica mnemotécnica milenaria del **Método de Loci** (o Palacio de la Memoria), el sistema traslada la carga cognitiva de procesar texto plano bidimensional a la memoria espacial e hipocampal humana, permitiendo memorizar y relacionar conceptos complejos recorriendo salas y galerías virtuales.

---

## 2. El Problema vs. La Solución

### El problema real
Estudiar conceptos densos (sintaxis y gramáticas formales, estructuras de bases de datos, taxonomías científicas o variables de modelos de machine learning) mediante texto plano resulta ineficiente. La retención pasiva de listas y documentos lineales degrada rápidamente por sobrecarga cognitiva.

### La solución
Una plataforma donde cualquier apunte libre, temario o estructura de datos se convierte automáticamente en una arquitectura espacial interactiva:
- Las **categorías principales** se traducen en salas temáticas conectadas por pasillos o portales.
- Cada **concepto o término** se materializa en pedestales interactivos, cuadros informativos en muros y glifos procedurales 3D.
- El usuario recorre el espacio físico virtual con controles de primera persona (WASD + mouse), integrando orientación espacial con aprendizaje activo.

---

## 3. Fundamento Cognitivo: El Método de Loci

El **Método de Loci** es una técnica mnemotécnica documentada desde la Grecia clásica que asocia piezas de información abstracta a hitos arquitectónicos concretos a lo largo de una ruta espacial conocida. Al recorrer mentalmente esa ruta, la recuperación de información se dispara por asociación espacial.

**mus3o automatiza la construcción de ese espacio:**
1. **Extracción y Jerarquización:** Descompone el material de estudio en un grafo jerárquico de `Palacio -> Salas -> Conceptos / Ítems`.
2. **Materialización Espacial:** Calcula dimensiones euclidianas, muros, vanos de puertas y posiciones de exhibición óptimas.
3. **Consolidación Mnemotécnica:** Vincula texto explicativo, representaciones geométricas y evaluación interactiva (modo examen) dentro del mismo entorno.

---

## 4. Arquitectura y Pipeline de Datos

```
[ Usuario (Texto / JSON / CSV) ]
               │
               ▼
   [ apps/server (Express + Claude) ]
               │  - Sanitización & Truncamiento (<user_notes>)
               │  - Estructuración con prompts de bajo consumo
               │  - Validación estricta con esquema Zod (PalaceSchema)
               │  - Cache en memoria por hash de contenido
               ▼
     [ JSON Tipado (Palace) ]
               │
               ▼
     [ apps/web (R3F / Three.js) ]
               │  - Layout procedural matemático (parse.ts + layout.ts)
               │  - Generación de mallas (Suelo, Muros, Puertas, Pedestales)
               │  - Cámara & Controles FPS (PointerLockControls)
               │  - Minimapa 2D top-down sincronizado
               │  - HUD interactivo & Modo Examen
```

### 4.1 Entrada de datos
El sistema admite:
- **Texto libre o apuntes:** Notas de clase, resúmenes o transcripciones procesadas vía LLM.
- **Estructuras semánticas directas:** Archivos JSON estructurados según el contrato del palacio o CSVs categorizados.

### 4.2 Backend & Contrato de Dominio
- **Runtime:** Node.js + Express en TypeScript.
- **Motor de Inferencia:** Claude (Anthropic SDK) orquestado con prompts delimitados para neutralizar prompt injection (OWASP LLM01).
- **Contrato Zod:** Toda respuesta del modelo es validada contra `PalaceSchema` (`packages/shared/src/schema.ts`), garantizando que salas, títulos, conceptos y descripciones cumplan los límites geométricos y tipográficos antes de llegar al cliente.

### 4.3 Generación Procedural 3D en el Frontend
**Nivel de dificultad:** Cero modelado 3D manual. Todo el entorno tridimensional se computa en tiempo real:
- **Matemáticas de Layout:** Cálculo de planos euclidianos y coordenadas espaciales $(X, Y, Z)$ para cada sala y corredor sin colisiones entre volúmenes.
- **Primitivas de Render:** Creación dinámica de mallas con `<boxGeometry>` y `<planeGeometry>` de Three.js / React Three Fiber.
- **Colisiones y Detección:** AABB (Axis-Aligned Bounding Boxes) y cálculo de distancias radiales para interacción con piezas y restricciones de movimiento del jugador.

---

## 5. Experiencia Interactiva y Mecánicas de Usuario

1. **Navegación First-Person (FPS):**
   - Movimiento fluido mediante `WASD` / flechas y orientación con mouse (`PointerLockControls`).
   - Aceleración, desaceleración y amortiguación de cámara para evitar mareo cinético (*motion sickness*).
2. **Minimapa 2D Top-Down:**
   - Proyección cenital ortográfica que ubica en tiempo real la posición del jugador, salas recorridas y piezas pendientes por memorizar.
3. **Puntos de Interacción (Hotspots):**
   - Al aproximarse a un pedestal o cuadro mural, el HUD despliega la descripción ampliada y la relación conceptual del nodo.
4. **Modo Examen (Active Recall):**
   - Sistema de autoevaluación donde las etiquetas del palacio se ocultan o se convierten en preguntas interactivas para validar la retención antes de finalizar el recorrido.

---

## 6. Plan de Ejecución de 36 Horas (Hackathon Scope)

| Fase | Duración | Entregables Clave |
|---|---|---|
| **Fase 1: Lógica y Contrato** | 8 horas | Input de texto / JSON, parser jerárquico a árbol `Palace`, validadores Zod compartidos (`packages/shared`), suite de tests unitarios de layout. |
| **Fase 2: Generación 3D Procedural** | 16 horas | Componentes base de R3F (`World`, `Room`, `Shapes`, `ProceduralModel`), cálculo de offsets por sala, pórticos de conexión, iluminación y pedestales. |
| **Fase 3: Movimiento, Controles y UI** | 8 horas | Controlador `Player` en primera persona, gestión de pointer lock, Minimapa 2D en HUD, modal de detalles de exhibición. |
| **Fase 4: Pulido, Estética y Modo Examen** | 4 horas | Atmósfera lumínica neo-brutalista / cyberpunk, feedback visual de conceptos memorizados, integración del modo examen y validación de performance a 60 FPS. |
