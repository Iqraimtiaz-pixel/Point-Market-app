// ── Extracted from App.jsx: SuccessScreen ──
import React from "react";
import {
  Sparkles,
  ChevronRight,
  Lock,
  Gift,
  AlertTriangle
} from "lucide-react";
import { ProgressBar } from "../components/ProgressBar";

export function SuccessScreen({ name, deviceBlocked, userLocation, onEnter }) {
  const firstName = name ? name.split(" ")[0] : "Trader";

  return (
    <div className="kt-scroll">
      <ProgressBar current="success" />

      <div className="screen-pad success-pad">
        {/* Confetti emoji header */}
        <div className="success-hero">
          <div className="success-avatar">🧑‍🚀</div>
          <div className="success-confetti">🎉</div>
        </div>

        <h1 className="screen-h1" style={{ textAlign: "center" }}>Welcome, {firstName}!</h1>
        <p className="screen-sub" style={{ textAlign: "center" }}>Your Point Maker account is live. Here's your welcome gift.</p>

        {/* Reward card */}
        <div className={`reward-card ${deviceBlocked ? "blocked-card" : ""}`}>
          <div className="reward-top">
            <Gift size={22} />
            <div className="reward-label">Welcome Bonus</div>
          </div>
          <div className="reward-amount">{deviceBlocked ? "+0" : "+100"} PM</div>

          {deviceBlocked ? (
            <div className="reward-lock-tag blocked">
              <AlertTriangle size={12} /> Bonus withheld — device reuse detected
            </div>
          ) : (
            <div className="reward-lock-tag">
              <Lock size={12} /> Locked balance
            </div>
          )}

          <p className="reward-note">
            {deviceBlocked
              ? "This device is linked to another account. Your account is still active, but the bonus is withheld to prevent multi-account fraud."
              : "Your 100 PM are reserved for you and will unlock automatically when you upload your first item or skill video. This ensures a fair, active marketplace."}
          </p>

          {!deviceBlocked && (
            <div className="unlock-steps">
              <div className="unlock-title">How to unlock your PM</div>
              <div className="unlock-step"><span className="step-num">1</span> Post your first item or skill video</div>
              <div className="unlock-step"><span className="step-num">2</span> Your 100 PM unlock instantly</div>
              <div className="unlock-step"><span className="step-num">3</span> Start trading with your balance!</div>
            </div>
          )}
        </div>

        {/* Security summary */}
        <div className="summary-card">
          <div className="summary-title"><Sparkles size={14} /> Account summary</div>
          <div className="summary-row"><span>PM ID</span><b>PM-{Math.floor(Math.random() * 9000 + 1000)}</b></div>
          <div className="summary-row"><span>Phone</span><b>Verified ✓</b></div>
          <div className="summary-row"><span>Location</span><b>{userLocation?.city || "Not set"}</b></div>
          <div className="summary-row"><span>Device</span><b style={{ color: deviceBlocked ? "#ef4444" : "#1d4ed8" }}>{deviceBlocked ? "Flagged" : "Trusted ✓"}</b></div>
          <div className="summary-row"><span>PM Points balance</span><b style={{ color: "#1d4ed8" }}>{deviceBlocked ? "0 PM" : "100 PM (locked)"}</b></div>
        </div>

        <button className="kt-btn primary" onClick={onEnter}>
          Enter Point Maker <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

