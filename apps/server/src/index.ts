import "dotenv/config";
import { app } from "./app";

// Falla pronto ante una clave con formato inválido (una clave vacía sigue permitiendo el modo mock).
const key = process.env.ANTHROPIC_API_KEY;
if (key && !/^sk-ant-[A-Za-z0-9_-]{20,}$/.test(key)) {
  console.error("ANTHROPIC_API_KEY tiene un formato inválido (se espera sk-ant-...)");
  process.exit(1);
}

const PORT = Number(process.env.PORT) || 3001;

app.listen(PORT, () => console.log(`server escuchando en http://localhost:${PORT}`));
