// ── Extracted from App.jsx: FindUserScreen, PmSpaceScreen ──
import React, { useState, useEffect } from "react";
import {
  MessageCircle,
  ChevronLeft,
  CheckCircle2,
  MapPin,
  UserPlus,
  UserCheck
} from "lucide-react";
import {
  doc,
  collection,
  query as fsQuery,
  where,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../firebase";
import { getUserByUsername } from "../services/socialService";
import { EditProfileSheet } from "../Profile/EditProfileSheet";
import { FindUserModal } from "../components/FindUserModal";
import { useLiveProfileStats } from "../hooks/useLiveProfileStats";

export function PmSpaceScreen({ username, onBack, onOpenDetail, isFollowing, onToggleFollow, onOpenChat }) {
  const [profile,  setProfile]  = useState(null); // resolved Firestore user doc, or undefined if not found
  const [resolving,setResolving]= useState(true);

  // ── Resolve the username to a real user profile ──
  // Usernames may be stored with or without a leading "@" depending on how
  // they were entered (see EditProfileSheet), so both forms are tried.
  useEffect(() => {
    let cancelled = false;
    setResolving(true);
    setProfile(null);
    const raw = (username || "").trim();
    const withoutAt = raw.startsWith("@") ? raw.slice(1) : raw;
    const withAt    = raw.startsWith("@") ? raw : `@${raw}`;

    (async () => {
      try {
        let found = await getUserByUsername(raw);
        if (!found) found = await getUserByUsername(withoutAt);
        if (!found) found = await getUserByUsername(withAt);
        if (!cancelled) setProfile(found || false);
      } catch (e) {
        console.warn("PM Space profile lookup failed:", e?.message || e);
        if (!cancelled) setProfile(false);
      } finally {
        if (!cancelled) setResolving(false);
      }
    })();

    return () => { cancelled = true; };
  }, [username]);

  const uid = profile ? profile.uid : null;

  // ── Live karma / followers / following (existing hook, same as own Profile screen) ──
  const { karmaScore, followers, following } = useLiveProfileStats(uid);

  // ── Live listings + videos counts from this seller's real posts ──
  const [listingsCount, setListingsCount] = useState(0);
  const [videosCount,   setVideosCount]   = useState(0);
  useEffect(() => {
    if (!uid) { setListingsCount(0); setVideosCount(0); return; }
    const q = fsQuery(collection(db, "posts"), where("userId", "==", uid));
    const unsub = onSnapshot(q,
      (snap) => {
        const docs = snap.docs.map((d) => d.data());
        setListingsCount(docs.length);
        setVideosCount(docs.filter((p) => p.mediaType === "video").length);
      },
      (err) => console.warn("PM Space listings count failed:", err.message)
    );
    return unsub;
  }, [uid]);

  if (resolving) {
    return (
      <div className="kt-scroll">
        <div className="screen-header">
          <button className="back-btn-inline" onClick={onBack}><ChevronLeft size={20} /></button>
          <h2>Trader Profile</h2>
        </div>
        <div className="empty-state">Loading profile…</div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="kt-scroll">
        <div className="screen-header">
          <button className="back-btn-inline" onClick={onBack}><ChevronLeft size={20} /></button>
          <h2>Trader Profile</h2>
        </div>
        <div className="empty-state">This trader profile could not be found.</div>
      </div>
    );
  }

  const displayId    = uid ? `PM-${uid.slice(0, 6).toUpperCase()}` : "PM-000";
  const displayName  = profile.fullName || profile.username || "Trader";
  const displayUser  = profile.username?.startsWith("@") ? profile.username : `@${profile.username || "trader"}`;
  const displayAvatar= profile.avatarEmoji || "🧑";

  return (
    <div className="kt-scroll">
      {/* ── Cover banner — no coverUrl field exists in the Firestore schema yet,
          so a design-consistent gradient placeholder is used here. ── */}
      <div className="pms-cover">
        <button className="back-btn" onClick={onBack}><ChevronLeft size={20} /></button>
      </div>

      <div className="pms-avatar-wrap">
        <div className="pms-avatar">{displayAvatar}</div>
        <div className="pms-name-row">
          {displayName} {profile.isVerified && <CheckCircle2 size={15} color="#22c55e" />}
        </div>
        <div className="pms-username">{displayUser} · <b>{displayId}</b></div>
        {profile.city && (
          <div className="pms-city-pill"><MapPin size={12} /> {profile.city}</div>
        )}
      </div>

      <div className="pms-stat-grid">
        <div className="pms-stat"><div className="pms-stat-num">{followers}</div><div className="pms-stat-lbl">Followers</div></div>
        <div className="pms-stat"><div className="pms-stat-num">{following}</div><div className="pms-stat-lbl">Following</div></div>
        <div className="pms-stat"><div className="pms-stat-num">{karmaScore}</div><div className="pms-stat-lbl">Karma</div></div>
      </div>
      <div className="pms-stat-grid">
        <div className="pms-stat"><div className="pms-stat-num">{listingsCount}</div><div className="pms-stat-lbl">Listings</div></div>
        <div className="pms-stat"><div className="pms-stat-num">{videosCount}</div><div className="pms-stat-lbl">Videos</div></div>
        <div className="pms-stat"><div className="pms-stat-num">{profile.sellerSuccessfulListings || 0}</div><div className="pms-stat-lbl">Trades</div></div>
      </div>

      <div className="pms-action-row">
        <button className={`kt-btn ${isFollowing ? "ghost" : ""}`} onClick={onToggleFollow}>
          {isFollowing ? <><UserCheck size={16} /> Following</> : <><UserPlus size={16} /> Follow</>}
        </button>
        <button
          className="kt-btn ghost"
          onClick={() => onOpenChat && onOpenChat({ id: displayId, otherUid: uid, user: displayUser, avatar: displayAvatar, avatarUrl: profile?.avatarUrl || null })}
        >
          <MessageCircle size={16} /> Message
        </button>
      </div>
    </div>
  );
}


export function FindUserScreen({ onBack, onOpenChat, onOpenPmSpace }) {
  return (
    <div className="kt-scroll">
      <div className="screen-header">
        <button className="back-btn-inline" onClick={onBack}><ChevronLeft size={20} /></button>
        <h2>Find a Trader</h2>
      </div>
      <FindUserModal onClose={onBack} onOpenChat={onOpenChat} onOpenPmSpace={onOpenPmSpace} />
    </div>
  );
}

