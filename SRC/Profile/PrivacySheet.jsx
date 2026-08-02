// ── Extracted from App.jsx: PrivacySheet ──
import React from "react";

export function PrivacySheet({ onClose }) {
  return (
    <div className="sheet-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet">
        <div className="sheet-handle" />
        <h3 className="sheet-title">Privacy Policy</h3>
        <p className="sheet-sub">Last updated June 2026</p>
        <div className="privacy-block">
          <p><b>Data we collect:</b> Phone number, device fingerprint, transaction history, and content you post (videos, descriptions, messages).</p>
          <p><b>How we use it:</b> To verify identity, prevent fraud and multi-accounting, process trades and payments, and improve recommendations.</p>
          <p><b>Sharing:</b> Your phone number and payment details are never shown to other traders. Username, posts, and Karma Score are public.</p>
          <p><b>Your controls:</b> Edit profile, toggle notifications, or request account deletion at any time from Settings.</p>
        </div>
        <button className="kt-btn ghost" style={{ marginTop: 14 }} onClick={onClose}>Close</button>
      </div>
    </div>
  );
}

