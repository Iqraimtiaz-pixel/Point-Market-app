// ── Extracted from App.jsx: HelpSheet ──
import React, { useState } from "react";
import {
  MessageCircle,
  ChevronRight
} from "lucide-react";
import { ContactSupportSheet } from "./ContactSupportSheet";
import { FAQ_ITEMS } from "../utils/mockData";

export function HelpSheet({ onClose }) {
  const [open, setOpen] = useState(null);
  const [showContact, setShowContact] = useState(false);
  return (
    <div className="sheet-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet">
        <div className="sheet-handle" />
        <h3 className="sheet-title">Help &amp; Support</h3>
        <p className="sheet-sub">Frequently asked questions</p>
        {FAQ_ITEMS.map((f, i) => (
          <div key={i} className="faq-item" onClick={() => setOpen(open === i ? null : i)}>
            <div className="faq-q">{f.q}<ChevronRight size={15} style={{ transform: open === i ? "rotate(90deg)" : "none", transition: "transform .15s", color: "#6f8b80", flexShrink: 0 }} /></div>
            {open === i && <div className="faq-a">{f.a}</div>}
          </div>
        ))}
        <button className="kt-btn" style={{ marginTop: 14 }} onClick={() => setShowContact(true)}><MessageCircle size={15} /> Contact support</button>
      </div>
      {showContact && <ContactSupportSheet onClose={() => setShowContact(false)} />}
    </div>
  );
}

