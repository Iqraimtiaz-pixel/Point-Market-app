// =============================================================================
//  src/main.jsx  ·  Point Market — App Entry Point
// =============================================================================
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

// ══════════════════════════════════════════════════════════════════
// TEMPORARY DEBUG PROBE — REMOVE AFTER CAPTURING THE STACK TRACE.
// Pure browser-level listener, entirely outside React. Does not touch
// App.jsx, ProfileScreen, hooks, or React's render lifecycle in any way —
// it only displays whatever uncaught error the browser itself already
// receives when a render throws with no Error Boundary present.
// ══════════════════════════════════════════════════════════════════
function __showProbeError(title, message, stack) {
  const box = document.createElement("div");
  box.style.cssText = "position:fixed;inset:0;z-index:999999;background:#fff;color:#c00;font-family:monospace;font-size:12px;white-space:pre-wrap;word-break:break-word;overflow:auto;padding:16px;";
  box.textContent = `${title}\n\nMESSAGE:\n${message}\n\nSTACK:\n${stack}`;
  document.body.appendChild(box);
}
window.addEventListener("error", (event) => {
  __showProbeError("RUNTIME PROBE — window.onerror", event.error?.message || event.message, event.error?.stack || "(no stack available)");
});
window.addEventListener("unhandledrejection", (event) => {
  __showProbeError("RUNTIME PROBE — unhandledrejection", event.reason?.message || String(event.reason), event.reason?.stack || "(no stack available)");
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
