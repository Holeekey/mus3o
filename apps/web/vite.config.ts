import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Para probar la VR en el teléfono hace falta un contexto seguro (WebXR, sensores de movimiento y pantalla completa):
// - `npm run dev:https` (modo "https"): HTTPS en la red local con un certificado autofirmado generado al vuelo.
// - `npm run dev:tunnel` (modo "tunnel"): acepta el host de un túnel `cloudflared tunnel --url http://localhost:5173`.
// `npm run dev` no cambia en nada.
export default defineConfig(async ({ mode }) => {
  const https = mode === "https";
  const tunnel = mode === "tunnel";
  return {
    plugins: [react(), ...(https ? [(await import("@vitejs/plugin-basic-ssl")).default()] : [])],
    server: {
      port: 5173,
      ...(https ? { host: true } : {}),
      ...(tunnel ? { allowedHosts: [".trycloudflare.com"] } : {}),
      proxy: { "/api": "http://localhost:3001" },
    },
  };
});
