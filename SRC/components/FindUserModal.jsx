// ── Extracted from App.jsx: FindUserModal ──
import React, { useState } from "react";
import {
  Search,
  MessageCircle,
  Star,
  CheckCircle2,
  ChevronRight,
  Award
} from "lucide-react";
import {
  collection,
  query as fsQuery,
  limit,
  getDocs,
} from "firebase/firestore";
import { db } from "../firebase";
import { getUserByUsername } from "../services/socialService";
import { USER_DIRECTORY } from "../utils/mockData";

export function FindUserModal({ onClose, onOpenChat, onOpenPmSpace }) {
  const [query,  setQuery]  = useState("");
  const [result, setResult] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [searching, setSearching] = useState(false);

  // ── Real Firestore lookup ──
  // Previously this only checked USER_DIRECTORY, which is declared as a
  // permanently empty array (const USER_DIRECTORY = [];) elsewhere in this
  // file — so every search fell through to "No trader found" regardless of
  // input. This now queries the real `users` collection via the existing
  // (previously unused) socialService helpers.
  const search = async () => {
    const raw = query.trim();
    if (!raw) return;
    setSearching(true);
    setNotFound(false);
    setResult(null);
    try {
      let profile = null;

      if (/^pm-[a-z0-9]{4,}$/i.test(raw)) {
        // PM ID search — the ID shown in the app (e.g. PM-A1B2C3) is derived
        // from the first 6 characters of the user's Firebase uid. There's no
        // stored "pmId" field, so match it against the real uid prefix.
        const idPart = raw.slice(3).toLowerCase();
        const snap = await getDocs(fsQuery(collection(db, "users"), limit(200)));
        const match = snap.docs.find((d) => d.id.slice(0, idPart.length).toLowerCase() === idPart);
        profile = match ? { uid: match.id, ...match.data() } : null;
      } else {
        const handle = raw.startsWith("@") ? raw.slice(1) : raw;
        profile = await getUserByUsername(handle);
      }

      if (profile) {
        setResult({
          id:         profile.uid ? `PM-${profile.uid.slice(0, 6).toUpperCase()}` : "PM-000",
          user:       `@${profile.username || "trader"}`,
          name:       profile.fullName || profile.username || "Trader",
          avatar:     profile.avatarEmoji || "🧑",
          avatarUrl:  profile.avatarUrl || null,
          verified:   !!profile.isVerified,
          karmaScore: profile.karmaScore ?? 0,
          trades:     profile.totalTrades ?? 0,
          uid:        profile.uid,
        });
        setNotFound(false);
      } else {
        setNotFound(true);
      }
    } catch (e) {
      console.warn("Trader search failed:", e?.message || e);
      setNotFound(true);
    } finally {
      setSearching(false);
    }
  };

  const goToProfile = (username) => {
    if (onOpenPmSpace) { onOpenPmSpace(username); onClose(); }
  };

  return (
    <div className="sheet-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet">
        <div className="sheet-handle" />
        <h3 className="sheet-title">Find a Trader</h3>
        <p className="sheet-sub">Enter a trader's <b>PM ID</b> (e.g. PM-003) or <b>username</b> (e.g. @priya.codes) to start a conversation about a deal.</p>

        <div className="search-pill" style={{ marginBottom: 12 }}>
          <Search size={15} />
          <input className="search-input" placeholder="PM-001 or @username" value={query} onChange={(e) => { setQuery(e.target.value); setResult(null); setNotFound(false); }} onKeyDown={(e) => e.key === "Enter" && search()} />
        </div>
        <button className="kt-btn" onClick={search} disabled={searching}><Search size={15} /> {searching ? "Searching…" : "Search trader"}</button>

        {notFound && <div className="empty-state" style={{ padding: "16px 0 0" }}>No trader found for "<b>{query}</b>". Check the ID and try again.</div>}

        {result && (
          <div className="user-result">
            <div className="avatar-lg" style={{ flexShrink: 0, cursor: "pointer" }} onClick={() => goToProfile(result.user)}>{result.avatar}</div>
            <div style={{ flex: 1, cursor: "pointer" }} onClick={() => goToProfile(result.user)}>
              <div style={{ fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", gap: 5 }}>{result.name} {result.verified && <CheckCircle2 size={13} color="#22c55e" />}</div>
              <div style={{ fontSize: 12.5, color: "#6f8b80" }}>{result.user} · ID: {result.id}</div>
              <div style={{ display: "flex", gap: 12, marginTop: 6 }}>
                <span className="seller-stat"><Star size={12} fill="#16a34a" color="#16a34a" /> {result.karmaScore}</span>
                <span className="seller-stat"><Award size={12} /> {result.trades} trades</span>
              </div>
            </div>
            <button
              className="kt-btn"
              style={{ width: "auto", padding: "10px 16px", flexShrink: 0 }}
              onClick={() => onOpenChat({ id: result.id, otherUid: result.uid, user: result.user, avatar: result.avatar, avatarUrl: result.avatarUrl })}
            >
              <MessageCircle size={15} /> Message
            </button>
          </div>
        )}

        <div className="section-title" style={{ marginTop: 16 }}>All traders</div>
        {USER_DIRECTORY.length === 0 ? (
          <div className="empty-state" style={{ padding: "16px 0 0" }}>No traders are currently registered in the demo directory.</div>
        ) : (
          USER_DIRECTORY.map((u) => (
            <div key={u.id} className="user-dir-row" onClick={() => goToProfile(u.user)}>
              <div className="avatar-sm" style={{ width: 38, height: 38, fontSize: 18, flexShrink: 0 }}>{u.avatar}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 13, display: "flex", alignItems: "center", gap: 4 }}>{u.name} <span style={{ color: "#6f8b80", fontWeight: 400 }}>{u.user}</span> {u.verified && <CheckCircle2 size={12} color="#22c55e" />}</div>
                <div style={{ fontSize: 11.5, color: "#16a34a", fontWeight: 600 }}>{u.id}</div>
              </div>
              <ChevronRight size={16} color="#6f8b80" />
            </div>
          ))
        )}
      </div>
    </div>
  );
}

