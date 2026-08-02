// ── Extracted from App.jsx: SecurityScreen ──
import React, { useState, useEffect } from "react";
import {
  CheckCircle2,
  ChevronRight,
  Smartphone,
  Shield,
  Fingerprint,
  AlertTriangle
} from "lucide-react";
import { ProgressBar } from "../components/ProgressBar";

export function SecurityScreen({ fingerprint, deviceBlocked, onDone }) {
  const [step, setStep] = useState(0); // animate checks in sequence
  const checks = [
    { icon: <Smartphone size={16} />, title: "Phone verified",        sub: "OTP confirmed successfully",              ok: true },
    { icon: <Fingerprint size={16} />,title: "Device fingerprint",    sub: fingerprint,                               ok: !deviceBlocked },
    { icon: <Shield size={16} />,     title: "Sybil attack check",    sub: "One account per device enforced",         ok: !deviceBlocked },
    { icon: <CheckCircle2 size={16} />,title:"Account secured",        sub: "Identity verified & fraud check passed", ok: true },
  ];

  useEffect(() => {
    if (step < checks.length) {
      const t = setTimeout(() => setStep((s) => s + 1), 650);
      return () => clearTimeout(t);
    }
  }, [step]);

  const allDone = step >= checks.length;

  return (
    <div className="kt-scroll">
      <ProgressBar current="security" />

      <div className="screen-pad">
        <div className="eyebrow"><Shield size={13} /> Step 3 of 5 · Security Gateway</div>
        <h1 className="screen-h1">Verifying your account…</h1>
        <p className="screen-sub">Our anti-fraud system runs quietly in the background to keep Point Maker safe for everyone.</p>

        <div className="check-list">
          {checks.map((c, i) => (
            <div key={i} className={`check-item ${i < step ? "visible" : "hidden"}`}>
              <div className={`check-icon-wrap ${c.ok ? "ok" : "blocked"}`}>{c.icon}</div>
              <div className="check-body">
                <div className="check-title">{c.title}</div>
                <div className="check-sub">{c.sub}</div>
              </div>
              <div className="check-result">
                {i < step && (c.ok
                  ? <CheckCircle2 size={18} color="#3b82f6" />
                  : <span className="blocked-tag">BLOCKED</span>
                )}
              </div>
            </div>
          ))}
        </div>

        {deviceBlocked && allDone && (
          <div className="warning-box">
            <AlertTriangle size={16} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 13 }}>Device already registered</div>
              <div style={{ fontSize: 12, marginTop: 3 }}>This device is linked to another account. You can still create an account but the 100 PM Welcome Bonus will not be credited.</div>
            </div>
          </div>
        )}

        {allDone && (
          <button className="kt-btn primary" onClick={onDone}>
            Continue <ChevronRight size={16} />
          </button>
        )}
      </div>
    </div>
  );
}

