// ── Extracted from App.jsx: PhoneNumberSheet ──
import React, { useState, useEffect, useRef } from "react";
import {
  CheckCircle2,
  Send,
  Smartphone,
  AlertTriangle
} from "lucide-react";
import {
  RecaptchaVerifier,
  PhoneAuthProvider,
  updatePhoneNumber,
} from "firebase/auth";
import { auth } from "../firebase";
import { updateUserProfile } from "../services/userService";
import { getFriendlyAuthError } from "../utils/firebaseHelpers";

export function PhoneNumberSheet({ onClose, currentUser, onProfileUpdate }) {
  const [step,       setStep]       = useState("view"); // view | edit | otp | done
  const [countryCode,setCountryCode]= useState("+92");
  const [newPhone,   setNewPhone]   = useState("");
  const [otp,        setOtp]        = useState("");
  const [error,      setError]      = useState("");
  const [sending,    setSending]    = useState(false);
  const [verifying,  setVerifying]  = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const verificationIdRef = useRef(null);
  const recaptchaRef = useRef(null);

  const currentPhone = currentUser?.phone || "";

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  // Clean up the invisible reCAPTCHA whenever this sheet closes/unmounts.
  useEffect(() => {
    return () => {
      if (recaptchaRef.current) {
        try { recaptchaRef.current.clear(); } catch (_) {}
        recaptchaRef.current = null;
      }
    };
  }, []);

  const getVerifier = () => {
    if (recaptchaRef.current) return recaptchaRef.current;
    const verifier = new RecaptchaVerifier(auth, "pm-recaptcha-container", { size: "invisible" });
    recaptchaRef.current = verifier;
    return verifier;
  };

  const sendCode = async () => {
    const digits = newPhone.replace(/\D/g, "");
    if (digits.length < 7) { setError("Enter a valid phone number."); return; }
    setError("");
    setSending(true);
    try {
      const fullPhone = countryCode + digits;
      const provider = new PhoneAuthProvider(auth);
      const verificationId = await provider.verifyPhoneNumber(fullPhone, getVerifier());
      verificationIdRef.current = verificationId;
      setOtp("");
      setStep("otp");
      setResendCooldown(30);
    } catch (e) {
      setError(getFriendlyAuthError(e, "Failed to send OTP. Please check the number and try again."));
      if (recaptchaRef.current) { try { recaptchaRef.current.clear(); } catch (_) {} recaptchaRef.current = null; }
    } finally {
      setSending(false);
    }
  };

  const verifyCode = async () => {
    if (otp.length < 6 || !verificationIdRef.current) return;
    setError("");
    setVerifying(true);
    try {
      const credential = PhoneAuthProvider.credential(verificationIdRef.current, otp);
      // Updates the phone number on the existing signed-in Firebase Auth user —
      // does NOT sign the user out or start a new session.
      await updatePhoneNumber(auth.currentUser, credential);

      const fullPhone = countryCode + newPhone.replace(/\D/g, "");
      // Only persist the new number to Firestore after verification succeeds.
      if (currentUser?.uid) {
        await updateUserProfile(currentUser.uid, { phone: fullPhone });
        onProfileUpdate?.({ phone: fullPhone });
      }
      setStep("done");
      setTimeout(onClose, 1400);
    } catch (e) {
      setError(getFriendlyAuthError(e, "Incorrect code. Please try again."));
    } finally {
      setVerifying(false);
    }
  };

  const resend = async () => {
    if (resendCooldown > 0 || sending) return;
    await sendCode();
  };

  return (
    <div className="sheet-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet">
        <div className="sheet-handle" />
        <h3 className="sheet-title">Phone Number</h3>

        {step === "view" && (
          <>
            <div className="confirm-box" style={{ marginBottom: 14 }}>
              <div className="confirm-row"><span>Number</span><b>{currentPhone || "Not set"}</b></div>
              <div className="confirm-row"><span>Status</span><b style={{ color: "#16a34a" }}>Verified ✓</b></div>
            </div>
            <button className="kt-btn ghost" onClick={() => { setError(""); setNewPhone(""); setStep("edit"); }}>Change number</button>
          </>
        )}

        {step === "edit" && (
          <>
            <p className="sheet-sub">Enter your new number. We'll text a real 6-digit code to verify it.</p>
            <div className="kt-phone-row" style={{ marginBottom: 14 }}>
              <select className="kt-code" style={{ border: "none", background: "none" }} value={countryCode} onChange={(e) => setCountryCode(e.target.value)}>
                <option value="+92">🇵🇰 +92</option>
                <option value="+1">🇺🇸 +1</option>
                <option value="+44">🇬🇧 +44</option>
                <option value="+971">🇦🇪 +971</option>
                <option value="+966">🇸🇦 +966</option>
              </select>
              <input className="kt-input" type="tel" inputMode="numeric" placeholder="3001234567" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
            </div>
            {error && <div className="field-error" style={{ marginBottom: 14 }}><AlertTriangle size={12} /> {error}</div>}
            <button className="kt-btn" disabled={!newPhone.trim() || sending} style={(!newPhone.trim() || sending) ? { opacity: 0.4 } : {}} onClick={sendCode}>
              {sending ? "Sending…" : <>Send code <Smartphone size={15} /></>}
            </button>
          </>
        )}

        {step === "otp" && (
          <>
            <p className="sheet-sub">Enter the 6-digit code sent to <b>{countryCode}{newPhone}</b>.</p>
            <input
              className="field-input"
              style={{ marginBottom: 6, textAlign: "center", fontFamily: "'Space Grotesk', sans-serif", fontSize: 22, letterSpacing: "0.3em" }}
              maxLength={6}
              inputMode="numeric"
              placeholder="••••••"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
            />
            {error && <div className="field-error" style={{ marginBottom: 10 }}><AlertTriangle size={12} /> {error}</div>}
            <div className="resend-row">
              {resendCooldown > 0
                ? <>Didn't get a code? Resend available in {resendCooldown}s</>
                : <>Didn't get a code? <span className="resend-link" onClick={resend}>{sending ? "Sending…" : "Resend code"}</span></>
              }
            </div>
            <button className="kt-btn" disabled={otp.length < 6 || verifying} style={(otp.length < 6 || verifying) ? { opacity: 0.4 } : {}} onClick={verifyCode}>
              {verifying ? "Verifying…" : <>Verify <CheckCircle2 size={15} /></>}
            </button>
          </>
        )}

        {step === "done" && <div className="success-box"><CheckCircle2 size={18} /> Phone number updated!</div>}
      </div>
    </div>
  );
}

