// ── Extracted from App.jsx: BattleScreen ──
import React, { useState } from "react";
import {
  ChevronLeft,
  CheckCircle2,
  TrendingUp
} from "lucide-react";
import { BATTLE_OFFERS } from "../utils/mockData";

export function BattleScreen({ onBack }) {
  const sorted   = [...BATTLE_OFFERS].sort((a, b) => (b.kp + b.items.length * 250) - (a.kp + a.items.length * 250));
  const [sel,     setSel]     = useState(sorted[0]?.user || "");
  const [accepted,setAccepted]= useState(false);
  const chosen = sorted.find((o) => o.user === sel);

  return (
    <div className="kt-scroll">
      <div className="screen-header">
        <button className="back-btn-inline" onClick={onBack}><ChevronLeft size={20} /></button>
        <h2>Trade Battle</h2>
      </div>
      <div className="ai-banner"><TrendingUp size={20} /><div><div className="ai-banner-title">Trade Battle</div><div className="ai-banner-sub">Choose the best offer for your item.</div></div></div>
      <div style={{ padding: "0 16px 16px" }}>
        {sorted.length === 0 ? (
          <div className="empty-state">No battle offers available right now.</div>
        ) : (
          <> 
            {sorted.map((o, i) => (
              <div key={o.user} className={`battle-card ${sel === o.user ? "winner" : ""}`} onClick={() => { setSel(o.user); setAccepted(false); }}>
                <div className="battle-rank">{i + 1}</div>
                <div className="avatar-sm" style={{ width: 36, height: 36, fontSize: 18 }}>{o.avatar}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 13.5 }}>{o.user}</div>
                  <div style={{ fontSize: 12, color: "#6f8b80", marginTop: 2 }}>{o.items.join(" + ")} {o.kp ? `+ ${o.kp} PM` : ""}</div>
                </div>
                {sel === o.user && <CheckCircle2 size={18} color="#16a34a" />}
              </div>
            ))}
            {!accepted ? (
              <button className="kt-btn" style={{ marginTop: 4 }} onClick={() => setAccepted(true)}><CheckCircle2 size={16} /> Accept {chosen?.user || "offer"}</button>
            ) : (
              <div className="success-box"><CheckCircle2 size={18} /> Accepted {chosen?.user || "offer"}! Check Orders to track.</div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

