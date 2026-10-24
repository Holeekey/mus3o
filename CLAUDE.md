# Flujo de trabajo (hackathon 24-48h)

Gitflow simplificado. Solo tres tipos de rama, sin release branches ni hotfix branches.

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

## Commits

Incluir la línea `Co-Authored-By` que indique el harness en cada commit del agente.
