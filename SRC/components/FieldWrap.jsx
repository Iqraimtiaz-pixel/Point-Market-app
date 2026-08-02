// ── Extracted from App.jsx: FieldWrap ──
import React from "react";
import {
  AlertTriangle
} from "lucide-react";

export function FieldWrap({ label, icon, error, children }) {
  return (
    <div className="field-wrap">
      <label className="field-label">{label}</label>
      <div className={`field-box ${error ? "has-error" : ""}`}>
        <span className="field-icon">{icon}</span>
        {children}
      </div>
      {error && <div className="field-error"><AlertTriangle size={12} /> {error}</div>}
    </div>
  );
}

