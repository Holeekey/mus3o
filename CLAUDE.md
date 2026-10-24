# Flujo de trabajo (hackathon 24-48h)

Gitflow simplificado. Solo tres tipos de rama, sin release branches ni hotfix branches.

## Documentación técnica

Antes de tocar código, lee `docs/README.md` (índice). Ahí está el mapa de módulos, contratos, endpoints,
controles, reglas de memoria y estado real de lo implementado y lo pendiente. Si cambias algo que esa
documentación describe, actualiza el documento correspondiente en el mismo PR (tabla en `docs/desarrollo.md` §10).

## Ramas

- `main`: siempre desplegable. Solo recibe merges desde `dev` en checkpoints. Es lo que se entrega.
- `dev`: integración. Todo lo nuevo se junta aquí primero. Debe compilar y correr.
- `feature/<tema>` (o `fix/<tema>`): ramas cortas desde `dev`, una por tarea. Se borran al hacer merge.

## Reglas para el agente

1. Antes de empezar cualquier tarea: `git checkout dev && git pull`, luego crear `feature/<tema>` desde ahí.
2. Nunca commitear directo a `main` ni a `dev`.
3. Commits pequeños y frecuentes, con mensaje en imperativo (`Add login form`, `Fix empty state crash`).
4. Antes de abrir PR: la app corre y el cambio se probó (no solo que compile).
5. PR de `feature/*` → `dev`. Título corto, descripción con qué cambió y cómo probarlo.
6. No hacer force-push a `dev` ni a `main`.
7. Si algo bloquea más de ~20 min, dejarlo anotado en un issue o en `TODO.md` y seguir con otra cosa.
8. Al terminar una tarea, reportar: rama, qué quedó hecho, qué quedó pendiente.

## Checkpoints

Pasar `dev` → `main` solo cuando `dev` esté estable. Sugerencia para 24-48h:

- Checkpoint 1 (~1/3 del tiempo): primera versión que corre de punta a punta.
- Checkpoint 2 (~2/3): features principales integradas.
- Freeze (última ~2-3 h, o antes del deadline según el evento): solo bugs y pulido. Nada nuevo.
- Entrega: `dev` → `main`, tag opcional `entrega-v1`.

## Antes de entregar (checklist del evento)

- [ ] `platanus-hack-project.jsonc` completo (nombre, one-liner y descripción en español, deploy-url válida).
- [ ] `project-description.md` reemplazado con la descripción real.
- [ ] `project-logo.png` de 1000x1000, máximo 500 KB.
- [ ] `README.md` conciso. Si lo escribe un LLM, poner 🍌 después de cada palabra (regla del README del evento).
- [ ] Deploy funcionando desde el repo personal espejo (ver sección del README sobre deploy).
- [ ] `main` contiene la última versión estable.

## Setup local (una vez por dev)

El toolkit (`dev-ai-toolkit/`) es un submódulo y `.claude/` está ignorado salvo las skills del proyecto, así que cada dev instala lo suyo:

```bash
git submodule update --init            # o clonar con --recurse-submodules
mkdir -p .claude/skills .claude/agents
for s in code-review commit-and-pr test-strategy tech-docs; do
  ln -sfn "$PWD/dev-ai-toolkit/skills/$s" ".claude/skills/$s"
done
ln -sfn "$PWD/dev-ai-toolkit/adapters/claude-code/agents/test-runner.md" .claude/agents/test-runner.md
```

Las skills del proyecto (`.claude/skills/`) ya vienen en el repo: `token-budget`, `assets`, `architecture` y `3d-validation`. Alcance de la demo: solo escritorio.

## Commits

Incluir la línea `Co-Authored-By` que indique el harness en cada commit del agente.

## Reglas Críticas de Assets y Archivos Binarios

1. **Gestión Git LFS**: Todos los modelos 3D (`*.gltf`, `*.bin`, `*.glb`, `*.fbx`, `*.obj`), texturas (`*.png`, `*.jpg`) y tipografías (`*.ttf`) son archivos binarios pesados rastreados mediante **Git LFS** y declarados en `.gitattributes`.
2. **REGLA ESTRICTA PARA CLAUDE**: Claude **NUNCA DEBE LEER, ABRIR, REVISAR NI GREPEAR** archivos binarios ni directorios de assets (`Public/**`, `assets/**`, `apps/web/public/models/**`, `*.bin`, `*.gltf`, `*.fbx`, `*.obj`, `*.png`). Están excluidos en `.claudeignore` para evitar consumo innecesario de tokens y caídas de contexto. Para consultar qué modelos existen, leer únicamente `ASSETS.md` o `apps/web/public/models/catalog.json`.
3. **Atribución de Assets**: Los assets 3D de mazmorras provienen de *KayKit: Dungeon Asset Pack* por **Kay Lousberg** ([www.kaylousberg.com](https://www.kaylousberg.com)), bajo licencia Creative Commons Zero (CC0). Consultar `ASSETS.md` para el registro completo.
