---
name: locigen-token-budget
description: Disciplina de costo y tokens para desarrollar LociGen con USD 50 de créditos de API en 24 h. Usar al iniciar una tarea, al elegir modelo (Haiku vs Sonnet), al decidir si delegar a un subagente, antes de leer archivos grandes, cuando el contexto crece, o cuando el usuario diga "ahorra tokens", "qué modelo uso", "cuánto llevamos gastado", "presupuesto" o "low cost".
---

# LociGen: presupuesto de tokens

Meta: terminar en 24 h sin pasar de USD 50 de créditos de API de Claude.
Gasto esperado ~USD 14–20 *(est.)*, peor caso ~USD 43 *(est.)*, reserva USD 5. Alerta de gasto a USD 35.

## Paso 1: elegir modelo (orden fijo, usar el primero que aplique)

| Tarea | Modelo |
|---|---|
| Algoritmo de layout, colisiones, arquitectura del Worker | Sonnet 5.5 |
| Bug que Haiku no resolvió en 2 intentos | Sonnet 5.5 |
| Todo lo demás: UI, boilerplate, optimizar assets, `ASSETS.md`, tests simples, docs, commits | Haiku 5.5 |

Precios por millón de tokens (entrada/salida): Haiku USD 0.10 / 0.50, Sonnet USD 2 / 10. Sonnet cuesta ~20× más.

## Paso 2: acotar el contexto antes de actuar

1. Buscar con grep o leer con rango (`offset`/`limit`) antes de abrir un archivo entero.
2. Tareas ruidosas (tests, builds, logs largos): delegar a `test-runner` (Haiku) y recibir solo el resumen.
3. Al cerrar cada bloque del plan, reiniciar el contexto y dejar el estado en `TODO.md`.
4. Mantener cada prompt de Haiku bajo 100.000 tokens (por encima la tarifa sube a USD 0.50 / 2.50).
5. Una pausa de más de 5 min reconstruye la caché del contexto: agrupar el trabajo y evitar sesiones largas inactivas.
6. No pegar documentos enteros en el chat; referenciar el archivo.
7. Las capturas visuales se revisan en el chat de claude.ai, que no consume créditos de API.

## Paso 3: recortes ante retraso (en este orden)

1. Logros. 2. Pedestales con modelos. 3. Carga de CSV. 4. Chat con fuentes. 5. Soporte móvil.

## Paso 4: control

- Pedir al usuario el gasto de la consola de Anthropic. No inventarlo ni estimarlo como dato real.
- Confirmar que los créditos son de API: no cubren Claude Code por suscripción y no se acumulan entre meses.

## Plan de 24 h y modelo sugerido

| Horas | Bloque | Modelo |
|---|---|---|
| 0–1.5 | Evaluar forks (go/no-go), Cloudflare, repo, `ASSETS.md` | Haiku |
| 1.5–4 | Kit de assets (usar `locigen-assets`) | Haiku |
| 4–10 | Layout con tests, salas, movimiento, colisiones | Sonnet |
| 10–15 | Worker: estructura, imágenes, caché R2 | Sonnet |
| 15–18 | Interfaz: pegar/subir texto, carga, minimapa | Haiku |
| 18–21 | Look-dev y validación (usar `locigen-3d-validation`) | Mixto |
| 21–24 | Pre-generar demo, desplegar, ensayar, margen | Humano |

## Reporte al cerrar un bloque (formato fijo)

```
Bloque: <nombre y horas>
Modelo usado: <Haiku | Sonnet | mixto>
Hecho: <lista corta>
Pendiente o recortado: <lista corta>
Gasto de consola (dato del usuario): <USD o "sin dato">
```
