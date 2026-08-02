// ── Extracted from App.jsx: LoginPhoneScreen ──
import React, { useState } from "react";
import {
  ChevronLeft,
  Send,
  Smartphone,
  Lock,
  Eye,
  EyeOff,
  AlertTriangle,
  Mail,
  Phone as PhoneIcon
} from "lucide-react";
import { auth } from "../firebase";
import { FieldWrap } from "../components/FieldWrap";
import { GoogleIcon } from "../components/GoogleIcon";

export function LoginPhoneScreen({ formData, updateForm, onSendOtp, onBack, error, onGoogleSignIn, onEmailSignIn }) {
  const [loading,   setLoading]   = useState(false);
  const [mode,      setMode]      = useState("phone"); // "phone" | "email"
  const [emailPass, setEmailPass] = useState("");
  const [showPass,  setShowPass]  = useState(false);

  const phoneReady  = formData.phone.replace(/\D/,"").length >= 7;
  const emailReady  = /\S+@\S+\.\S+/.test(formData.email || "") && emailPass.length >= 6;

  const submit = async () => {
    setLoading(true);
    if (mode === "phone") {
      await onSendOtp();
    } else {
      await onEmailSignIn(formData.email, emailPass);
    }
    setLoading(false);
  };

  return (
    <div className="kt-scroll">
      <div className="screen-pad" style={{ paddingTop: 18 }}>
        <button type="button" className="back-btn-inline" onClick={() => onBack && onBack()} style={{ marginBottom: 18 }}><ChevronLeft size={20} style={{ pointerEvents: "none" }} /></button>
        <div className="eyebrow"><Lock size={13} /> Welcome back</div>
        <h1 className="screen-h1">Log in to Point Maker</h1>

        {/* ── Mode toggle ── */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          <button
            className={`kt-btn ${mode === "phone" ? "primary" : "ghost"}`}
            style={{ flex: 1, padding: "10px 0", fontSize: 13 }}
            onClick={() => setMode("phone")}
          ><Smartphone size={14} /> Phone OTP</button>
          <button
            className={`kt-btn ${mode === "email" ? "primary" : "ghost"}`}
            style={{ flex: 1, padding: "10px 0", fontSize: 13 }}
            onClick={() => setMode("email")}
          ><Mail size={14} /> Email</button>
        </div>

        {mode === "phone" && (
          <>
            <p className="screen-sub" style={{ marginTop: 0 }}>Enter your phone number. We'll send a one-time code.</p>
            <FieldWrap label="Country code" icon={<PhoneIcon size={15} />} error={null}>
              <select className="field-input" value={formData.countryCode} onChange={(e) => updateForm("countryCode", e.target.value)} style={{ border: "none", background: "none" }}>
                <option value="+92">🇵🇰 +92 Pakistan</option>
                <option value="+1">🇺🇸 +1 USA / Canada</option>
                <option value="+44">🇬🇧 +44 UK</option>
                <option value="+971">🇦🇪 +971 UAE</option>
                <option value="+966">🇸🇦 +966 Saudi Arabia</option>
              </select>
            </FieldWrap>
            <FieldWrap label="Phone number" icon={<Smartphone size={15} />} error={null}>
              <input className="field-input" type="tel" inputMode="numeric" placeholder="3001234567" value={formData.phone} onChange={(e) => updateForm("phone", e.target.value)} onKeyDown={(e) => e.key === "Enter" && phoneReady && submit()} />
            </FieldWrap>
          </>
        )}

        {mode === "email" && (
          <>
            <p className="screen-sub" style={{ marginTop: 0 }}>Sign in with the email and password you set during registration.</p>
            <FieldWrap label="Email address" icon={<Mail size={15} />} error={null}>
              <input className="field-input" type="email" inputMode="email" placeholder="you@example.com" value={formData.email || ""} onChange={(e) => updateForm("email", e.target.value)} onKeyDown={(e) => e.key === "Enter" && emailReady && submit()} />
            </FieldWrap>
            <FieldWrap label="Password" icon={<Lock size={15} />} error={null}>
              <div className="pass-row">
                <input className="field-input" style={{ border: "none", flex: 1, padding: 0 }} type={showPass ? "text" : "password"} placeholder="Your password" value={emailPass} onChange={(e) => setEmailPass(e.target.value)} onKeyDown={(e) => e.key === "Enter" && emailReady && submit()} />
                <button className="pass-eye" onClick={() => setShowPass(!showPass)}>{showPass ? <EyeOff size={16} /> : <Eye size={16} />}</button>
              </div>
            </FieldWrap>
          </>
        )}

        {error && <div className="field-error" style={{ marginBottom: 14 }}><AlertTriangle size={12} /> {error}</div>}

        <button
          className="kt-btn primary"
          disabled={loading || (mode === "phone" ? !phoneReady : !emailReady)}
          style={(loading || (mode === "phone" ? !phoneReady : !emailReady)) ? { opacity: 0.5 } : {}}
          onClick={submit}
        >
          {loading
            ? (mode === "phone" ? "Sending code…" : "Signing in…")
            : mode === "phone"
              ? <><Smartphone size={15} /> Send OTP</>
              : <><Mail size={15} /> Sign in with Email</>
          }
        </button>
        <div className="auth-divider"><span>or</span></div>
        <button className="kt-btn google-btn" onClick={onGoogleSignIn}><GoogleIcon /> Continue with Google</button>
        <p className="login-switch">Don't have an account? <span onClick={onBack}>Create one</span></p>
      </div>
    </div>
  );
}

