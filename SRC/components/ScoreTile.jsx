// ── Extracted from App.jsx: ScoreTile ──
import React from "react";

export function ScoreTile({ label, value }) {
  const color = value >= 80 ? "#16a34a" : value >= 50 ? "#b8860b" : "#ef4444";
  return (
    <div className="score-tile">
      <div className="score-tile-value" style={{ color }}>{value}</div>
      <div className="score-tile-bar-bg"><div className="score-tile-bar-fill" style={{ width: `${value}%`, background: color }} /></div>
      <div className="score-tile-label">{label}</div>
    </div>
  );
}

