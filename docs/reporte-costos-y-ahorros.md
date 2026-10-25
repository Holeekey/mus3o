# Reporte de costos y ahorros

**Proyecto:** mus3o — Palacios de la Memoria 3D
**Actualizado:** 25 de octubre de 2026. Reemplaza la versión del 24 de octubre, que usaba tarifas de Sonnet 4.6 ($3/$15) en vez de las del modelo real.

## 1. Tarifas usadas

Precios de lista de la API de Anthropic (tabla de modelos consultada el 2026-10-06), en USD por millón de tokens (MTok):

| Modelo | Entrada | Salida | Lectura de caché | Escritura de caché |
|---|---|---|---|---|
| `claude-sonnet-5-5` (generación principal) | $2.00 | $10.00 | $0.20 | $2.50 *(derivado: 1,25× la entrada)* |
| `claude-haiku-5-5` (digest, Aris, respaldo 3D) | $0.10 (≤100K tokens) | $0.50 | $0.01 *(derivado: 0,1×)* | $0.125 *(derivado)* |

- La escritura de caché no figura en la tabla de precios; se calculó con el multiplicador habitual (1,25× entrada, 0,1× lectura). Confírmalo en la consola de facturación.
- Haiku 5.5 razona por defecto; el servidor lo apaga (`noThinking`), si no gastaba ~3.200 tokens de salida pensando.
- Elementos sin costo de tokens: búsqueda Poly Pizza, citas y retratos Wikimedia. ElevenLabs (voz) se factura aparte, por caracteres.

## 2. Qué cuesta un museo

Tokens medidos con el log `tokens` del servidor. Cuenta: `entrada × tarifa + salida × tarifa + caché`.

| Caso | Salida | Costo |
|---|---|---|
| **A. JSON monolítico** (formato antiguo, `FLOW_FORMAT=json`) | 10.925 | **~$0,117** |
| **B. DSL + diorama en llamada aparte** | 6.166 | **~$0,063** |
| **C. DSL + micro-DSL fusionado (actual), caché leída** | 3.514 | **~$0,036** |
| C con caché fría (primera generación de la ventana de 5 min) | 3.514 | ~$0,039 |
| Tema simple sin diorama (DSL ~1.850 tokens de salida) | ~1.850 | ~$0,019 |
| Apuntes largos (24.558 caracteres, 12 salas; 7.993 entrada, 5.046 salida, sin caché) | 5.046 | ~$0,066 |

Desglose del caso C: salida 3.514 × $10 = $0,0351; entrada 191 nuevos × $2 = $0,0004; caché 1.400 × $0,20 = $0,0003.

- **C frente a B (medición pareada, mismo tema):** −43 % de salida, unos −$0,027 por museo. Es la única comparación medida con el mismo tema.
- **C frente a A:** −69 %. Los temas y las fechas de medición son distintos, así que es orientativo.
- **Cuello de botella:** más del 98 % del costo es salida de Sonnet. La entrada y la caché pesan centavos de centavo.

Servicios secundarios, con Haiku 5.5 (estimaciones, sin medir):

| Servicio | Estimación por uso |
|---|---|
| Digest de apuntes (solo si superan `maxNotesChars`; 50K tokens de entrada, ≤6K de salida) | < $0,01 |
| Respaldo 3D en lote (≤500 tokens de salida) | ~$0,0003 |
| Ayuda de Aris (`max_tokens` 80, ~500 tokens de entrada supuestos) | ~$0,0001 |

## 3. Uso real: cuánto consumiría

Supuestos: caso C a ~$0,036 por museo generado y el resto de gastos despreciable. Una sesión de estudio es 1 museo más ~10 ayudas de Aris, ≈ $0,037.

| Escenario | Museos nuevos | Costo |
|---|---|---|
| Una persona probando | 1 | ~$0,04 |
| Una clase (30 alumnos, temas distintos) | 30 | ~$1,08 |
| Una clase, mismo tema | 1 (los demás comparten la generación en vuelo o la caché) | ~$0,04 |
| Demo de hackathon (100 museos) | 100 | ~$3,60 |
| Beta pública | 1.000 | ~$36 |
| 10.000 museos | 10.000 | ~$360 |
| **Tope diario del servidor** (`MAX_DAILY_GENERATIONS` = 200) | 200/día | **máx. ~$7,20/día** (~$13 si todos fueran apuntes largos) |

- **Acierto de caché:** si el 35 % de las solicitudes se repiten (supuesto, no medido) y salen de la caché de disco a $0, el costo baja un 35 %. Por ejemplo, 1.000 museos pasan de ~$36 a ~$23.
- **Sin las optimizaciones (caso A):** esos mismos 1.000 museos costarían ~$117, y 10.000 costarían ~$1.170.
- **Techo mensual:** con el tope de 200/día, el gasto máximo posible en IA es ~$216 al mes, aunque haya bots.

## 4. De dónde vienen los ahorros

1. **DSL compacto en vez de JSON con geometría:** el modelo elige y ordena, y el servidor construye el resto. Es la mayor palanca, de 10.925 a ~1.850 tokens.
2. **Diorama fusionado (micro-DSL `DIO`/`D_PROP`):** quita la llamada aparte, que gastó 2.825 tokens en la medición. Cuesta +173 tokens en la llamada principal. Los dioramas científicos (`organic`/`cellular`/`vessel`) siguen en llamada aparte.
3. **Prompt del sistema cacheado:** ~1.400 tokens leídos a $0,20 en vez de pagarlos a $2.
4. **Caché de disco/LRU y deduplicación en vuelo:** una solicitud repetida o simultánea cuesta $0.
5. **Haiku para tareas secundarias:** unas 20 veces más barato que Sonnet en entrada y salida.
6. **Modelos 3D por Poly Pizza (0 tokens):** hoy bloqueado por Cloudflare, así que todas las piezas usan el respaldo de Haiku. El costo del respaldo es despreciable, pero no hay ahorro de tokens en esa parte.

## 5. Límites de la medición

- Muestra pequeña: 2 museos nuevos, 1 pareado. Sirve para el orden de magnitud, no para fijar porcentajes.
- Latencia sin concluir: 45,0 s antes y 40,9 s ahora, ambas dominadas por el bloqueo de Poly Pizza. Repetir con red normal.
- Las tarifas pueden cambiar. Revisa la consola de facturación antes de presupuestar.
- Infraestructura: el plan Starter de Render cuesta $7/mes (dato del reporte anterior, no verificado aquí).
