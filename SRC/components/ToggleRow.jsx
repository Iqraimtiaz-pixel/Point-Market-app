// ── Extracted from App.jsx: ToggleRow ──
import React from "react";

export function ToggleRow({ icon: Icon, label, checked, onToggle }) {
  return (
    <div className="menu-row" style={{ cursor: "pointer" }} onClick={onToggle}>
      <div className="menu-icon"><Icon size={17} /></div>
      <div className="menu-label">{label}</div>
      <div className={`switch ${checked ? "on" : ""}`}><div className="switch-knob" /></div>
    </div>
  );
}

