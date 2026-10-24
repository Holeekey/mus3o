# Guía de Despliegue en Render — Mus3o

Este documento describe la arquitectura y el procedimiento paso a paso para desplegar **mus3o** en [Render](https://render.com) bajo el plan **Starter ($7/mes)**, garantizando alta velocidad, disponibilidad 24/7 sin cold starts y seguridad para las credenciales de IA.

---

## 1. Arquitectura de Despliegue

```
                                  [ Usuario / Navegador ]
                                             │
                                     HTTPS (Puerto 443)
                                             ▼
                             [ Render Load Balancer / SSL ]
                                             │
                                             ▼
                       ┌───────────────────────────────────────────┐
                       │   Render Web Service (Plan Starter $7/mo) │
                       │                                           │
                       │   Node.js Server (apps/server/dist)       │
                       │   ├── GET /api/health (Health Check)     │
                       │   ├── POST /api/* (API & Claude LLM)      │
                       │   └── GET /* (Static SPA apps/web/dist)   │
                       └───────────────────────────────────────────┘
```

- **Entrega Única:** El servidor Express sirve tanto la API como la aplicación React/Three.js pre-compilada.
- **Cero problemas de CORS:** Todas las peticiones a `/api/*` son locales al mismo dominio.
- **Caché óptima:** Los assets con hash en `/assets/` se entregan con `Cache-Control: public, max-age=31536000, immutable`.
- **Health Checks:** Render monitorea `/api/health` para garantizar zero-downtime deploys.

---

## 2. Despliegue con Blueprint (Recomendado — 3 clics)

El repositorio incluye el archivo [`render.yaml`](../render.yaml) configurado para Blueprints de Render.

### Pasos:

1. Inicia sesión en tu cuenta de [Render Dashboard](https://dashboard.render.com/).
2. Haz clic en **New +** y selecciona **Blueprint**.
3. Conecta el repositorio: `platanus-hack/platanus-hack-26-ve-team-5`.
4. Render detectará automáticamente el archivo `render.yaml`:
   - **Service Name:** `mus3o`
   - **Environment:** `Node`
   - **Plan:** `Starter` ($7/mes, cubierto por tus créditos)
   - **Branch:** `dev` (o la rama que desees)
5. En la sección de variables de entorno protegidas (`sync: false`), Render te solicitará ingresar:
   - **`ANTHROPIC_API_KEY`**: Pega tu clave de Anthropic (`sk-ant-api03-...`).
6. Haz clic en **Apply**.

Render ejecutará el build con `pnpm`, verificará el health check en `/api/health` y publicará la URL pública HTTPS (`https://mus3o.onrender.com`).

---

## 3. Despliegue Manual (Alternativa sin Blueprint)

Si prefieres crearlo manualmente desde el dashboard:

1. Ve a **New +** -> **Web Service**.
2. Conecta el repositorio de GitHub.
3. Configura los siguientes campos:
   - **Name:** `mus3o`
   - **Region:** `Oregon (US West)` o la más cercana
   - **Branch:** `dev`
   - **Runtime:** `Node`
   - **Build Command:** `corepack enable && pnpm install && pnpm run build`
   - **Start Command:** `node apps/server/dist/index.js`
   - **Instance Type:** `Starter ($7/month)`
4. Despliega la sección **Advanced** y añade:
   - **Health Check Path:** `/api/health`
5. En la sección **Environment Variables**:
   - `NODE_ENV`: `production`
   - `PORT`: `10000`
   - `ANTHROPIC_MODEL`: `claude-sonnet-4-20250514`
   - `MAX_DAILY_GENERATIONS`: `200`
   - `ANTHROPIC_API_KEY`: `[Tu API Key]`
6. Haz clic en **Create Web Service**.

---

## 4. Presupuesto y Recursos

| Recurso | Detalle | Costo |
|---|---|---|
| **Instancia Web Service** | Starter (0.5 vCPU, 512 MB RAM) | **$7.00 / mes** |
| **Tiempo de Inactividad (Sleep)** | **0 minutos** (Siempre despierto) | Incluido |
| **Certificado SSL / HTTPS** | Automático gestionado por Let's Encrypt | Gratis |
| **Ancho de banda** | 100 GB / mes | Gratis |
| **Total mensual** | | **$7.00** (Dentro del presupuesto de $5–$10) |

---

## 5. Verificación Post-Despliegue

Una vez activo en Render:
- [ ] Accede a `https://tu-app.onrender.com/api/health` y verifica que responda `{"status":"ok", ...}`.
- [ ] Carga la Landing y navega a uno de los palacios de ejemplo para verificar la fluidez de WebGL.
- [ ] Prueba una generación de palacio con IA ingresando un tema para verificar la conexión con Anthropic.
