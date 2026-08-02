// ── Extracted from App.jsx: WalletScreen, ledgerReasonLabel ──
import React, { useState, useEffect } from "react";
import {
  PlusCircle,
  ChevronLeft,
  CheckCircle2,
  Wallet,
  ChevronRight,
  TrendingUp,
  Lock,
  AlertTriangle,
  Activity
} from "lucide-react";
import {
  doc,
  collection,
  query as fsQuery,
  where,
  orderBy,
  limit,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../firebase";
import AdsterraNativeBanner from "../components/AdsterraNativeBanner";

export function WalletScreen({ onBack, currentUser, onOpenCreate, onOpenShop }) {
  const [profile,  setProfile]  = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [ledger,   setLedger]   = useState([]);
  const [ledgerErr, setLedgerErr] = useState(null);

  // Live user profile (balance + lock status)
  useEffect(() => {
    if (!currentUser?.uid) { setLoading(false); return; }
    setLoading(true);
    const unsub = onSnapshot(
      doc(db, "users", currentUser.uid),
      (snap) => { setProfile(snap.exists() ? snap.data() : null); setLoading(false); },
      () => setLoading(false)
    );
    return unsub;
  }, [currentUser?.uid]);

  // Live transaction / points ledger history
  useEffect(() => {
    if (!currentUser?.uid) return;
    try {
      const q = fsQuery(
        collection(db, "points_ledger"),
        where("uid", "==", currentUser.uid),
        orderBy("createdAt", "desc"),
        limit(20)
      );
      const unsub = onSnapshot(q,
        (snap) => { setLedger(snap.docs.map((d) => ({ id: d.id, ...d.data() }))); setLedgerErr(null); },
        (err) => { console.warn("Ledger listener error:", err.message); setLedgerErr("Could not load transaction history."); }
      );
      return unsub;
    } catch (e) {
      setLedgerErr("Could not load transaction history.");
    }
  }, [currentUser?.uid]);

  const pmPoints     = profile?.pmPoints ?? currentUser?.pmPoints ?? 0;
  const pointsStatus = profile?.pointsStatus ?? currentUser?.pointsStatus ?? "locked";
  const isLocked      = pointsStatus === "locked";

  return (
    <div className="kt-scroll">
      <div className="screen-header">
        <button className="back-btn-inline" onClick={onBack}><ChevronLeft size={20} /></button>
        <h2>Wallet</h2>
      </div>

      <div className="wallet-balance-card">
        <div className="wallet-balance-label"><Wallet size={13} /> PM Points Balance</div>
        {loading ? (
          <div className="wallet-balance-amount">Loading…</div>
        ) : (
          <div className="wallet-balance-amount">{pmPoints.toLocaleString()} <span>PM</span></div>
        )}
        <div className={`wallet-status-chip ${isLocked ? "locked" : "active"}`}>
          {isLocked ? <><Lock size={11} /> Locked</> : <><CheckCircle2 size={11} /> Active</>}
        </div>
        {isLocked && (
          <p className="wallet-balance-hint">
            Your 100 PM welcome bonus unlocks automatically after your first listing or trade.
          </p>
        )}
      </div>

      <div style={{ display: "flex", gap: 10, padding: "0 16px 6px" }}>
        <button className="kt-btn ghost" style={{ flex: 1 }} onClick={onOpenShop}>
          <TrendingUp size={15} /> Get More PM
        </button>
        <button className="kt-btn" style={{ flex: 1 }} onClick={onOpenCreate}>
          <PlusCircle size={15} /> New Listing
        </button>
      </div>

      <div className="section-title">Transaction History</div>
      {ledgerErr && (
        <div className="empty-state" style={{ color: "#dc2626" }}>
          <AlertTriangle size={18} style={{ marginBottom: 6 }} />
          <div style={{ fontWeight: 700, fontSize: 13.5 }}>{ledgerErr}</div>
        </div>
      )}
      {!ledgerErr && ledger.length === 0 && (
        <div className="empty-state">
          <div style={{ fontSize: 24, marginBottom: 6 }}>🧾</div>
          <div style={{ fontWeight: 700, fontSize: 13.5 }}>No transactions yet</div>
          <div style={{ fontSize: 12, color: "#6f8b80" }}>Your PM Points activity will show up here.</div>
        </div>
      )}
      {!ledgerErr && ledger.map((tx) => (
        <div key={tx.id} className="payment-history-row" style={{ margin: "0 16px" }}>
          <div className="payment-history-icon" style={{ color: tx.type === "debit" ? "#dc2626" : "#16a34a" }}>
            {tx.type === "debit" ? <ChevronLeft size={16} style={{ transform: "rotate(-45deg)" }} /> : <ChevronRight size={16} style={{ transform: "rotate(-135deg)" }} />}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 13 }}>{ledgerReasonLabel(tx.reason)}</div>
            <div style={{ fontSize: 11.5, color: "#6b7587" }}>
              {tx.createdAt?.toDate ? tx.createdAt.toDate().toLocaleString() : "Just now"} · {tx.status === "locked" ? "Locked" : "Available"}
            </div>
          </div>
          <span style={{ fontWeight: 700, fontSize: 13.5, color: tx.type === "debit" ? "#dc2626" : "#16a34a" }}>
            {tx.type === "debit" ? "−" : "+"}{tx.amount} PM
          </span>
        </div>
      ))}

      {/* Native ad slot at the bottom of the Wallet screen */}
      <div style={{ padding: "0 16px" }}>
        <AdsterraNativeBanner />
      </div>
    </div>
  );
}


export function ledgerReasonLabel(reason) {
  const labels = {
    WELCOME_BONUS:   "Welcome Bonus",
    BOOST_PURCHASE:  "Post Boost Purchase",
    POINTS_PURCHASE: "PM Points Purchase",
    CERT_PURCHASE:   "Verification Certification",
    TRADE_REWARD:    "Trade Reward",
  };
  return labels[reason] || reason || "Points Activity";
}

