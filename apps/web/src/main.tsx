import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { applyThemeTokens, DEFAULT_THEME } from "./theme";
import { warmVoice } from "./lib/voice";
import "./index.css";

applyThemeTokens(DEFAULT_THEME);
warmVoice();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
