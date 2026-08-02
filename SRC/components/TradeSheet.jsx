// ── Extracted from App.jsx: TradeSheet ──
import React, { useState } from "react";
import {
  CheckCircle2,
  Send,
  ChevronRight,
  Handshake
} from "lucide-react";

export function TradeSheet({ item, onClose }) {
  const [mode,       setMode]       = useState(null);
  const [offerText,  setOfferText]  = useState("");
  const [selectedKp, setSelectedKp] = useState(null);
  const [customKp,   setCustomKp]   = useState("");
  const [sent,       setSent]       = useState(false);

  const canSend = (mode === "item" && offerText.trim()) || (mode === "kp" && (selectedKp || customKp));

  const send = () => { setSent(true); setTimeout(onClose, 1400); };

  return (
    <div className="sheet-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet">
        <div className="sheet-handle" />
        {!mode && (
          <>
            <h3 className="sheet-title">Make an offer</h3>
            <p className="sheet-sub">Trading for: <b>{item.title}</b></p>
            <div className="option-row" onClick={() => setMode("item")}><div>Trade My Item<div className="opt-sub">Describe what you'd like to trade</div></div><ChevronRight size={18} /></div>
            <div className="option-row" onClick={() => setMode("kp")}><div>Offer PM Points<div className="opt-sub">Send a PM offer instead</div></div><ChevronRight size={18} /></div>
          </>
        )}
        {mode === "item" && !sent && (
          <>
            <h3 className="sheet-title">Describe your offer</h3>
            <p className="sheet-sub">Tell the seller what you want to trade — any item or skill is welcome.</p>
            <textarea className="field-textarea" style={{ marginBottom: 14 }} placeholder="e.g. Wireless headphones, barely used. Also willing to add 200 PM on top." value={offerText} onChange={(e) => setOfferText(e.target.value)} />
          </>
        )}
        {mode === "kp" && !sent && (
          <>
            <h3 className="sheet-title">Offer PM Points</h3>
            <p className="sheet-sub">AI estimated value: {item.aiValue?.toLocaleString()} PM</p>
            <div className="kp-grid">
              {[500, 1000, 1500].map((amt) => (
                <div key={amt} className={`kp-chip ${selectedKp === amt ? "selected" : ""}`} onClick={() => { setSelectedKp(amt); setCustomKp(""); }}>{amt} PM</div>
              ))}
              <input className="kp-chip" style={{ outline: "none", fontFamily: "inherit" }} placeholder="Custom" value={customKp} onChange={(e) => { setCustomKp(e.target.value.replace(/\D/g, "")); setSelectedKp(null); }} />
            </div>
          </>
        )}
        {mode && !sent && (
          <button className="kt-btn" disabled={!canSend} style={!canSend ? { opacity: 0.4 } : {}} onClick={send}>Send trade request <Handshake size={16} /></button>
        )}
        {sent && <div className="success-box"><CheckCircle2 size={18} /> Request sent!</div>}
      </div>
    </div>
  );
}

