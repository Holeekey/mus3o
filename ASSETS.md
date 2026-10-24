# Registro de Assets y Atribución

Este documento registra los assets externos incorporados al proyecto, sus fuentes, licencias y especificaciones binarias conforme al pipeline de assets.

> **Archivos Binarios (Git LFS)**: Todos los modelos 3D (`.bin`, `.gltf`, `.glb`, `.fbx`, `.obj`), texturas (`.png`, `.jpg`) y tipografías (`.ttf`) son archivos binarios pesados gestionados exclusivamente a través de **Git LFS**. Los agentes LLM y herramientas de análisis automático **nunca** deben intentar leer el contenido en crudo de estos archivos.

---

## Atribución y Créditos

| Nombre del Pack | Autor / Creador | Sitio Web | Licencia | Modificado en Repo |
|---|---|---|---|---|
| **KayKit: Dungeon Asset Pack (1.1)** | **Kay Lousberg** | [www.kaylousberg.com](https://www.kaylousberg.com) | [Creative Commons Zero (CC0)](https://creativecommons.org/publicdomain/zero/1.0/) | Extracción a `assets/kaykit_dungeon` y `apps/web/public/models/dungeon/` |
| **Public Sans** | U.S. Web Design System / Google Fonts | [Google Fonts](https://fonts.google.com/specimen/Public+Sans) | SIL Open Font License, 1.1 | Fuente variable autoalojada para toda la interfaz; licencia en `apps/web/public/fonts/PublicSans-OFL.txt` |
| **Gloock** | Veronica Burian, Lisandro Murphy | [Google Fonts](https://fonts.google.com/specimen/Gloock) | SIL Open Font License, 1.1 | Archivo conservado; reemplazada por Public Sans en la interfaz |
| **Hanken Grotesk** | Hanken Design Co. | [Google Fonts](https://fonts.google.com/specimen/Hanken+Grotesk) | SIL Open Font License, 1.1 | Archivo conservado; reemplazada por Public Sans en la interfaz |

---

## Detalle de Modelos Utilizados (KayKit Dungeon Pack)

| Modelo | Archivo Fuente | Formato | Tipo | Ubicación Web |
|---|---|---|---|---|
| Muro de mazmorra | `wall.gltf` / `wall.bin` | GLTF + Binario | Prop estructural | `/models/dungeon/wall.gltf` |
| Esquina de muro | `wall_corner.gltf` / `wall_corner.bin` | GLTF + Binario | Prop estructural | `/models/dungeon/wall_corner.gltf` |
| Arco y compuerta batiente | `wall_doorway.gltf` / `wall_doorway.bin` | GLTF + Binario | Prop interactivo | `/models/dungeon/wall_doorway.gltf` |
| Reja / Compuerta enrejada | `wall_gated.gltf` / `wall_gated.bin` | GLTF + Binario | Prop estructural | `/models/dungeon/wall_gated.gltf` |
| Baldosa grande de suelo | `floor_tile_large.gltf` / `floor_tile_large.bin` | GLTF + Binario | Suelo modular | `/models/dungeon/floor_tile_large.gltf` |
| Trampa de púas | `floor_tile_big_spikes.gltf` / `.bin` | GLTF + Binario | Obstáculo / Trampa | `/models/dungeon/floor_tile_big_spikes.gltf` |
| Llave de hierro | `key.gltf` / `key.bin` | GLTF + Binario | Item recolectable | `/models/dungeon/key.gltf` |
| Cofre del tesoro | `chest.gltf` / `chest.bin` | GLTF + Binario | Meta / Recompensa | `/models/dungeon/chest.gltf` |
| Atlas de textura | `dungeon_texture.png` | PNG Binario | Textura atlas | `/models/dungeon/dungeon_texture.png` |

---

## Modelos dinámicos (Poly Pizza)

Los modelos de los pedestales pueden venir de [Poly Pizza](https://poly.pizza) en tiempo de generación (no están en el repo): el servidor los busca por `searchKeyword`, solo con licencia **CC0** o **CC-BY** (se descartan NC/ND/SA), los guarda en `.cache/assets/` (ignorada por git) y los sirve en `/api/assets/<id>.glb`. Cada asignación (palabra clave, autor, licencia, enlace) queda en `.cache/assets/review.json` y se puede revisar con `GET /api/assets-review`. Los modelos CC-BY muestran su crédito en la ficha del concepto. Ver `docs/servidor.md`.
