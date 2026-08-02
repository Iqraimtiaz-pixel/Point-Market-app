// ── Extracted from App.jsx: REPORT_TYPES, ReportProblemSheet ──
import React, { useState } from "react";
import {
  CheckCircle2,
  AlertTriangle,
  Flag,
  Bug,
  Lightbulb,
  MessageSquare
} from "lucide-react";
import { submitReport } from "../utils/platformStore";

export const REPORT_TYPES = [
  { key: "bug",      label: "Bug",            icon: "bug" },
  { key: "scam",      label: "Scam",           icon: "alert" },
  { key: "fake",       label: "Fake Listing",   icon: "flag" },
  { key: "suggestion", label: "Suggestion",     icon: "lightbulb" },
  { key: "feedback",  label: "General Feedback", icon: "message" },
];


export function ReportProblemSheet({ onClose }) {
  const [type, setType] = useState(null);
  const [subject, setSubject] = useState("");
  const [details, setDetails] = useState("");
  const [sent, setSent] = useState(false);

  const REPORT_ICONS = { bug: Bug, alert: AlertTriangle, flag: Flag, lightbulb: Lightbulb, message: MessageSquare };

  const submit = () => {
    if (!type || !subject.trim() || !details.trim()) return;
    submitReport({ type, subject: subject.trim(), details: details.trim(), reporter: "@you.trades" });
    setSent(true);
    setTimeout(onClose, 1600);
  };

  return (
    <div className="sheet-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet">
        <div className="sheet-handle" />
        <h3 className="sheet-title">Report a Problem</h3>
        <p className="sheet-sub">Help us keep Point Maker safe and reliable. Your report goes straight to our moderation team.</p>

        {!sent ? (
          <>
            <div className="field-label" style={{ marginBottom: 8 }}>What's this about?</div>
            <div className="report-type-grid">
              {REPORT_TYPES.map((t) => {
                const Icon = REPORT_ICONS[t.icon] || Flag;
                return (
                  <div key={t.key} className={`report-type-chip ${type === t.key ? "selected" : ""}`} onClick={() => setType(t.key)}>
                    <Icon size={16} /> {t.label}
                  </div>
                );
              })}
            </div>

            <label className="field-label">Subject</label>
            <input className="field-input" style={{ marginBottom: 14 }} placeholder="Brief summary" value={subject} onChange={(e) => setSubject(e.target.value)} />

            <label className="field-label">Details</label>
            <textarea className="field-textarea" style={{ marginBottom: 16 }} placeholder="Describe what happened, including any listing or user involved…" value={details} onChange={(e) => setDetails(e.target.value)} />

            <button className="kt-btn" disabled={!type || !subject.trim() || !details.trim()} style={!type || !subject.trim() || !details.trim() ? { opacity: 0.4 } : {}} onClick={submit}>
              <Flag size={15} /> Submit report
            </button>
          </>
        ) : (
          <div className="success-box"><CheckCircle2 size={18} /> Report submitted. Our team will review it shortly.</div>
        )}
      </div>
    </div>
  );
}

