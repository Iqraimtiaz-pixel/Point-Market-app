// ── Extracted from App.jsx: MatchCard ──
import React from "react";

export function MatchCard({ item }) {
  return (
    <div className="match-card">
      <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ fontWeight: 600, fontSize: 13.5 }}>{item.name}</span><span style={{ color: "#16a34a", fontWeight: 700, fontSize: 12.5 }}>{item.match}%</span></div>
      <div className="match-bar-bg"><div className="match-bar-fill" style={{ width: `${item.match}%` }} /></div>
    </div>
  );
}

