import { afterAll } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Las pruebas nunca leen ni escriben la caché real ni la semilla del repo (cada archivo de prueba, su propia carpeta).
const dir = mkdtempSync(join(tmpdir(), "mus3o-test-"));
process.env.IMAGE_CACHE_DIR = join(dir, "cache");
process.env.MUSEUM_CACHE_DIR = join(dir, "museums");
process.env.ASSET_CACHE_DIR = join(dir, "assets");
process.env.IMAGE_SEED_DIR = join(dir, "seed");
process.env.DIORAMA_SEED_DIR = join(dir, "seed-dioramas");
// Las pruebas nunca llaman a servicios reales (ni gastan crédito): las que necesitan una clave la fijan ellas mismas.
delete process.env.ANTHROPIC_API_KEY;
delete process.env.POLY_PIZZA_API_KEY;
afterAll(() => rmSync(dir, { recursive: true, force: true }));
