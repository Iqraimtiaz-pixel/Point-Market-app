// ── Extracted from App.jsx: ProgressBar, STEPS ──
import React from "react";

export const STEPS = ["signup", "otp", "security", "location", "success"];


export function ProgressBar({ current }) {
  const idx = STEPS.indexOf(current);
  return (
    <div className="progress-bar">
      {STEPS.map((_, i) => (
        <div key={i} className={`progress-seg ${i <= idx ? "filled" : ""}`} />
      ))}
    </div>
  );
}

