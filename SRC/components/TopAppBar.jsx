// ── Extracted from App.jsx: TopAppBar ──
import React from "react";
import {
  Search,
  Bell,
  User
} from "lucide-react";

export function TopAppBar({ query, onQueryChange, rightExtra, notifCount = 0, onOpenNotifs, onOpenProfile, hideLogo = false }) {
  return (
    <div className="topbar">
      {!hideLogo && (
        <div className="pm-logo-mark" title="PointMarket">
          <img src="/logo.png" alt="PointMarket" style={{ height: 28, width: "auto", display: "block" }} draggable={false} />
        </div>
      )}
      <div className="search-pill">
        <Search size={15} />
        <input className="search-input" placeholder="Search items, skills, traders…" value={query} onChange={(e) => onQueryChange(e.target.value)} />
      </div>
      {rightExtra}
      <button className="icon-btn" style={{ position: "relative" }} onClick={onOpenNotifs}>
        <Bell size={17} />
        {notifCount > 0 && <span className="notif-dot" />}
      </button>
      <button className="icon-btn" onClick={onOpenProfile} title="Your profile">
        <User size={17} />
      </button>
    </div>
  );
}

