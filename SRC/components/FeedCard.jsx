// ── Extracted from App.jsx: FeedCard ──
import React, { useState, useEffect, useRef } from "react";
import {
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  Star,
  CheckCircle2,
  Sparkles,
  Handshake,
  MapPin,
  Video
} from "lucide-react";
import {
  doc,
  setDoc,
  serverTimestamp,
  getDoc,
  deleteDoc,
} from "firebase/firestore";
import { db } from "../firebase";
import { CommentsSheet } from "./CommentsSheet";
import { formatDistance } from "../utils/distance";

export function FeedCard({ item, onOpenDetail, onTrade, onOpenPmSpace, currentUser }) {
  const [liked,        setLiked]        = useState(false);
  const [saved,        setSaved]        = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [toast,        setToast]        = useState(null);
  const [playing,      setPlaying]      = useState(false);
  const [thumbError,   setThumbError]   = useState(false);
  const videoRef = useRef(null);

  // ── Load saved state from Firestore on mount ──
  useEffect(() => {
    if (!currentUser?.uid || !item?.id) return;
    getDoc(doc(db, "users", currentUser.uid, "savedPosts", item.id))
      .then((snap) => { if (snap.exists()) setSaved(true); })
      .catch(() => {});
  }, [currentUser?.uid, item?.id]);

  // ── Cloudinary URL helpers (inline — no external import needed in single file) ──
  const CLOUD = "dzhy4zx5g";
  const getThumb = (publicId, isVid) => {
    if (!publicId) return null;
    if (isVid) {
      return `https://res.cloudinary.com/${CLOUD}/video/upload/c_fill,w_400,h_280,so_0,q_auto,f_jpg/${publicId}.jpg`;
    }
    return `https://res.cloudinary.com/${CLOUD}/image/upload/c_fill,w_400,h_280,q_auto,f_webp/${publicId}`;
  };

  const isVideo     = item.mediaType === "video";
  const hasMedia    = !!(item.mediaUrl || item.thumbnailUrl || item.publicId);
  const thumbSrc    = item.thumbnailUrl
                   || (item.publicId ? getThumb(item.publicId, isVideo) : null);
  const videoSrc    = item.mediaUrl || null;

  const share = () => {
    setToast("Link copied!");
    setTimeout(() => setToast(null), 1500);
  };

  const handleVideoClick = (e) => {
    e.stopPropagation();
    if (!videoSrc) { onOpenDetail(item); return; }
    if (playing && videoRef.current) {
      videoRef.current.pause();
      setPlaying(false);
    } else {
      setPlaying(true);
    }
  };

  return (
    <div className="feed-card">
      {/* ── VIDEO / MEDIA SECTION ── */}
      <div
        className="feed-video"
        style={{
          background: hasMedia
            ? "#000"
            : `linear-gradient(160deg, ${item.color1 || "#bdeede"}, ${item.color2 || "#8fd9bd"})`,
        }}
      >
        {/* Real Cloudinary video player */}
        {playing && videoSrc ? (
          <video
            ref={videoRef}
            src={videoSrc}
            autoPlay
            playsInline
            controls={false}
            loop
            style={{ width: "100%", height: "100%", objectFit: "cover", position: "absolute", inset: 0 }}
            onEnded={() => setPlaying(false)}
          />
        ) : (
          <>
            {/* Cloudinary thumbnail or fallback gradient */}
            {thumbSrc && !thumbError ? (
              <img
                src={thumbSrc}
                alt={item.title}
                loading="lazy"
                onError={() => setThumbError(true)}
                style={{ width: "100%", height: "100%", objectFit: "cover", position: "absolute", inset: 0 }}
              />
            ) : (
              <>
                <div className="video-pattern" />
                <span className="feed-emoji">🎥</span>
              </>
            )}

            {/* Play button overlay for videos */}
            {isVideo && videoSrc && (
              <div className="play-overlay" onClick={handleVideoClick}>
                <div className="play-circle">▶</div>
              </div>
            )}

            {/* Duration badge — now grouped into the top badge row below */}
          </>
        )}

        {/* ── Cleaner grouped badge row (category + duration + demo) ── */}
        <div className="feed-top-badges">
          <span className="category-badge">{item.category || "Video"}</span>
          {(!playing || !videoSrc) && (item.videoDuration ? (
            <span className="duration-badge">
              ▸ {Math.floor(item.videoDuration / 60)}:{String(Math.round(item.videoDuration % 60)).padStart(2, "0")}
            </span>
          ) : (
            <span className="duration-badge">▸ Video</span>
          ))}
          {item.isDemo && <span className="demo-badge" title="Demo listing — browse only">EXPLORE DEMO</span>}
        </div>

        {/* RIGHT SIDEBAR ACTIONS */}
        <div className="feed-actions">
          <div className="act-wrap">
            <button className="act-btn" onClick={(e) => { e.stopPropagation(); setLiked(!liked); }}>
              <Heart size={18} fill={liked ? "#ef4444" : "none"} color={liked ? "#ef4444" : "#0f1c17"} />
            </button>
            <span className="act-count">{item.likes + (liked ? 1 : 0)}</span>
          </div>
          <div className="act-wrap">
            <button className="act-btn" onClick={(e) => { e.stopPropagation(); if (item.isDemo) { setToast("Demo listing — browse only"); setTimeout(() => setToast(null), 1500); return; } setShowComments(true); }} title={item.isDemo ? "Demo listing — comments disabled" : "Comments"}>
              <MessageCircle size={18} />
            </button>
            <span className="act-count">{item.comments}</span>
          </div>
          <div className="act-wrap">
            <button className="act-btn" onClick={(e) => { e.stopPropagation(); share(); }}>
              <Share2 size={18} />
            </button>
          </div>
          <div className="act-wrap">
            <button className="act-btn" onClick={async (e) => { e.stopPropagation(); if (!currentUser?.uid) { setSaved(!saved); return; } const ref = doc(db, "users", currentUser.uid, "savedPosts", item.id); if (saved) { setSaved(false); await deleteDoc(ref); } else { setSaved(true); await setDoc(ref, { ...item, savedAt: serverTimestamp() }); } }}>
              <Bookmark size={18} fill={saved ? "#22c55e" : "none"} color={saved ? "#22c55e" : "#0f1c17"} />
            </button>
          </div>
          <div className="trade-fab-wrap">
            <button
              className={`trade-fab ${item.isDemo ? "disabled" : ""}`}
              onClick={(e) => { e.stopPropagation(); if (item.isDemo) { setToast("Demo listing — trade disabled"); setTimeout(() => setToast(null), 1500); return; } onTrade(item); }}
              title={item.isDemo ? "Demo listing — trade disabled" : "Trade"}
            >
              <Handshake size={19} color="#fff" />
            </button>
            <span className="trade-fab-label">{item.isDemo ? "Demo" : "Trade"}</span>
          </div>
        </div>

        {/* Click overlay — tapping non-play area opens detail */}
        {!playing && (
          <div
            className="video-click-area"
            style={{ zIndex: isVideo ? 1 : 2 }}
            onClick={() => onOpenDetail(item)}
          />
        )}

        {toast && <div className="toast">{toast}</div>}
      </div>

      {/* ── INFO BODY ── */}
      <div className="feed-body">
        <div
          className="feed-user-row"
          style={{ cursor: "pointer" }}
          onClick={() => onOpenPmSpace && onOpenPmSpace(item.user)}
        >
          <div className="avatar-sm">{item.avatarUrl ? <img src={item.avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "999px" }} /> : item.avatar}</div>
          <span className="feed-username">{item.user}</span>
          {item.verified && <CheckCircle2 size={13} color="#22c55e" title="Verified Pro Seller" />}
          <span className="karma-pill"><Star size={11} fill="#16a34a" /> {item.karmaScore}</span>
        </div>
        <h3 className="feed-title">{item.title}</h3>
        <p className="feed-desc">{item.desc}</p>

        {item.distanceKm !== undefined && (
          <div className="loc-badge-row">
            <span className="loc-badge"><MapPin size={11} /> {item.city}</span>
            <span className="loc-badge dist">{item.distanceKm <= 2 ? "🔥" : "📏"} {formatDistance(item.distanceKm)} Away</span>
            <span className="loc-badge karma">⭐ Karma Score: {Math.round(item.karmaScore * 19.2)}</span>
          </div>
        )}

        <div className="ai-row"><Sparkles size={13} /> AI Value: {item.aiValue?.toLocaleString() || item.recommendedPm?.toLocaleString() || "—"} PM</div>
      </div>

      {showComments && <CommentsSheet item={item} onClose={() => setShowComments(false)} />}
    </div>
  );
}

