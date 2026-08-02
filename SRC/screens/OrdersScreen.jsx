// ── Extracted from App.jsx: OrdersScreen ──
import React, { useState } from "react";
import {
  ChevronLeft
} from "lucide-react";
import { ORDER_TABS, ORDERS } from "../utils/mockData";

export function OrdersScreen({ onBack }) {
  const [tab, setTab] = useState("give");
  const items = ORDERS[tab];
  return (
    <div className="kt-scroll">
      <div className="screen-header">
        <button className="back-btn-inline" onClick={onBack}><ChevronLeft size={20} /></button>
        <h2>Orders</h2>
      </div>
      <div className="tab-scroll">
        {ORDER_TABS.map(({ key, label, icon: Icon }) => (
          <div key={key} className={`order-tab ${tab === key ? "active" : ""}`} onClick={() => setTab(key)}>
            <Icon size={13} /> {label}
          </div>
        ))}
      </div>
      {items.length === 0 ? <div className="empty-state">No orders here yet.</div> : items.map((o, i) => (
        <div key={i} className="order-card">
          <div style={{ fontWeight: 700, fontSize: 14 }}>{o.item}</div>
          <div style={{ fontSize: 12, color: "#6f8b80", marginTop: 4 }}>With {o.with} · {o.status}</div>
        </div>
      ))}
    </div>
  );
}

