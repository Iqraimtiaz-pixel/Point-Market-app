// ── Extracted from App.jsx: SplashScreen ──
import React, { useRef } from "react";
import {
  ChevronRight,
  Lock,
  Shield,
  Gift,
  AlertTriangle
} from "lucide-react";
import { auth } from "../firebase";
import { GoogleIcon } from "../components/GoogleIcon";
import { PmHexLogo } from "../components/PmHexLogo";

export function SplashScreen({ onNext, onLogin, onAdminMode, onGoogleSignIn, error }) {
  const pressTimer = useRef(null);

  const startPress = () => {
    pressTimer.current = setTimeout(() => { onAdminMode && onAdminMode(); }, 1800);
  };
  const cancelPress = () => { if (pressTimer.current) clearTimeout(pressTimer.current); };

  return (
    <div className="splash">
      <div className="splash-glow" />
      <div
        className="logo-wrap"
        onMouseDown={startPress}
        onMouseUp={cancelPress}
        onMouseLeave={cancelPress}
        onTouchStart={startPress}
        onTouchEnd={cancelPress}
      >
        {/* The logo image already contains the "PointMarket · TRADE WITH POINTS" wordmark */}
        <PmHexLogo size="splash" />
      </div>
      <p className="tagline">Where <b>good deals happen</b>.<br />Trade skills, items &amp; services — earn PM Points with every honest trade.</p>
      <div className="splash-actions">
        <button className="kt-btn primary" onClick={onNext}>Create account <ChevronRight size={17} /></button>
        <button className="kt-btn ghost" style={{ marginTop: 12 }} onClick={onLogin}>I already have an account</button>
        <div className="auth-divider" style={{ margin: "14px 0 2px" }}><span>or</span></div>
        <button className="kt-btn google-btn" onClick={onGoogleSignIn}><GoogleIcon /> Continue with Google</button>
        {error && <div className="field-error" style={{ marginTop: 10 }}><AlertTriangle size={12} /> {error}</div>}
      </div>
      <div className="splash-badges">
        <div className="badge"><Shield size={13} /> Phone verified</div>
        <div className="badge"><Lock size={13} /> Secure auth</div>
        <div className="badge"><Gift size={13} /> 100 PM welcome gift</div>
      </div>
    </div>
  );
}

