// ── Extracted from App.jsx: MiniBarChart ──
import React from "react";

export function MiniBarChart({ data, labels, color = "#2563eb", height = 70 }) {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data, 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height }}>
      {data.map((v, i) => (
        <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <div style={{ width: "100%", height: `${Math.max(4, (v / max) * (height - 18))}px`, background: color, borderRadius: 4, opacity: 0.85 }} />
          {labels && <span style={{ fontSize: 9, color: "#6b7587" }}>{labels[i]}</span>}
        </div>
      ))}
    </div>
  );
}

