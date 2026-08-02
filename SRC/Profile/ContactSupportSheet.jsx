// ── Extracted from App.jsx: ContactSupportSheet ──
import React, { useState } from "react";
import {
  MessageCircle,
  CheckCircle2,
  Send
} from "lucide-react";

export function ContactSupportSheet({ onClose }) {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sent,    setSent]    = useState(false);

  const send = () => {
    if (!subject.trim() || !message.trim()) return;
    setSent(true);
    setTimeout(onClose, 1600);
  };

  return (
    <div className="sheet-backdrop nested" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet">
        <div className="sheet-handle" />
        <h3 className="sheet-title">Contact Support</h3>
        <p className="sheet-sub">Tell us what's going on and our team will follow up by email.</p>

        {!sent ? (
          <>
            <label className="field-label">Subject</label>
            <input className="field-input" style={{ marginBottom: 14 }} placeholder="e.g. Issue with a trade" value={subject} onChange={(e) => setSubject(e.target.value)} />
            <label className="field-label">Message</label>
            <textarea className="field-textarea" style={{ marginBottom: 16 }} placeholder="Describe the issue in detail…" value={message} onChange={(e) => setMessage(e.target.value)} />
            <button className="kt-btn" disabled={!subject.trim() || !message.trim()} style={!subject.trim() || !message.trim() ? { opacity: 0.4 } : {}} onClick={send}>
              <MessageCircle size={15} /> Send message
            </button>
          </>
        ) : (
          <div className="success-box"><CheckCircle2 size={18} /> Message sent! Our support team will respond shortly.</div>
        )}
      </div>
    </div>
  );
}

