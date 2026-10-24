import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { applyThemeTokens, DEFAULT_THEME } from "./theme";
import "./index.css";

applyThemeTokens(DEFAULT_THEME);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
