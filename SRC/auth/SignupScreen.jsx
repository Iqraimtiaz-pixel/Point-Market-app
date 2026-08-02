// ── Extracted from App.jsx: DobPicker, SignupScreen ──
import React, { useState, useRef } from "react";
import {
  User,
  ChevronLeft,
  Send,
  Smartphone,
  Lock,
  Eye,
  EyeOff,
  Shield,
  Calendar,
  AlertTriangle,
  Mail,
  Phone as PhoneIcon
} from "lucide-react";
import { FieldWrap } from "../components/FieldWrap";
import { ProgressBar } from "../components/ProgressBar";

export function SignupScreen({ formData, updateForm, onSendOtp, onBack, error }) {
  const [showPass,  setShowPass]  = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [errors,    setErrors]    = useState({});

  const validate = () => {
    const e = {};
    if (!formData.fullName.trim())                      e.fullName = "Full name is required";
    if (!formData.dob) {
      e.dob = "Date of birth is required";
    } else {
      const birth   = new Date(formData.dob);
      const now     = new Date();
      const cutoff  = new Date(now.getFullYear() - 13, now.getMonth(), now.getDate());
      if (birth > cutoff)                               e.dob = "You must be at least 13 years old to sign up";
    }
    if (formData.phone.replace(/\D/,"").length < 7)    e.phone    = "Enter a valid phone number";
    if (formData.email && !/\S+@\S+\.\S+/.test(formData.email)) e.email = "Enter a valid email address";
    if (!formData.password || formData.password.length < 6)     e.password = "Password must be at least 6 characters";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const next = async () => {
    if (!validate()) return;
    setLoading(true);
    await onSendOtp();
    setLoading(false);
  };

  return (
    <div className="kt-scroll">
      <ProgressBar current="signup" />
      <div className="screen-pad">
        <button type="button" className="back-btn-inline" onClick={() => onBack && onBack()} style={{ marginBottom: 16 }}><ChevronLeft size={20} style={{ pointerEvents: "none" }} /></button>
        <div className="eyebrow"><Shield size={13} /> Step 1 of 5 · Create Account</div>
        <h1 className="screen-h1">Join Point Maker</h1>
        <p className="screen-sub">Fill in your details. Your phone number will be verified with a real SMS code.</p>

        <FieldWrap label="Full name" icon={<User size={15} />} error={errors.fullName}>
          <input className="field-input" placeholder="e.g. Samira Khan" value={formData.fullName} onChange={(e) => updateForm("fullName", e.target.value)} />
        </FieldWrap>

        <FieldWrap label="Date of birth" icon={<Calendar size={15} />} error={errors.dob}>
          <DobPicker value={formData.dob} onChange={(v) => updateForm("dob", v)} />
        </FieldWrap>

        <FieldWrap label="Country code" icon={<PhoneIcon size={15} />} error={null}>
          <select className="field-input" value={formData.countryCode} onChange={(e) => updateForm("countryCode", e.target.value)} style={{ border: "none", background: "none" }}>
            <option value="+92">🇵🇰 +92 Pakistan</option>
            <option value="+1">🇺🇸 +1 USA / Canada</option>
            <option value="+44">🇬🇧 +44 UK</option>
            <option value="+971">🇦🇪 +971 UAE</option>
            <option value="+966">🇸🇦 +966 Saudi Arabia</option>
          </select>
        </FieldWrap>

        <FieldWrap label="Mobile phone number" icon={<Smartphone size={15} />} error={errors.phone}>
          <input className="field-input" style={{ border: "none", padding: "0 0 0 4px", flex: 1 }} type="tel" inputMode="numeric" placeholder="3001234567" value={formData.phone} onChange={(e) => updateForm("phone", e.target.value)} />
        </FieldWrap>

        <FieldWrap label="Email address (optional — enables email login)" icon={<Mail size={15} />} error={errors.email}>
          <input className="field-input" type="email" inputMode="email" placeholder="you@example.com" value={formData.email} onChange={(e) => updateForm("email", e.target.value)} />
        </FieldWrap>

        <FieldWrap label="Password" icon={<Lock size={15} />} error={errors.password}>
          <div className="pass-row">
            <input className="field-input" style={{ border: "none", flex: 1, padding: 0 }} type={showPass ? "text" : "password"} placeholder="At least 6 characters" value={formData.password} onChange={(e) => updateForm("password", e.target.value)} />
            <button className="pass-eye" onClick={() => setShowPass(!showPass)}>
              {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </FieldWrap>

        {error && <div className="field-error" style={{ marginBottom: 14 }}><AlertTriangle size={12} /> {error}</div>}

        <div className="hint-row"><Shield size={13} /><span>A real SMS will be sent to your phone number for verification.</span></div>
        <div className="hint-row"><Mail size={13} /><span>Providing an email lets you sign in with email + password as well.</span></div>
        <div className="terms">By creating an account you agree to our <b>Terms of Service</b> and <b>Privacy Policy</b>.</div>

        <button className="kt-btn primary" disabled={loading} style={loading ? { opacity: 0.6 } : {}} onClick={next}>
          {loading ? "Sending verification code…" : <><Smartphone size={15} /> Send verification code</>}
        </button>
      </div>
    </div>
  );
}


export function DobPicker({ value, onChange }) {
  const MONTHS = [
    "January","February","March","April","May","June",
    "July","August","September","October","November","December",
  ];

  // Parse an initial ISO string so the picker is pre-filled when editing.
  const parseVal = (v) => {
    if (!v || !v.includes("-")) return { year: "", month: "", day: "" };
    const [y, m, d] = v.split("-");
    return { year: y || "", month: m || "", day: d || "" };
  };
  const initial = parseVal(value);

  // ── Local state for each field ──────────────────────────────────────────
  // Critical: we DO NOT derive month/day/year from the external `value` prop
  // on every render. If we did, selecting Month would call onChange("") which
  // resets formData.dob to "", which re-renders the picker with all blanks,
  // losing the just-selected month. Local state preserves partial selections.
  const [selMonth, setSelMonth] = useState(initial.month);
  const [selDay,   setSelDay]   = useState(initial.day);
  const [selYear,  setSelYear]  = useState(initial.year);

  // Re-sync local state if the parent supplies a genuinely different value
  // (e.g. form prefill/reset) without this component unmounting. We only
  // do this when the incoming value doesn't match what we already have,
  // so partial in-progress selections are never wiped by our own onChange("").
  const lastExternalValue = useRef(value);
  if (value !== lastExternalValue.current) {
    lastExternalValue.current = value;
    const next = parseVal(value);
    if (next.month !== selMonth) setSelMonth(next.month);
    if (next.day   !== selDay)   setSelDay(next.day);
    if (next.year  !== selYear)  setSelYear(next.year);
  }

  const currentYear  = new Date().getFullYear();
  const maxBirthYear = currentYear - 13;
  const years = Array.from({ length: maxBirthYear - 1939 }, (_, i) => maxBirthYear - i);

  const getDays = (y, m) => {
    if (!y || !m) return 31;
    return new Date(parseInt(y), parseInt(m), 0).getDate();
  };
  const days = Array.from({ length: getDays(selYear, selMonth) }, (_, i) => i + 1);

  // Clamp day when month/year changes reduce the number of available days.
  const clampDay = (d, y, m) => {
    if (!d) return d;
    const maxD = getDays(y, m);
    return parseInt(d) > maxD ? String(maxD).padStart(2, "0") : d;
  };

  // Emit the full ISO string when all three fields are filled; clear parent
  // when incomplete so formData.dob never holds a stale value.
  // This is safe now because local state (selMonth/selDay/selYear) is stored
  // in useState — it is NOT derived from the value prop on every render, so
  // calling onChange("") here only resets the parent without wiping the picker.
  const emit = (m, d, y) => {
    if (m && d && y) {
      onChange(`${y}-${m.padStart(2,"0")}-${d.padStart(2,"0")}`);
    } else {
      onChange("");
    }
  };

  const handleMonth = (m) => {
    setSelMonth(m);
    const clamped = clampDay(selDay, selYear, m);
    if (clamped !== selDay) setSelDay(clamped);
    emit(m, clamped || selDay, selYear);
  };

  const handleDay = (d) => {
    setSelDay(d);
    emit(selMonth, d, selYear);
  };

  const handleYear = (y) => {
    setSelYear(y);
    const clamped = clampDay(selDay, y, selMonth);
    if (clamped !== selDay) setSelDay(clamped);
    emit(selMonth, clamped || selDay, y);
  };

  const selStyle = {
    border: "none", background: "none", color: "inherit",
    fontFamily: "inherit", fontSize: 14, flex: 1,
    outline: "none", cursor: "pointer", minWidth: 0,
    // Real, tappable hit area (was collapsing to ~18px tall with no
    // padding, which made the control hard to hit accurately on touch
    // screens and easy to mis-click on desktop too).
    minHeight: 44, padding: "10px 2px",
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, flex: 1, minWidth: 0 }}>
      <select id="dob-month" name="dob-month" style={{ ...selStyle, flex: 1.6 }} value={selMonth} onChange={(e) => handleMonth(e.target.value)}>
        <option value="">Month</option>
        {MONTHS.map((m, i) => (
          <option key={i} value={String(i + 1).padStart(2, "0")}>{m}</option>
        ))}
      </select>
      <span style={{ color: "rgba(96,165,250,0.35)", flexShrink: 0, userSelect: "none" }}>|</span>
      <select id="dob-day" name="dob-day" style={{ ...selStyle, flex: 0.7 }} value={selDay} onChange={(e) => handleDay(e.target.value)}>
        <option value="">Day</option>
        {days.map((d) => (
          <option key={d} value={String(d).padStart(2, "0")}>{d}</option>
        ))}
      </select>
      <span style={{ color: "rgba(96,165,250,0.35)", flexShrink: 0, userSelect: "none" }}>|</span>
      <select id="dob-year" name="dob-year" style={{ ...selStyle, flex: 1.1 }} value={selYear} onChange={(e) => handleYear(e.target.value)}>
        <option value="">Year</option>
        {years.map((y) => (
          <option key={y} value={String(y)}>{y}</option>
        ))}
      </select>
    </div>
  );
}

