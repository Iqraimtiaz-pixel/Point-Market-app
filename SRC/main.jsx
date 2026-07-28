
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
