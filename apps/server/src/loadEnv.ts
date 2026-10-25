import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Carga las variables de entorno desde el `.env` de la raíz del repo y, si existe, desde el de `apps/server`.
 * `npm run dev -w @mus3o/server` arranca con `apps/server` como directorio de trabajo, así que `dotenv/config` solo
 * miraba `apps/server/.env` y nunca leía las claves de la raíz (Poly Pizza, voz...). Lo ya definido en el entorno manda.
 */
const here = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(here, "../../../.env"), quiet: true });
config({ quiet: true });
