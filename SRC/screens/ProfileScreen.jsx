// ── Extracted from App.jsx: ProfileScreen ──
import React, { useState, useEffect } from "react";
import {
  Bookmark,
  Home,
  Inbox,
  User,
  Wallet,
  Package,
  Settings as SettingsIcon,
  MapPin,
  Map as MapIcon,
  Film
} from "lucide-react";
import {
  collection,
  query as fsQuery,
  where,
  orderBy,
  limit,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../firebase";
import { EditProfileSheet } from "../Profile/EditProfileSheet";
import { MenuRow } from "../components/MenuRow";
import { useLivePmPoints } from "../hooks/useLivePmPoints";
import { useLiveProfileStats } from "../hooks/useLiveProfileStats";
import { DetailScreen } from "./DetailScreen";
import { DEFAULT_LOCATION } from "../utils/location";

export function ProfileScreen({ onNavigate, userLocation, currentUser, onOpenDetail, onProfileUpdate }) {
  const displayName   = currentUser?.username   || currentUser?.fullName  || "@you.trades";
  const displayBio    = currentUser?.bio         || "Trading my way across town, one fair deal at a time 🤝";
  const displayAvatar = currentUser?.avatarEmoji || "🧑‍🚀";
  const displayId     = currentUser?.uid ? `PM-${currentUser.uid.slice(0, 6).toUpperCase()}` : "PM-000";
  // PHASE 2 STEP 2 — Edit Profile sheet toggle
  const [showEdit, setShowEdit] = useState(false);
  // ── Live profile stats — karma, trades, followers, following — always
  // from Firestore, defaulting to 0 for brand-new users. Never hardcoded. ──
  const { karmaScore: karma, totalTrades: trades, followers, following } = useLiveProfileStats(currentUser?.uid);

  // ── Live PM Points balance — always read from Firestore, never hardcoded ──
  const { points: pmPoints } = useLivePmPoints(currentUser?.uid);
  const walletSub = pmPoints === null ? "Loading…" : `${pmPoints.toLocaleString()} PM`;

  // ── PHASE 1: live grid of this user's own posts (images + videos), read-only.
  // Same normalised shape used by the Home feed so clicking a tile opens the
  // existing DetailScreen cleanly — no new viewer, no schema change. ──
  const [myPosts, setMyPosts] = useState([]);
  const [myPostsError, setMyPostsError] = useState(null);
  useEffect(() => {
    if (!currentUser?.uid) { setMyPosts([]); return; }
    setMyPostsError(null);
    const q = fsQuery(
      collection(db, "posts"),
      where("userId", "==", currentUser.uid),
      orderBy("createdAt", "desc"),
      limit(60)
    );
    const unsub = onSnapshot(q,
      (snap) => {
        const posts = snap.docs.map((docSnap) => ({
          id:          docSnap.id,
          ...docSnap.data(),
          desc:        docSnap.data().description || docSnap.data().desc || "",
          aiValue:     docSnap.data().recommendedPm || docSnap.data().aiValue || 0,
          karmaScore:  docSnap.data().aiKarmaScore  || docSnap.data().karmaScore || 0,
          avatar:      docSnap.data().avatar        || "🧑",
          user:        docSnap.data().username      || docSnap.data().userId || "unknown",
          comments:    docSnap.data().comments      || 0,
          city:        docSnap.data().city || DEFAULT_LOCATION.city,
          lat:         docSnap.data().lat  || DEFAULT_LOCATION.lat,
          lng:         docSnap.data().lng  || DEFAULT_LOCATION.lng,
          color1:      docSnap.data().color1 || "#bdeede",
          color2:      docSnap.data().color2 || "#8fd9bd",
        }));
        setMyPosts(posts);
        setMyPostsError(null);
      },
      (err) => {
        console.warn("Profile grid listener error:", err.message);
        setMyPostsError(err.code === "failed-precondition"
          ? "Your posts couldn't be loaded (missing database index). Please try again shortly."
          : "Your posts couldn't be loaded. Please check your connection and try again.");
      }
    );
    return unsub;
  }, [currentUser?.uid]);

  return (
    <div className="kt-scroll">
      <div className="profile-head">
        <div className="profile-avatar">
          {currentUser?.avatarUrl
            ? <img src={currentUser.avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "999px" }} />
            : displayAvatar}
        </div>
        <div className="profile-name">{displayName}</div>
        <div className="profile-bio">{displayBio}</div>
        <div className="stat-row">
          <div className="stat-item"><div className="stat-num">{myPosts.length}</div><div className="stat-lbl">Posts</div></div>
          <div className="stat-item"><div className="stat-num">{karma}</div><div className="stat-lbl">Karma</div></div>
          <div className="stat-item"><div className="stat-num">{trades}</div><div className="stat-lbl">Trades</div></div>
          <div className="stat-item"><div className="stat-num">{followers}</div><div className="stat-lbl">Followers</div></div>
          <div className="stat-item"><div className="stat-num">{following}</div><div className="stat-lbl">Following</div></div>
        </div>
        <div className="karma-id-box">Your PM ID: <b>{displayId}</b></div>
        {userLocation && (
          <div className="karma-id-box" style={{ marginTop: 8, background: "#eafbe7" }}>
            <MapPin size={12} style={{ display: "inline", verticalAlign: -2, marginRight: 4 }} /> {userLocation.city}
          </div>
        )}
        <button className="kt-btn" style={{ marginTop: 16 }} onClick={() => setShowEdit(true)}><User size={15} /> Edit Profile</button>
      </div>

      {/* ── PHASE 1: Instagram-style 3-column grid of this user's own posts ── */}
      <div className="profile-grid">
        {myPostsError ? (
          <div className="empty-state" style={{ gridColumn: "1 / -1" }}>{myPostsError}</div>
        ) : myPosts.length === 0 ? (
          <div className="empty-state" style={{ gridColumn: "1 / -1" }}>You haven't posted anything yet.</div>
        ) : myPosts.map((post) => (
          <div key={post.id} className="profile-grid-tile" onClick={() => onOpenDetail && onOpenDetail(post)}>
            <img src={post.mediaType === "video" ? (post.thumbnailUrl || post.mediaUrl) : (post.mediaUrl || post.thumbnailUrl)} alt="" />
            {post.mediaType === "video" && <Film size={14} className="profile-grid-video-icon" />}
          </div>
        ))}
      </div>

      <MenuRow icon={Package}     label="My Listings"  onClick={() => onNavigate("listings")} />
      <MenuRow icon={Bookmark}    label="Saved Items"  onClick={() => onNavigate("saved")} />
      <MenuRow icon={MapIcon}     label="Nearby Map"   onClick={() => onNavigate("map")} />
      <MenuRow icon={Wallet}      label="Wallet"       sub={walletSub} onClick={() => onNavigate("wallet")} />
      <MenuRow icon={Inbox}       label="Orders"       onClick={() => onNavigate("orders")} />
      <MenuRow icon={SettingsIcon}label="Settings"     onClick={() => onNavigate("settings")} />

      {showEdit && <EditProfileSheet onClose={() => setShowEdit(false)} currentUser={currentUser} onProfileUpdate={onProfileUpdate} />}
    </div>
  );
}

