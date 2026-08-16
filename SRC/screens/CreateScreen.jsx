// ── Extracted from App.jsx: AiAnalyzingScreen, AiResultsScreen, BADGE_ICONS, BoostUpload, CreateScreen, UploadProgressBar ──
import React, { useState, useEffect, useRef } from "react";
import {
  Home,
  PlusCircle,
  CheckCircle2,
  Sparkles,
  Wallet,
  RotateCcw,
  ChevronRight,
  Award,
  Users,
  AlertTriangle,
  Image as ImageIcon,
  MapPin,
  ScanEye,
  ShieldAlert,
  ShieldCheck,
  BadgeCheck,
  Video,
  Film,
} from "lucide-react";
import {
  doc,
  setDoc,
  addDoc,
  collection,
  serverTimestamp,
  getDoc,
  updateDoc,
  increment,
} from "firebase/firestore";
import { db } from "../firebase";
import { cldUpload, cldThumbUrl } from "../services/cloudinaryService";
import { FeedCard } from "../components/FeedCard";
import { ScoreTile } from "../components/ScoreTile";
import { DetailScreen } from "./DetailScreen";
import { runAiAuthenticityEngine, karmaBandLabel } from "../utils/aiEngine";
import { haversineDistanceKm, formatDistance } from "../utils/distance";
import { DEFAULT_LOCATION } from "../utils/location";
import { FEED } from "../utils/mockData";
import { PmAiFlowScreen } from "./PmAiFlowScreen";

export function UploadProgressBar({ progress, onCancel }) {
  return (
    <div className="cld-progress-wrap">
      <div className="cld-progress-top">
        <span className="cld-progress-label">
          {progress < 100 ? `Uploading… ${progress}%` : "Processing…"}
        </span>
        {onCancel && progress < 100 && (
          <button className="cld-cancel-btn" onClick={onCancel}>Cancel</button>
        )}
      </div>
      <div className="cld-progress-bg">
        <div className="cld-progress-fill" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}

export function BoostUpload({ onUploaded }) {
  const [mediaUrl,   setMediaUrl]   = useState(null);
  const [mediaFile,  setMediaFile]  = useState(null);
  const [isVideo,    setIsVideo]    = useState(true);
  const [title,      setTitle]      = useState("");
  const [uploading,  setUploading]  = useState(false);
  const [progress,   setProgress]   = useState(0);
  const [uploadErr,  setUploadErr]  = useState(null);
  const fileRef     = useRef(null);
  const abortRef    = useRef(null);

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setMediaFile(file);
    setMediaUrl(URL.createObjectURL(file));
    setIsVideo(file.type.startsWith("video/"));
    setUploadErr(null);
  };

  const handleContinue = async () => {
    if (!title.trim() || !mediaFile) return;
    setUploading(true);
    setProgress(0);
    setUploadErr(null);
    abortRef.current = new AbortController();

    try {
      const result = await cldUpload(
        mediaFile, "boosts", "user",
        setProgress, abortRef.current.signal
      );
      const isVid = mediaFile.type.startsWith("video/");
      onUploaded({
        title,
        mediaUrl:     result.secure_url,
        thumbnailUrl: cldThumbUrl(result.public_id, isVid),
        publicId:     result.public_id,
        mediaType:    isVid ? "video" : "image",
      });
    } catch (err) {
      if (err.name !== "AbortError") setUploadErr(err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <div className="field-label" style={{ marginTop: 4 }}>Upload the video or photo you want to boost</div>
      <input ref={fileRef} type="file" accept="video/*,image/*" style={{ display: "none" }} onChange={handleFile} />

      {!mediaUrl ? (
        <div className="upload-box" style={{ margin: "0 0 14px", cursor: "pointer" }} onClick={() => fileRef.current?.click()}>
          <ImageIcon size={26} style={{ color: "#22c55e" }} />
          <div style={{ fontWeight: 700, marginTop: 6, color: "var(--ink)" }}>Choose from gallery</div>
          <div style={{ fontSize: 12, marginTop: 4, color: "#6f8b80" }}>Select a video or photo to boost to the top of the Home feed</div>
        </div>
      ) : (
        <div className="upload-box" style={{ margin: "0 0 14px", padding: 12 }}>
          {isVideo
            ? <video src={mediaUrl} controls style={{ width: "100%", borderRadius: 12, maxHeight: 180, background: "#000" }} />
            : <img src={mediaUrl} alt="preview" style={{ width: "100%", borderRadius: 12, maxHeight: 180, objectFit: "cover" }} />
          }
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
            <span style={{ fontSize: 12, color: "var(--ink)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "70%" }}>{mediaFile?.name}</span>
            {!uploading && (
              <button className="kt-btn ghost" style={{ width: "auto", padding: "7px 12px", fontSize: 12 }} onClick={() => { setMediaUrl(null); setMediaFile(null); }}>Replace</button>
            )}
          </div>
        </div>
      )}

      {uploadErr && <div className="upload-error"><AlertTriangle size={13} /> {uploadErr}</div>}
      {uploading && <UploadProgressBar progress={progress} onCancel={() => abortRef.current?.abort()} />}

      <div className="field-label">Post title</div>
      <input className="field-input" style={{ marginBottom: 14 }} placeholder="e.g. Razer Gaming Mouse" value={title} onChange={(e) => setTitle(e.target.value)} />

      <button
        className="kt-btn"
        disabled={!title.trim() || !mediaFile || uploading}
        style={!title.trim() || !mediaFile || uploading ? { opacity: 0.4 } : {}}
        onClick={handleContinue}
      >
        {uploading ? "Uploading to Cloudinary…" : <>Continue <ChevronRight size={16} /></>}
      </button>
    </>
  );
}

export function CreateScreen({ currentUser, userLocation }) {
  /* ── Form fields ── */
  const [mediaUrl,   setMediaUrl]   = useState(null);   // local blob preview
  const [mediaFile,  setMediaFile]  = useState(null);
  const [isVideo,    setIsVideo]    = useState(true);
  const [title,      setTitle]      = useState("");
  const [desc,       setDesc]       = useState("");
  const [category,   setCategory]   = useState("");
  const [tradeType,  setTradeType]  = useState("exchange");
  const [needsItem,  setNeedsItem]  = useState("");

  /* ── Stage machine ── */
  // form -> uploading -> pm_ai -> analyzing -> results -> saving -> posted -> error
  const [stage,      setStage]      = useState("form");

  /* ── Cloudinary upload & Answers ── */
  const [progress,   setProgress]   = useState(0);
  const [uploadErr,  setUploadErr]  = useState(null);
  const [cldResult,  setCldResult]  = useState(null);   // raw Cloudinary response
  const [aiAnswers,  setAiAnswers]  = useState({});     // collected PM AI answers

  /* ── AI analysis ── */
  const [report,     setReport]     = useState(null);

  /* ── Save error ── */
  const [saveErr,    setSaveErr]    = useState(null);

  const fileRef  = useRef(null);
  const abortRef = useRef(null);

  /* ── File picker ── */
  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setMediaFile(file);
    setMediaUrl(URL.createObjectURL(file));
    setIsVideo(file.type.startsWith("video/"));
    setUploadErr(null);
  };

  /* ── Smart match preview ── */
  const matches = (tradeType !== "karma" && needsItem.trim().length > 1)
    ? FEED
        .filter((i) => i.title.toLowerCase().includes(needsItem.trim().toLowerCase()))
        .map((i) => ({
          ...i,
          distanceKm: haversineDistanceKm(DEFAULT_LOCATION.lat, DEFAULT_LOCATION.lng, i.lat, i.lng),
        }))
        .sort((a, b) => {
          if (a.city === DEFAULT_LOCATION.city && b.city !== DEFAULT_LOCATION.city) return -1;
          if (b.city === DEFAULT_LOCATION.city && a.city !== DEFAULT_LOCATION.city) return 1;
          return a.distanceKm !== b.distanceKm
            ? a.distanceKm - b.distanceKm
            : b.karmaScore - a.karmaScore;
        })
        .slice(0, 3)
    : [];

  /* ─────────────────────────────────────────
     STEP 1 — Upload to Cloudinary
  ───────────────────────────────────────── */
  const startUpload = async () => {
    if (!title.trim() || !mediaFile) return;
    if (tradeType !== "karma" && !needsItem.trim()) return;

    setStage("uploading");
    setProgress(0);
    setUploadErr(null);
    abortRef.current = new AbortController();

    try {
      const uid = currentUser?.uid || "anonymous";
      const result = await cldUpload(
        mediaFile, "listings", uid,
        setProgress, abortRef.current.signal
      );
      setCldResult(result);
      
      // Navigate to PM AI Flow instead of directly executing AI analysis
      setStage("pm_ai");
    } catch (err) {
      if (err.name === "AbortError") {
        setStage("form");
      } else {
        setUploadErr(err.message);
        setStage("error");
      }
    }
  };

  /* ─────────────────────────────────────────
     STEP 2 — AI authenticity analysis
  ───────────────────────────────────────── */
  const runAiAnalysis = (cloudinaryResult, answersData) => {
    setStage("analyzing");
    setTimeout(() => {
      const aiReport = runAiAuthenticityEngine({
        title,
        desc,
        category,
        mediaFile,
        isVideo,
        aiAnswers: answersData || aiAnswers,
      });
      setReport(aiReport);
      setStage("results");
    }, 2200);
  };

  /* ─────────────────────────────────────────
     STEP 3 — Save to Firestore
  ───────────────────────────────────────── */
  const saveToFirestore = async () => {
    if (!cldResult || !report) return;

    const uid = currentUser?.uid;
    if (!uid) {
      setSaveErr("You must be signed in to create a post.");
      setStage("error");
      return;
    }

    setStage("saving");
    setSaveErr(null);

    const isVid       = mediaFile?.type.startsWith("video/");
    const thumbnailUrl = cldThumbUrl(cldResult.public_id, isVid);
    const activeLocation = userLocation || DEFAULT_LOCATION;

    const postData = {
      userId:         uid,
      username:       currentUser.username       || currentUser.displayName || "",
      avatar:         currentUser.avatarEmoji    || currentUser.photoURL    || "🧑",
      avatarUrl:      currentUser.avatarUrl      || null,
      verified:       currentUser.isVerified     || false,
      isProSeller:    currentUser.isProSeller    || false,

      title:          title.trim(),
      description:    desc.trim(),
      category:       category.trim(),
      needsInReturn:  tradeType === "karma" ? "" : needsItem.trim(),
      tradeType:      tradeType,
      contentType:    isVid ? "video" : "image",
      aiAnswers:      aiAnswers,

      mediaUrl:       cldResult.secure_url,
      mediaType:      isVid ? "video" : "image",
      thumbnailUrl,
      publicId:       cldResult.public_id,
      mediaFormat:    cldResult.format    || null,
      mediaBytes:     cldResult.bytes     || null,
      videoDuration:  cldResult.duration  || null,
      videoWidth:     cldResult.width     || null,
      videoHeight:    cldResult.height    || null,

      aiKarmaScore:   report.finalScore,
      recommendedPm:  report.recommendedKp,
      karmaScore:     report.finalScore,
      aiValue:        report.recommendedKp,
      aiBadges:       report.badges.map((b) => b.label),
      aiAuthenticity: report.authenticity,
      aiCondition:    report.condition,
      aiNeedsReview:  report.needsReview,

      city:           activeLocation.city  || "",
      lat:            activeLocation.lat   || null,
      lng:            activeLocation.lng   || null,

      likes:          0,
      views:          0,
      saves:          0,
      comments:       0,
      isBoosted:      false,
      isRemoved:      false,
      status:         report.needsReview ? "pending_review" : "active",

      color1:         "#bdeede",
      color2:         "#8fd9bd",
    };

    try {
      const postsCol  = collection(db, "posts");
      const postRef   = await addDoc(postsCol, {
        ...postData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      const userPostRef = doc(db, "users", uid, "posts", postRef.id);
      await setDoc(userPostRef, {
        userId:     uid,
        postId:     postRef.id,
        title:      postData.title,
        thumbnailUrl,
        mediaUrl:   postData.mediaUrl,
        publicId:   postData.publicId,
        mediaType:  postData.mediaType,
        status:     postData.status,
        aiKarmaScore: postData.aiKarmaScore,
        createdAt:  serverTimestamp(),
      });

      try {
        const userRef = doc(db, "users", uid);
        const userSnap = await getDoc(userRef);
        const userData = userSnap.exists() ? userSnap.data() : {};

        if (userData.pointsStatus === "locked") {
          updateDoc(userRef, { pointsStatus: "unlocked" }).catch((unlockErr) => {
            console.warn("Welcome bonus unlock failed:", unlockErr?.message || unlockErr);
          });
        }

        if (!postData.aiNeedsReview && (!report.flags || report.flags.length === 0)) {
          const prevCount = userData.sellerSuccessfulListings || 0;
          const prevAvg = userData.sellerAverageAiScore || 0;
          const newCount = prevCount + 1;
          const newAvg = Math.round(((prevAvg * prevCount) + report.finalScore) / newCount);

          await updateDoc(userRef, {
            sellerSuccessfulListings: increment(1),
            sellerAverageAiScore: newAvg,
          });

          const flagged = userData.sellerFlaggedListings || 0;

          let badgeLevel = null;
          let badgeLabel = null;
          if (newAvg > 92 && newCount >= 250 && flagged === 0) {
            badgeLevel = "gold";
            badgeLabel = "Premium Trusted Seller";
          } else if (newAvg > 80 && newCount >= 60 && flagged === 0) {
            badgeLevel = "silver";
            badgeLabel = "Trusted Seller";
          }

          if (badgeLevel) {
            await updateDoc(userRef, {
              sellerBadge: badgeLevel,
              sellerBadgeLabel: badgeLabel,
              sellerBadgeAwardedAt: serverTimestamp(),
            });
          }
        } else {
          await updateDoc(userRef, { sellerFlaggedListings: increment(1) });
        }
      } catch (e) {
        console.warn("Seller badge update failed:", e?.message || e);
      }

      setStage("posted");

    } catch (err) {
      console.warn("Firestore write failed:", err?.code || err?.message || err);
      setSaveErr(`Failed to save your post. Please try again. (${err.message})`);
      setStage("error");
    }
  };

  /* ─────────────────────────────────────────
     RENDER — stage machine
  ───────────────────────────────────────── */

  if (stage === "uploading") {
    return (
      <div className="kt-scroll">
        <div className="screen-header"><h2>Create Post</h2></div>
        <div className="cld-upload-stage">
          <div className="cld-upload-icon">
            {isVideo ? <Film size={36} /> : <ImageIcon size={36} />}
          </div>
          <div className="cld-upload-title">Uploading to Cloudinary</div>
          <div className="cld-upload-sub">{mediaFile?.name}</div>
          <UploadProgressBar
            progress={progress}
            onCancel={() => abortRef.current?.abort()}
          />
          <div className="cld-upload-note">
            Your file is being securely uploaded to Cloudinary CDN.
            Thumbnail will be generated automatically.
          </div>
        </div>
      </div>
    );
  }

  /* ── PM AI Screens Flow ── */
  if (stage === "pm_ai") {
    return (
      <PmAiFlowScreen
        category={category}
        onComplete={(collectedAnswers) => {
          setAiAnswers(collectedAnswers);
          runAiAnalysis(cldResult, collectedAnswers);
        }}
        onBack={() => setStage("form")}
      />
    );
  }

  if (stage === "analyzing") return <AiAnalyzingScreen isVideo={isVideo} />;

  if (stage === "results" && report) {
    return (
      <AiResultsScreen
        report={report}
        title={title}
        onEdit={() => setStage("form")}
        onConfirm={saveToFirestore}
      />
    );
  }

  if (stage === "saving") {
    return (
      <div className="kt-scroll">
        <div className="screen-header"><h2>Create Post</h2></div>
        <div className="cld-upload-stage">
          <div className="cld-upload-icon" style={{ background: "var(--sea-light)" }}>
            <CheckCircle2 size={36} color="#22c55e" />
          </div>
          <div className="cld-upload-title">Saving your listing…</div>
          <div className="cld-upload-sub">Writing to Firestore database</div>
          <div className="cld-progress-wrap" style={{ marginTop: 24 }}>
            <div className="cld-progress-bg">
              <div className="cld-progress-fill" style={{ width: "100%", animation: "progressPulse 1s ease-in-out infinite" }} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (stage === "posted") {
    return (
      <div className="kt-scroll">
        <div className="screen-header"><h2>Create Post</h2></div>
        <div className="cld-upload-stage">
          <div className="cld-upload-icon" style={{ background: "var(--sea-light)", width: 80, height: 80 }}>
            <CheckCircle2 size={42} color="#22c55e" />
          </div>
          <div className="cld-upload-title" style={{ color: "#22c55e" }}>Listing is live!</div>
          <div className="cld-upload-sub">Your post has been uploaded to Cloudinary and saved to Firestore.</div>

          {cldResult?.public_id && (
            <div style={{ width: "100%", maxWidth: 320, margin: "20px auto 0", borderRadius: 16, overflow: "hidden" }}>
              <img
                src={cldThumbUrl(cldResult.public_id, isVideo)}
                alt={title}
                style={{ width: "100%", borderRadius: 16, display: "block" }}
              />
            </div>
          )}

          <div className="cld-media-info">
            {cldResult && (
              <>
                <div className="cld-info-row"><span>CDN URL</span><a href={cldResult.secure_url} target="_blank" rel="noopener noreferrer" style={{ color: "#22c55e", fontSize: 11, wordBreak: "break-all" }}>View on Cloudinary ↗</a></div>
                {cldResult.duration && <div className="cld-info-row"><span>Duration</span><b>{Math.round(cldResult.duration)}s</b></div>}
                <div className="cld-info-row"><span>Size</span><b>{(cldResult.bytes / 1024 / 1024).toFixed(1)} MB</b></div>
                <div className="cld-info-row"><span>Format</span><b>{cldResult.format?.toUpperCase()}</b></div>
                <div className="cld-info-row"><span>AI Score</span><b style={{ color: "#22c55e" }}>{report?.finalScore}/100</b></div>
              </>
            )}
          </div>

          <button className="kt-btn" style={{ marginTop: 20, maxWidth: 280, alignSelf: "center" }} onClick={() => {
            setStage("form"); setMediaUrl(null); setMediaFile(null);
            setTitle(""); setDesc(""); setCategory(""); setNeedsItem(""); setTradeType("exchange");
            setCldResult(null); setReport(null); setAiAnswers({});
          }}>
            <PlusCircle size={16} /> Create another post
          </button>
        </div>
      </div>
    );
  }

  if (stage === "error") {
    return (
      <div className="kt-scroll">
        <div className="screen-header"><h2>Create Post</h2></div>
        <div className="cld-upload-stage">
          <div className="cld-upload-icon" style={{ background: "#fee2e2" }}>
            <AlertTriangle size={36} color="#dc2626" />
          </div>
          <div className="cld-upload-title" style={{ color: "#dc2626" }}>Upload failed</div>
          <div className="cld-upload-sub">{uploadErr || saveErr || "Something went wrong. Please try again."}</div>
          <button className="kt-btn" style={{ marginTop: 20, maxWidth: 280 }} onClick={() => setStage("form")}>Try again</button>
        </div>
      </div>
    );
  }

  const isFormValid = Boolean(
    title.trim() &&
    mediaFile &&
    (tradeType === "karma" || needsItem.trim())
  );

  return (
    <div className="kt-scroll cp-upload-screen">
      <div className="screen-header"><h2>Create Post</h2></div>
      <input ref={fileRef} type="file" accept="video/*,image/*" style={{ display: "none" }} onChange={handleFile} />

      <div className="cp-upload-body">
        {!mediaUrl ? (
          <div className="cp-preview-card cp-preview-empty" onClick={() => fileRef.current?.click()}>
            <ImageIcon size={26} style={{ color: "#22c55e" }} />
            <div className="cp-preview-empty-title">Choose from gallery</div>
            <div className="cp-preview-empty-sub">Select a video or photo of your item, skill, or service</div>
            <div className="cp-preview-empty-badge"><Sparkles size={11} /> Powered by Cloudinary CDN</div>
          </div>
        ) : (
          <>
            <div className="cp-preview-card cp-preview-filled">
              {isVideo
                ? <video src={mediaUrl} controls className="cp-preview-media" />
                : <img src={mediaUrl} alt="preview" className="cp-preview-media" />
              }
              <button className="cp-preview-replace" onClick={() => { setMediaUrl(null); setMediaFile(null); }}>
                <RotateCcw size={13} /> Replace
              </button>
            </div>
            <div className="cp-media-meta">
              <span className="cp-media-name">{mediaFile?.name}</span>
              <span className="cp-media-sub">{(mediaFile?.size / 1024 / 1024).toFixed(1)} MB · {isVideo ? "Video" : "Image"}</span>
            </div>
          </>
        )}

        <div className="cp-fields-card">
          <div className="field-block">
            <label className="field-label">Title</label>
            <input className="field-input" placeholder="e.g. Razer Gaming Mouse" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="field-block">
            <label className="field-label">Description</label>
            <textarea className="field-textarea" placeholder="Describe condition, what you're looking to trade for…" value={desc} onChange={(e) => setDesc(e.target.value)} />
          </div>
          <div className="field-block">
            <label className="field-label">Category</label>
            <input className="field-input" placeholder="Electronics, Fashion, Skills…" value={category} onChange={(e) => setCategory(e.target.value)} />
          </div>

          <div className="field-block">
            <label className="field-label">Trade Type</label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginTop: 4 }}>
              <button
                type="button"
                onClick={() => setTradeType("exchange")}
                style={{
                  padding: "10px 6px",
                  borderRadius: 12,
                  border: tradeType === "exchange" ? "2px solid #22c55e" : "1px solid rgba(255, 255, 255, 0.1)",
                  background: tradeType === "exchange" ? "rgba(34, 197, 94, 0.12)" : "var(--card-bg, rgba(255, 255, 255, 0.05))",
                  color: "var(--ink, #fff)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 4,
                  cursor: "pointer",
                  transition: "all 0.2s ease"
                }}
              >
                <span style={{ fontSize: 16 }}>🔄</span>
                <span style={{ fontSize: 11, fontWeight: 600, textAlign: "center" }}>Exchange Product</span>
              </button>

              <button
                type="button"
                onClick={() => setTradeType("karma")}
                style={{
                  padding: "10px 6px",
                  borderRadius: 12,
                  border: tradeType === "karma" ? "2px solid #22c55e" : "1px solid rgba(255, 255, 255, 0.1)",
                  background: tradeType === "karma" ? "rgba(34, 197, 94, 0.12)" : "var(--card-bg, rgba(255, 255, 255, 0.05))",
                  color: "var(--ink, #fff)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 4,
                  cursor: "pointer",
                  transition: "all 0.2s ease"
                }}
              >
                <span style={{ fontSize: 16 }}>💎</span>
                <span style={{ fontSize: 11, fontWeight: 600, textAlign: "center" }}>Karma Points</span>
              </button>

              <button
                type="button"
                onClick={() => setTradeType("both")}
                style={{
                  padding: "10px 6px",
                  borderRadius: 12,
                  border: tradeType === "both" ? "2px solid #22c55e" : "1px solid rgba(255, 255, 255, 0.1)",
                  background: tradeType === "both" ? "rgba(34, 197, 94, 0.12)" : "var(--card-bg, rgba(255, 255, 255, 0.05))",
                  color: "var(--ink, #fff)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 4,
                  cursor: "pointer",
                  transition: "all 0.2s ease"
                }}
              >
                <span style={{ fontSize: 16 }}>🤝</span>
                <span style={{ fontSize: 11, fontWeight: 600, textAlign: "center" }}>Both</span>
              </button>
            </div>
          </div>

          {tradeType !== "karma" && (
            <div className="field-block">
              <label className="field-label">
                What do you need in return? <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <input
                className="field-input"
                placeholder="e.g. Study Table, Headphones, Bicycle…"
                value={needsItem}
                onChange={(e) => setNeedsItem(e.target.value)}
              />
            </div>
          )}
        </div>

        {matches.length > 0 && (
          <div className="match-preview-box">
            <div className="match-preview-title"><Sparkles size={13} /> Nearby traders offering "{needsItem}"</div>
            {matches.map((m) => (
              <div key={m.id} className="match-preview-row">
                <div className="avatar-sm">{m.avatar}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 12.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.title}</div>
                  <div style={{ fontSize: 11, color: "#6f8b80" }}>{m.city} · {formatDistance(m.distanceKm)} · ⭐ {m.karmaScore}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="cp-info-card">
          <div className="cp-info-row"><ScanEye size={15} /> <span>AI Authenticity &amp; Karma Score will be calculated right after upload</span></div>
          {userLocation?.city && (
            <div className="cp-info-row"><MapPin size={15} /> <span>Posting from <b>{userLocation.city}</b></span></div>
          )}
          <div className="cp-info-row"><ImageIcon size={15} /> <span>Media uploads securely via <b>Cloudinary CDN</b></span></div>
        </div>
      </div>

      <div className="cp-submit-bar">
        <button
          className="kt-btn"
          disabled={!isFormValid}
          style={!isFormValid ? { opacity: 0.4 } : {}}
          onClick={startUpload}
        >
          <ScanEye size={16} /> Upload &amp; Analyze
        </button>
      </div>
    </div>
  );
}

export function AiAnalyzingScreen({ isVideo }) {
  const [stepIdx, setStepIdx] = useState(0);
  const steps = isVideo
    ? ["Scanning video quality…", "Checking for manipulation…", "Matching content to listing…", "Calculating Karma Score…"]
    : ["Scanning image clarity…", "Detecting condition & wear…", "Verifying authenticity…", "Calculating Karma Score…"];

  useEffect(() => {
    if (stepIdx < steps.length - 1) {
      const t = setTimeout(() => setStepIdx((s) => s + 1), 480);
      return () => clearTimeout(t);
    }
  }, [stepIdx]);

  return (
    <div className="kt-scroll">
      <div className="screen-header"><h2>Create Post</h2></div>
      <div className="ai-scan-wrap">
        <div className="ai-scan-ring"><ScanEye size={32} /></div>
        <div className="ai-scan-title">AI Authenticity Engine</div>
        <div className="ai-scan-sub">Analyzing your {isVideo ? "video" : "image"} listing…</div>
        <div className="ai-scan-steps">
          {steps.map((s, i) => (
            <div key={i} className={`ai-scan-step ${i <= stepIdx ? "active" : ""}`}>
              {i < stepIdx ? <CheckCircle2 size={14} /> : <span className="ai-scan-dot" />}
              {s}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export const BADGE_ICONS = { shield: ShieldCheck, check: BadgeCheck, sparkle: Sparkles, award: Award, users: Users };

export function AiResultsScreen({ report, title, onEdit, onConfirm }) {
  const band = karmaBandLabel(report.finalScore);
  const bandColor = report.needsReview ? "#ef4444" : report.finalScore >= 70 ? "#16a34a" : "#b8860b";

  return (
    <div className="kt-scroll">
      <div className="screen-header"><h2>AI Scan Results</h2></div>

      <div className="ai-result-hero">
        <div className="ai-result-ring" style={{ borderColor: bandColor }}>
          <span style={{ color: bandColor }}>{report.finalScore}</span>
          <span className="ai-result-ring-sub">/ 100</span>
        </div>
        <div className="ai-result-band" style={{ color: bandColor }}>{band}</div>
        <div className="ai-result-item-title">{title || "Untitled listing"}</div>
      </div>

      {report.needsReview && (
        <div className="warning-box" style={{ margin: "0 16px 14px" }}>
          <ShieldAlert size={16} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 13 }}>Flagged for manual review</div>
            <div style={{ fontSize: 12, marginTop: 3 }}>This listing scored too low or triggered multiple fraud signals. It's been sent to Point Maker moderation and PM Points are reduced until reviewed.</div>
          </div>
        </div>
      )}

      <div className="score-grid">
        <ScoreTile label={report.isVideo ? "Video Authenticity" : "Image Authenticity"} value={report.authenticity} />
        <ScoreTile label="Condition Score" value={report.condition} />
        <ScoreTile label="Content Quality" value={report.contentQuality} />
        <ScoreTile label="Karma Score" value={report.trustScore} />
      </div>

      <div className="kp-result-card">
        <div className="kp-result-label"><Sparkles size={13} /> Recommended PM Points</div>
        <div className="kp-result-amount">{report.recommendedKp} PM</div>
        <div className="kp-result-formula">
          30% Authenticity + 25% Condition + 20% Quality + 15% Category + 10% Completeness
        </div>
      </div>

      {report.badges.length > 0 && (
        <div className="badges-section">
          <div className="section-title" style={{ paddingTop: 0 }}>AI Trust Badges Earned</div>
          <div className="badge-grid">
            {report.badges.map((b, i) => {
              const Icon = BADGE_ICONS[b.icon] || CheckCircle2;
              return (
                <div key={i} className="ai-badge">
                  <Icon size={14} /> {b.label}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {report.flags.length > 0 && (
        <div className="flags-section">
          <div className="section-title" style={{ paddingTop: 0 }}>AI Notes</div>
          {report.flags.map((f, i) => (
            <div key={i} className="ai-flag-row"><AlertTriangle size={13} /> {f}</div>
          ))}
        </div>
      )}

      <div className="field-block" style={{ display: "flex", gap: 10, paddingTop: 6 }}>
        <button className="kt-btn ghost" onClick={onEdit}>Edit listing</button>
        <button className="kt-btn" onClick={onConfirm}>
          <CheckCircle2 size={16} /> {report.needsReview ? "Submit for review" : "Confirm & Post"}
        </button>
      </div>
    </div>
  );
}
