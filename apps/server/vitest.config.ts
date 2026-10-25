import { defineConfig } from "vitest/config";

// Varias pruebas escriben cachés en disco: en Windows con la máquina cargada se pisan y pasan de los 5 s, así que van de a un archivo.
export default defineConfig({ test: { setupFiles: ["./src/test-setup.ts"], testTimeout: 20_000, fileParallelism: false } });
