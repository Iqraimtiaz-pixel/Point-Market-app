// =============================================================================
// src/main.jsx · Point Market — App Entry Point
// =============================================================================
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

// ===== Runtime Error Probe =====
function showError(title, message, stack) {
  document.body.innerHTML = `
    <div style="background:#111;color:#ff4d4f;padding:20px;font-family:monospace;white-space:pre-wrap;">
      <h2>${title}</h2>
      <p>${message || "Unknown Error"}</p>
      <hr/>
      <pre>${stack || ""}</pre>
    </div>
  `;
}

window.addEventListener("error", (event) => {
  showError(
    "RUNTIME ERROR",
    event.error?.message || event.message,
    event.error?.stack
  );
});

window.addEventListener("unhandledrejection", (event) => {
  showError(
    "UNHANDLED PROMISE REJECTION",
    event.reason?.message || String(event.reason),
    event.reason?.stack
  );
});
// ===============================

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
