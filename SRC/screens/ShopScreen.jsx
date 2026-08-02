// ── Extracted from App.jsx: JazzCashMark, JazzCashPaymentFlow, PaymentResultPanel, PaymentVerifyingState, ShopScreen ──
import React, { useState, useEffect, useRef } from "react";
import {
  Home,
  Star,
  CheckCircle2,
  Sparkles,
  ChevronRight,
  TrendingUp,
  Award,
  AlertTriangle,
  ScanEye,
  ShieldCheck,
  BadgeCheck,
  Copy,
  Clock,
  Receipt,
  ShieldX,
  Zap
} from "lucide-react";
import AdsterraNativeBanner from "../components/AdsterraNativeBanner";
import { ScoreTile } from "../components/ScoreTile";
import { JAZZCASH_ACCOUNT, BOOST_PLANS, CERT_PRICE, runPaymentVerificationEngine, paymentStatusLabel, paymentStatusColor } from "../utils/paymentEngine";
import { submitTransaction } from "../utils/platformStore";

export function ShopScreen() {
  const [activeFlow, setActiveFlow] = useState(null); // null | 'points' | 'boost' | 'cert'
  const [transactions, setTransactions] = useState([]); // local payment history this session

  const recordTransaction = (tx) => { setTransactions((prev) => [tx, ...prev]); submitTransaction(tx); };

  return (
    <div className="kt-scroll">
      <div className="screen-header"><h2>Shop</h2></div>

      {/* ── PREMIUM BOOST PLANS ── */}
      <div className="boost-hero">
        <div className="boost-hero-icon"><Sparkles size={22} /></div>
        <div className="boost-hero-title">Premium Post Boost</div>
        <div className="boost-hero-sub">Get seen first. Boosted listings appear at the top of the Home Feed and rank higher in search — pay once via JazzCash, no subscription.</div>
      </div>
      <div className="boost-grid">
        {BOOST_PLANS.map((plan) => {
          const TierIcon = plan.tier === "gold" ? Award : plan.tier === "popular" ? TrendingUp : Zap;
          return (
            <div key={plan.id} className={`boost-card boost-tier-${plan.tier} ${plan.recommended ? "recommended" : ""}`} onClick={() => setActiveFlow({ type: "boost", plan })}>
              {plan.badge && <div className="boost-badge">{plan.tier === "gold" ? <BadgeCheck size={11} /> : plan.recommended ? <Star size={11} fill="currentColor" /> : <Sparkles size={11} />} {plan.badge}</div>}
              <div className="boost-card-icon"><TierIcon size={22} /></div>
              <div className="boost-card-label">{plan.label}</div>
              <div className="boost-card-sub">{plan.subtitle}</div>
              <div className="boost-card-price">Rs. {plan.amount.toLocaleString()}</div>
              <ul className="boost-card-features">
                {plan.features.map((feature) => (
                  <li key={feature}><CheckCircle2 size={14} /> <span>{feature}</span></li>
                ))}
              </ul>
              <button className="boost-card-cta" onClick={(e) => { e.stopPropagation(); setActiveFlow({ type: "boost", plan }); }}>
                Boost Now <ChevronRight size={15} />
              </button>
            </div>
          );
        })}
      </div>

      {/* ── SELLER BADGES INFO CARD ── */}
      <div className="monetize-card">
        <div className="monetize-head">
          <div className="monetize-icon"><ShieldCheck size={20} /></div>
          <div><div className="monetize-title">Seller Badges</div><div className="monetize-sub">Automatic reputation tiers earned by strong seller performance.</div></div>
        </div>
        <div style={{ display: "grid", gap: 18, marginTop: 14 }}>
          <div>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Silver Trusted Seller</div>
            <ul style={{ paddingLeft: 20, marginBottom: 10, color: "#344054", fontSize: 13, lineHeight: 1.6 }}>
              <li>Average AI score above 80</li>
              <li>At least 60 successful listings</li>
              <li>0 flagged listings</li>
              <li>Good seller reputation</li>
            </ul>
            <div style={{ color: "#0f172a", fontSize: 13 }}>
              Reward: Silver Trusted Seller Badge, higher buyer trust, better visibility in search.
            </div>
          </div>
          <div>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Gold Premium Seller</div>
            <ul style={{ paddingLeft: 20, marginBottom: 10, color: "#344054", fontSize: 13, lineHeight: 1.6 }}>
              <li>Average AI score above 92</li>
              <li>At least 250 successful listings</li>
              <li>0 flagged listings</li>
              <li>Excellent long-term seller reputation</li>
            </ul>
            <div style={{ color: "#0f172a", fontSize: 13 }}>
              Reward: Gold Premium Seller Badge, maximum buyer trust, highest search ranking, premium seller recognition.
            </div>
          </div>
          <div style={{ padding: "12px 14px", border: "1px solid rgba(148,163,184,0.35)", borderRadius: 14, background: "rgba(241,245,249,0.82)", color: "#334155", fontSize: 13 }}>
            Important: these badges cannot be purchased. They are earned automatically by the system when all conditions are met.
          </div>
        </div>
      </div>

      {/* ── PAYMENT HISTORY ── */}
      {transactions.length > 0 && (
        <div className="monetize-card">
          <div className="monetize-title" style={{ marginBottom: 12 }}>Payment History</div>
          {transactions.map((tx) => (
            <div key={tx.id} className="payment-history-row">
              <div className="payment-history-icon" style={{ color: paymentStatusColor(tx.status) }}><Receipt size={16} /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{tx.label}</div>
                <div style={{ fontSize: 11.5, color: "#6b7587" }}>Rs. {tx.amount.toLocaleString()} · {new Date(tx.at).toLocaleString()}</div>
              </div>
              <span className="payment-status-pill" style={{ color: paymentStatusColor(tx.status), borderColor: paymentStatusColor(tx.status) }}>
                {paymentStatusLabel(tx.status)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Native ad slot — hidden while the payment overlay is open */}
      {!activeFlow && <AdsterraNativeBanner />}

      {activeFlow && (
        <JazzCashPaymentFlow
          flow={activeFlow}
          onClose={() => setActiveFlow(null)}
          onComplete={(tx) => { recordTransaction(tx); }}
        />
      )}
    </div>
  );
}


export function JazzCashMark({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" style={{ flexShrink: 0 }}>
      <rect width="40" height="40" rx="9" fill="#D6001C" />
      <path d="M11 26 L17 14 L20 14 L14 26 Z" fill="#fff" />
      <path d="M20 26 L26 14 L29 14 L23 26 Z" fill="#fff" />
      <circle cx="29.5" cy="14.5" r="1.6" fill="#fff" />
    </svg>
  );
}


export function JazzCashPaymentFlow({ flow, onClose, onComplete }) {
  const [step, setStep] = useState("instructions"); // instructions | upload | verifying | result
  const [screenshotFile, setScreenshotFile] = useState(null);
  const [screenshotUrl,  setScreenshotUrl]  = useState(null);
  const [transactionId,  setTransactionId]  = useState("");
  const [report, setReport] = useState(null);
  const fileRef = useRef(null);

  const amount = flow.type === "boost" ? flow.plan.amount : flow.type === "points" ? flow.pkg.price : CERT_PRICE.amount;
  const label  = flow.type === "boost" ? flow.plan.label : flow.type === "points" ? `${flow.pkg.points.toLocaleString()} PM Points` : CERT_PRICE.label;

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setScreenshotFile(file);
    setScreenshotUrl(URL.createObjectURL(file));
  };

  const submitPayment = () => {
    setStep("verifying");
    setTimeout(() => {
      const result = runPaymentVerificationEngine({ expectedAmount: amount, screenshotFile, transactionId });
      setReport(result);
      setStep("result");

      if (result.status === "verified") {
        onComplete({
          id: `tx-${Date.now()}`,
          label,
          amount,
          status: "verified",
          at: result.verifiedAt,
          points: flow.type === "points" ? flow.pkg.points : null,
        });
      } else {
        onComplete({
          id: `tx-${Date.now()}`,
          label,
          amount,
          status: result.status,
          at: result.verifiedAt,
          points: null,
        });
      }
    }, 2200);
  };

  const copyNumber = () => {
    try { navigator.clipboard?.writeText(JAZZCASH_ACCOUNT.number.replace(/-/g, "")); } catch (e) {}
  };

  return (
    <div className="sheet-backdrop" onClick={(e) => { if (e.target === e.currentTarget && step !== "verifying") onClose(); }}>
      <div className="sheet">
        <div className="sheet-handle" />

        {step === "instructions" && (
          <>
            <div className="jc-header-row">
              <JazzCashMark size={32} />
              <div>
                <h3 className="sheet-title" style={{ marginBottom: 0 }}>Pay with JazzCash</h3>
                <p className="sheet-sub" style={{ marginBottom: 0 }}>{label}</p>
              </div>
            </div>

            <div className="jc-amount-box">
              <div className="jc-amount-label">Amount payable</div>
              <div className="jc-amount-value">Rs. {amount.toLocaleString()}</div>
            </div>

            <div className="jc-detail-row">
              <div>
                <div className="jc-detail-label">JazzCash Number</div>
                <div className="jc-detail-value">{JAZZCASH_ACCOUNT.number}</div>
              </div>
              <button className="jc-copy-btn" onClick={copyNumber}><Copy size={14} /> Copy</button>
            </div>
            <div className="jc-detail-row">
              <div>
                <div className="jc-detail-label">Account Title</div>
                <div className="jc-detail-value">{JAZZCASH_ACCOUNT.title}</div>
              </div>
            </div>

            <div className="jc-steps">
              <div className="jc-step"><span className="step-num">1</span> Open your JazzCash app and send Rs. {amount.toLocaleString()} to the number above</div>
              <div className="jc-step"><span className="step-num">2</span> Take a screenshot of the successful payment receipt</div>
              <div className="jc-step"><span className="step-num">3</span> Upload it below along with the Transaction ID</div>
            </div>

            <button className="kt-btn" onClick={() => setStep("upload")}>I've sent the payment <ChevronRight size={16} /></button>
            <button className="kt-btn ghost" style={{ marginTop: 8 }} onClick={onClose}>Cancel</button>
          </>
        )}

        {step === "upload" && (
          <>
            <h3 className="sheet-title">Submit payment proof</h3>
            <p className="sheet-sub">Upload your JazzCash receipt screenshot and enter the Transaction ID exactly as shown.</p>

            <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFile} />
            {!screenshotUrl ? (
              <div className="upload-box" style={{ margin: "0 0 14px", cursor: "pointer" }} onClick={() => fileRef.current?.click()}>
                <Receipt size={26} style={{ color: "#D6001C" }} />
                <div style={{ fontWeight: 700, marginTop: 6, color: "var(--ink)" }}>Upload payment screenshot</div>
                <div style={{ fontSize: 12, marginTop: 4, color: "#6b7587" }}>Choose from gallery — must show amount, date/time, and Transaction ID</div>
              </div>
            ) : (
              <div className="upload-box" style={{ margin: "0 0 14px", padding: 12 }}>
                <img src={screenshotUrl} alt="Payment receipt" style={{ width: "100%", borderRadius: 12, maxHeight: 220, objectFit: "cover" }} />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                  <span style={{ fontSize: 12, color: "var(--ink)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "70%" }}>{screenshotFile?.name}</span>
                  <button className="kt-btn ghost" style={{ width: "auto", padding: "7px 12px", fontSize: 12 }} onClick={() => { setScreenshotUrl(null); setScreenshotFile(null); }}>Replace</button>
                </div>
              </div>
            )}

            <div className="field-label">JazzCash Transaction ID</div>
            <input className="field-input" style={{ marginBottom: 16 }} placeholder="e.g. 8L52K9XQ3T" value={transactionId} onChange={(e) => setTransactionId(e.target.value)} />

            <div className="jc-ai-notice"><ScanEye size={14} /> Your payment will be automatically verified by AI within seconds</div>

            <button className="kt-btn" disabled={!screenshotUrl || !transactionId.trim()} style={!screenshotUrl || !transactionId.trim() ? { opacity: 0.4 } : {}} onClick={submitPayment}>
              Submit for verification <ShieldCheck size={16} />
            </button>
            <button className="kt-btn ghost" style={{ marginTop: 8 }} onClick={() => setStep("instructions")}>Back</button>
          </>
        )}

        {step === "verifying" && <PaymentVerifyingState />}

        {step === "result" && report && (
          <PaymentResultPanel flow={flow} amount={amount} label={label} report={report} onClose={onClose} />
        )}
      </div>
    </div>
  );
}


export function PaymentVerifyingState() {
  const [idx, setIdx] = useState(0);
  const steps = ["Reading receipt details…", "Matching payment amount…", "Checking for duplicates…", "Confirming JazzCash receipt format…"];
  useEffect(() => {
    if (idx < steps.length - 1) {
      const t = setTimeout(() => setIdx((s) => s + 1), 480);
      return () => clearTimeout(t);
    }
  }, [idx]);
  return (
    <div className="ai-scan-wrap" style={{ padding: "40px 16px 24px" }}>
      <div className="ai-scan-ring"><ShieldCheck size={32} /></div>
      <div className="ai-scan-title">AI Payment Verification</div>
      <div className="ai-scan-sub">Analyzing your JazzCash receipt…</div>
      <div className="ai-scan-steps">
        {steps.map((s, i) => (
          <div key={i} className={`ai-scan-step ${i <= idx ? "active" : ""}`}>
            {i < idx ? <CheckCircle2 size={14} /> : <span className="ai-scan-dot" />}
            {s}
          </div>
        ))}
      </div>
    </div>
  );
}


export function PaymentResultPanel({ flow, amount, label, report, onClose }) {
  const color = paymentStatusColor(report.status);
  const StatusIcon = report.status === "verified" ? ShieldCheck : report.status === "review" ? Clock : ShieldX;

  return (
    <>
      <div className="ai-result-hero" style={{ paddingTop: 8 }}>
        <div className="ai-result-ring" style={{ borderColor: color, width: 92, height: 92 }}>
          <StatusIcon size={30} color={color} />
        </div>
        <div className="ai-result-band" style={{ color }}>{paymentStatusLabel(report.status)}</div>
        <div className="ai-result-item-title">{label} · Rs. {amount.toLocaleString()}</div>
      </div>

      {report.status === "verified" && (
        <div className="success-box" style={{ margin: "0 16px 14px" }}>
          <CheckCircle2 size={18} />
          {flow.type === "points"
            ? `${flow.pkg.points.toLocaleString()} PM Points have been credited to your wallet instantly.`
            : flow.type === "boost"
              ? `Your post is now boosted: ${flow.plan.label}.`
              : "Your payment was verified successfully."}
        </div>
      )}

      {report.status === "review" && (
        <div className="warning-box" style={{ margin: "0 16px 14px", background: "rgba(184,134,11,0.08)", borderColor: "rgba(184,134,11,0.25)", color: "#92660a" }}>
          <Clock size={16} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 13 }}>Marked for manual review</div>
            <div style={{ fontSize: 12, marginTop: 3 }}>We couldn't confirm every detail automatically. Your payment is queued for review and points will be credited once confirmed — usually within a few hours.</div>
          </div>
        </div>
      )}

      {report.status === "rejected" && (
        <div className="warning-box" style={{ margin: "0 16px 14px" }}>
          <ShieldX size={16} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 13 }}>Payment rejected</div>
            <div style={{ fontSize: 12, marginTop: 3 }}>This submission failed AI verification. Please review the issues below, then try submitting again with a valid screenshot and Transaction ID.</div>
          </div>
        </div>
      )}

      <div className="score-grid">
        <ScoreTile label="Amount Match" value={report.amountMatchConfidence} />
        <ScoreTile label="Receipt Validity" value={report.receiptStructureScore} />
      </div>

      <div className="kp-result-card">
        <div className="kp-result-label"><ShieldCheck size={13} /> Verification Confidence</div>
        <div className="kp-result-amount" style={{ color }}>{report.confidence}%</div>
        <div className="kp-result-formula">Transaction ID: {report.transactionId || "—"}</div>
      </div>

      {report.flags.length > 0 && (
        <div className="flags-section">
          <div className="section-title" style={{ paddingTop: 0 }}>AI Notes</div>
          {report.flags.map((f, i) => (
            <div key={i} className="ai-flag-row"><AlertTriangle size={13} /> {f}</div>
          ))}
        </div>
      )}

      <div className="field-block" style={{ paddingTop: 6 }}>
        <button className="kt-btn" onClick={onClose}><CheckCircle2 size={16} /> Done</button>
      </div>
    </>
  );
}

