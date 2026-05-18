import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/index.css";

// Global error handler — shows any uncaught JS error directly in the page
// so a blank screen never hides the real problem.
window.addEventListener("error", (e) => {
  const el = document.getElementById("root");
  if (el && !el.firstChild) {
    el.innerHTML = `
      <div style="font-family:monospace;color:#ef5350;background:#131722;
                  min-height:100vh;padding:32px;box-sizing:border-box">
        <h2 style="margin-top:0">Runtime Error</h2>
        <b>${e.message}</b><br/><br/>
        <small>${e.filename}:${e.lineno}:${e.colno}</small>
        <pre style="margin-top:16px;white-space:pre-wrap;color:#b2b5be">
${e.error?.stack || "No stack trace"}
        </pre>
      </div>`;
  }
});

window.addEventListener("unhandledrejection", (e) => {
  console.error("Unhandled rejection:", e.reason);
});

const container = document.getElementById("root");
const root = ReactDOM.createRoot(container);

// NOTE: StrictMode is intentionally removed.
// styled-components v5 has a known incompatibility with React 18 Strict Mode's
// double-invocation behaviour that causes the entire render tree to fail silently.
// Upgrade to styled-components v6 to re-enable StrictMode.
root.render(<App />);
