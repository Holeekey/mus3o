import { defineConfig } from "vitest/config";

// Varias pruebas escriben cachés en disco; en Windows con la máquina cargada pueden pasar de los 5 s por defecto.
export default defineConfig({ test: { setupFiles: ["./src/test-setup.ts"], testTimeout: 20_000 } });
