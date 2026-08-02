// ── Extracted from App.jsx: OtpScreen ──
import React, { useState, useEffect, useRef } from "react";
import {
  ChevronLeft,
  CheckCircle2,
  ChevronRight,
  Smartphone,
  AlertTriangle
} from "lucide-react";
import { ProgressBar } from "../components/ProgressBar";

export function OtpScreen({ phone, onVerified, onResend, onBack, error: externalError }) {
  const [digits,  setDigits]  = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [shake,   setShake]   = useState(false);
  const [resendCooldown, setResendCooldown] = useState(30); // seconds until resend is allowed
  const [resending, setResending] = useState(false);
  const refs = [useRef(), useRef(), useRef(), useRef(), useRef(), useRef()];

  // Countdown ticks down from 30s every time the screen mounts or a resend fires.
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const handleChange = (i, val) => {
    if (!/^\d?$/.test(val)) return;
    const next = [...digits];
    next[i] = val;
    setDigits(next);
    if (val && i < 5) refs[i + 1].current?.focus();
  };

  const handleKeyDown = (i, e) => {
    if (e.key === "Backspace" && !digits[i] && i > 0) refs[i - 1].current?.focus();
  };

  const verify = async () => {
    const code = digits.join("");
    if (code.length < 6) return;
    setLoading(true);
    const result = await onVerified(code);
    if (result === false) {
      setShake(true);
      setDigits(["","","","","",""]);
      setTimeout(() => { setShake(false); refs[0].current?.focus(); }, 600);
    }
    setLoading(false);
  };

  const resend = async () => {
    if (resendCooldown > 0 || resending || !onResend) return;
    setResending(true);
    setDigits(["","","","","",""]);
    await onResend();
    setResending(false);
    setResendCooldown(30);
    refs[0].current?.focus();
  };

  // Firebase Phone Auth sends 6-digit codes
  const complete = digits.every((d) => d !== "");

  return (
    <div className="kt-scroll">
      <ProgressBar current="otp" />
      <div className="screen-pad">
        <button type="button" className="back-btn-inline" onClick={() => onBack && onBack()} style={{ marginBottom: 16 }}><ChevronLeft size={20} style={{ pointerEvents: "none" }} /></button>
        <div className="eyebrow"><Smartphone size={13} /> Step 2 of 5 · Phone Verification</div>
        <h1 className="screen-h1">Enter your code</h1>
        <p className="screen-sub">A 6-digit verification code was sent to <b style={{ color: "var(--ink)" }}>{phone}</b>.</p>

        <div className={`otp-row ${shake ? "otp-shake" : ""}`} style={{ gap: 8 }}>
          {digits.map((d, i) => (
            <input
              key={i}
              ref={refs[i]}
              className={`otp-box ${externalError ? "otp-error" : d ? "otp-filled" : ""}`}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={d}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
            />
          ))}
        </div>

        {externalError && <div className="error-banner"><AlertTriangle size={14} /> {externalError}</div>}

        <div className="resend-row">
          {resendCooldown > 0
            ? <>Didn't get a code? Resend available in {resendCooldown}s</>
            : <>Didn't get a code? <span className="resend-link" onClick={resend}>{resending ? "Sending…" : "Resend code"}</span></>
          }
        </div>

        <div className="otp-security">
          <div className="sec-row"><CheckCircle2 size={14} color="#22c55e" /> Code expires in 10 minutes</div>
          <div className="sec-row"><CheckCircle2 size={14} color="#22c55e" /> Never share your OTP with anyone</div>
          <div className="sec-row"><CheckCircle2 size={14} color="#22c55e" /> Point Maker will never call you asking for a code</div>
        </div>

        <button
          className="kt-btn primary"
          disabled={!complete || loading}
          style={!complete || loading ? { opacity: 0.4 } : {}}
          onClick={verify}
        >
          {loading ? "Verifying…" : <>Verify &amp; continue <ChevronRight size={16} /></>}
        </button>
      </div>
    </div>
  );
}

