// ── Extracted from App.jsx: DetailScreen ──
import React, { useState, useEffect, useRef } from "react";
import {
  Bookmark,
  Star,
  ChevronLeft,
  CheckCircle2,
  Sparkles,
  ChevronRight,
  TrendingUp,
  Award,
  Users,
  Handshake,
  MapPin,
  Video,
  ShieldCheck,
  AlertTriangle
} from "lucide-react";
import {
  doc,
  setDoc,
  serverTimestamp,
  getDoc,
  deleteDoc,
} from "firebase/firestore";
import { db } from "../firebase";
import { haversineDistanceKm, formatDistance } from "../utils/distance";
import { submitReview } from "../utils/platformStore";
import { verifyProductListing } from "../PointsEngine";

export function DetailScreen({ item, userLocation, onBack, onTrade, onAiHub, onBattle, onOpenPmSpace, currentUser }) {
  const [saved,           setSaved]           = useState(false);
  const [ratingGiven,     setRatingGiven]     = useState(0);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const [playing,         setPlaying]         = useState(false);
  const [thumbError,      setThumbError]      = useState(false);
  const videoRef = useRef(null);

  // ── Community verification — Products only. item.karmaStatus is only ever
  // set (to "pending" or "awarded") for Products created after this feature
  // shipped; older listings and all Skills/Services simply won't have it,
  // so no verification UI renders for them at all. ──
  const [verifiedBy,  setVerifiedBy]  = useState(item.verifiedBy || []);
  const [karmaStatus, setKarmaStatus] = useState(item.karmaStatus || null);
  const [verifying,   setVerifying]   = useState(false);
  const [verifyErr,   setVerifyErr]   = useState(null);
  const isVerifiableProduct = karmaStatus === "pending" || karmaStatus === "awarded";
  const isSeller = !!(currentUser?.uid && item.userId && currentUser.uid === item.userId);
  const alreadyVerified = !!(currentUser?.uid && verifiedBy.includes(currentUser.uid));

  const handleVerify = async () => {
    if (!currentUser?.uid || isSeller || alreadyVerified || karmaStatus !== "pending" || verifying) return;
    setVerifying(true);
    setVerifyErr(null);
    try {
      const result = await verifyProductListing(item.id, currentUser.uid, item.userId, item.aiValue);
      if (result.success) {
        setVerifiedBy((prev) => [...prev, currentUser.uid]);
        if (result.awarded) setKarmaStatus("awarded");
      } else if (result.reason === "already_verified") {
        setVerifyErr("You've already verified this product.");
      } else if (result.reason === "already_awarded") {
        setKarmaStatus("awarded");
      } else if (result.reason === "seller_cannot_verify_own_listing") {
        setVerifyErr("You can't verify your own listing.");
      } else {
        setVerifyErr("Could not submit your verification. Please try again.");
      }
    } catch (err) {
      setVerifyErr(err.message || "Could not submit your verification.");
    } finally {
      setVerifying(false);
    }
  };

  // ── Load saved state from Firestore on mount ──
  useEffect(() => {
    if (!currentUser?.uid || !item?.id) return;
    getDoc(doc(db, "users", currentUser.uid, "savedPosts", item.id))
      .then((snap) => { if (snap.exists()) setSaved(true); })
      .catch(() => {});
  }, [currentUser?.uid, item?.id]);

  const distanceKm = userLocation && item.lat
    ? haversineDistanceKm(userLocation.lat, userLocation.lng, item.lat, item.lng)
    : null;

  // ── Cloudinary media resolution ──
  const CLOUD      = "dzhy4zx5g";
  const isVideo    = item.mediaType === "video";
  const hasMedia   = !!(item.mediaUrl || item.thumbnailUrl || item.publicId);
  const thumbSrc   = item.thumbnailUrl
    || (item.publicId && isVideo
      ? `https://res.cloudinary.com/${CLOUD}/video/upload/c_fill,w_800,h_450,so_0,q_auto,f_jpg/${item.publicId}.jpg`
      : item.publicId
        ? `https://res.cloudinary.com/${CLOUD}/image/upload/c_fill,w_800,h_450,q_auto,f_webp/${item.publicId}`
        : null);

  const handleVideoClick = () => {
    if (!item.mediaUrl) return;
    if (playing && videoRef.current) { videoRef.current.pause(); setPlaying(false); }
    else setPlaying(true);
  };

  const submitRating = (stars) => {
    setRatingGiven(stars);
    // Prevent writing reviews for demo listings (UI-only safety wrapper)
    if (item.isDemo) {
      setRatingSubmitted(true);
      return;
    }
    submitReview({ reviewer: "@you.trades", avatar: "🧑‍🚀", rating: stars, text: "", target: item.user });
    setRatingSubmitted(true);
  };

  return (
    <div className="kt-scroll">
      {/* ── MEDIA SECTION ── */}
      <div
        className="detail-video"
        style={{
          background: hasMedia
            ? "#000"
            : `linear-gradient(160deg, ${item.color1 || "#bdeede"}, ${item.color2 || "#8fd9bd"})`,
        }}
      >
        <button className="back-btn" onClick={onBack}><ChevronLeft size={20} /></button>

        {/* Real Cloudinary video playback */}
        {playing && item.mediaUrl ? (
          <video
            ref={videoRef}
            src={item.mediaUrl}
            autoPlay
            playsInline
            controls
            style={{ width: "100%", height: "100%", objectFit: "contain", position: "absolute", inset: 0, zIndex: 2 }}
            onEnded={() => setPlaying(false)}
          />
        ) : (
          <>
            {/* Cloudinary thumbnail */}
            {thumbSrc && !thumbError ? (
              <img
                src={thumbSrc}
                alt={item.title}
                onError={() => setThumbError(true)}
                style={{ width: "100%", height: "100%", objectFit: "cover", position: "absolute", inset: 0 }}
              />
            ) : (
              <>
                <div className="video-pattern" />
                <span style={{ fontSize: 70, position: "relative", zIndex: 1 }}>🎥</span>
              </>
            )}

            {/* Play overlay for videos */}
            {isVideo && item.mediaUrl && (
              <div
                onClick={handleVideoClick}
                style={{
                  position: "absolute", inset: 0, zIndex: 3,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer",
                }}
              >
                <div className="play-circle" style={{ width: 56, height: 56, fontSize: 22 }}>▶</div>
              </div>
            )}

            {/* Duration badge */}
            {item.videoDuration ? (
              <span className="duration-badge">
                ▸ {Math.floor(item.videoDuration / 60)}:{String(Math.round(item.videoDuration % 60)).padStart(2, "0")}
              </span>
            ) : isVideo ? (
              <span className="duration-badge">▸ Video</span>
            ) : null}
          </>
        )}
      </div>
      <div className="seller-row" style={{ cursor: onOpenPmSpace ? "pointer" : "default" }} onClick={() => onOpenPmSpace && onOpenPmSpace(item.user)}>
        <div className="avatar-lg">{item.avatarUrl ? <img src={item.avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "999px" }} /> : item.avatar}</div>
        <div>
          <div className="feed-username" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {item.user} {item.verified && <CheckCircle2 size={14} color="#22c55e" />}
          </div>
          <div className="seller-stats">
            <span className="seller-stat"><Star size={12} fill="#16a34a" color="#16a34a" /> {item.karmaScore}</span>
            <span className="seller-stat"><Award size={12} /> 36 trades</span>
            <span className="seller-stat"><Users size={12} /> 1.2k followers</span>
          </div>
        </div>
        {onOpenPmSpace && <ChevronRight size={16} color="#6f8b80" style={{ marginLeft: "auto" }} />}
      </div>
      <div style={{ padding: "14px 16px 0" }}>
        <h2 className="feed-title" style={{ fontSize: 18 }}>{item.title}</h2>
        <p className="feed-desc">{item.desc}</p>
        {distanceKm !== null && (
          <div className="loc-badge-row" style={{ marginBottom: 4 }}>
            <span className="loc-badge"><MapPin size={11} /> {item.city || userLocation.city}</span>
            <span className="loc-badge dist">{distanceKm <= 2 ? "🔥" : "📏"} {formatDistance(distanceKm)} Away</span>
            {item.verified && <span className="loc-badge verified"><CheckCircle2 size={11} /> Verified Pro Seller</span>}
          </div>
        )}
      </div>
      <div className="info-grid">
        <div className="info-box"><div className="info-label">Condition</div><div className="info-value">Like New</div></div>
        <div className="info-box"><div className="info-label">Location</div><div className="info-value">{item.city || "—"}</div></div>
        <div className="info-box"><div className="info-label">Needs in Return</div><div className="info-value">{item.needsItem || "Open to offers"}</div></div>
        <div className="info-box"><div className="info-label">AI Value</div><div className="info-value">{item.aiValue.toLocaleString()} PM</div></div>
        {isVerifiableProduct && (
          <div className="info-box">
            <div className="info-label">Community Verification</div>
            <div className="info-value">{karmaStatus === "awarded" ? "Verified ✓" : `${verifiedBy.length} / 5`}</div>
          </div>
        )}
      </div>
      <div className="detail-actions">
        <button className="kt-btn" onClick={() => { if (item.isDemo) return; onTrade(); }} style={item.isDemo ? { opacity: 0.45, cursor: "not-allowed" } : {}} title={item.isDemo ? "Demo listing — trade disabled" : "Trade"}><Handshake size={16} /> {item.isDemo ? "Demo" : "Trade"}</button>
        <button className="kt-btn ghost" onClick={() => { if (item.isDemo) return; onBattle(); }} style={item.isDemo ? { opacity: 0.45, cursor: "not-allowed" } : {}} title={item.isDemo ? "Demo listing — battle disabled" : "Battle"}><TrendingUp size={16} /> {item.isDemo ? "Demo" : "Battle"}</button>
      </div>
      <div className="detail-actions" style={{ paddingTop: 0 }}>
        <button className="kt-btn ghost" onClick={async () => { if (!currentUser?.uid) { setSaved(!saved); return; } const ref = doc(db, "users", currentUser.uid, "savedPosts", item.id); if (saved) { setSaved(false); await deleteDoc(ref); } else { setSaved(true); await setDoc(ref, { ...item, savedAt: serverTimestamp() }); } }}><Bookmark size={16} fill={saved ? "#22c55e" : "none"} /> {saved ? "Saved" : "Save"}</button>
        <button className="kt-btn ghost" onClick={onAiHub}><Sparkles size={16} /> AI Hub</button>
      </div>

      {isVerifiableProduct && (
        <div style={{ padding: "0 16px 12px" }}>
          {karmaStatus === "awarded" ? (
            <div className="success-box"><ShieldCheck size={16} /> Community Verified ✓ — Karma Points Awarded: {item.aiValue.toLocaleString()} KP</div>
          ) : isSeller ? (
            <div className="info-box">
              <div className="info-label">Your listing</div>
              <div className="info-value">Community Verification: {verifiedBy.length} / 5</div>
            </div>
          ) : alreadyVerified ? (
            <div className="success-box"><CheckCircle2 size={16} /> You've verified this product. Community Verification: {verifiedBy.length} / 5</div>
          ) : (
            <>
              <button className="kt-btn" style={{ width: "100%" }} onClick={handleVerify} disabled={verifying}>
                <ShieldCheck size={16} /> {verifying ? "Submitting…" : `Verify Product (${verifiedBy.length}/5)`}
              </button>
              {verifyErr && <div className="upload-error" style={{ marginTop: 8 }}><AlertTriangle size={13} /> {verifyErr}</div>}
            </>
          )}
        </div>
      )}

      <div className="rate-trader-box">
        {!ratingSubmitted ? (
          <>
            <div className="rate-trader-title">Rate your experience with {item.user}</div>
            <div className="rate-trader-stars">
              {[1, 2, 3, 4, 5].map((n) => (
                <Star
                  key={n}
                  size={26}
                  fill={n <= ratingGiven ? "#f59e0b" : "none"}
                  color={n <= ratingGiven ? "#f59e0b" : "#cbd5e1"}
                  style={{ cursor: "pointer" }}
                  onClick={() => submitRating(n)}
                />
              ))}
            </div>
          </>
        ) : (
          <div className="success-box"><CheckCircle2 size={16} /> Thanks for your {ratingGiven}-star rating!</div>
        )}
      </div>
    </div>
  );
}

