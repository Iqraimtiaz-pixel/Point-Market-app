// ── Extracted from App.jsx: MenuRow ──
import React from "react";
import {
  ChevronRight
} from "lucide-react";

export function MenuRow({ icon: Icon, label, sub, onClick }) {
  return (
    <div className="menu-row" onClick={onClick}>
      <div className="menu-icon"><Icon size={17} /></div>
      <div className="menu-label">{label}</div>
      {sub && <span style={{ fontSize: 12.5, color: "#6f8b80", fontWeight: 600 }}>{sub}</span>}
      <ChevronRight size={16} color="#6f8b80" />
    </div>
  );
}

