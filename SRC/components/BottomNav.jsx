// ── Extracted from App.jsx: BottomNav ──
import React from "react";
import {
  Home,
  ShoppingBag,
  PlusCircle,
  Inbox,
  User
} from "lucide-react";

export function BottomNav({ tab, setTab }) {
  const items = [
    { key: "home",    icon: Home,        label: "Home" },
    { key: "shop",    icon: ShoppingBag, label: "Shop" },
    { key: "create",  icon: PlusCircle,  label: "Create", plus: true },
    { key: "inbox",   icon: Inbox,       label: "Inbox" },
    { key: "profile", icon: User,        label: "Profile" },
  ];
  return (
    <div className="bottom-nav">
      {items.map(({ key, icon: Icon, label, plus }) => (
        <div key={key} className={`nav-item ${tab === key ? "active" : ""}`} onClick={() => setTab(key)}>
          {plus ? <div className="nav-plus"><Icon size={20} /></div> : <Icon size={20} />}
          <span>{label}</span>
        </div>
      ))}
    </div>
  );
}

