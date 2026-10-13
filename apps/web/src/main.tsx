import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "../public/operator.css";
import "../../../packages/shared-ui/tokens.css";
import "../../../packages/shared-ui/components.css";
import "../public/operator-1.8.css";
import "./styles.css";
import "../../../packages/shared-ui/telemetry.css";
import "../../../packages/shared-ui/notifications.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

import "../../../packages/shared-ui/responsive-shell.css";

import "../../../packages/shared-ui/motion.css";
