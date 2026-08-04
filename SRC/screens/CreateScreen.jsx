export function CreateScreen({ currentUser, userLocation }) {
  /* â”€â”€ Form fields â”€â”€ */
  const [mediaUrl,   setMediaUrl]   = useState(null);   // local blob preview
  const [mediaFile,  setMediaFile]  = useState(null);
  const [isVideo,    setIsVideo]    = useState(true);
  const [title,      setTitle]      = useState("");
  const [desc,       setDesc]       = useState("");
  const [category,   setCategory]   = useState("");
  const [tradeType,  setTradeType]  = useState("exchange"); // "exchange" | "karma" | "both"
  const [needsItem,  setNeedsItem]  = useState("");

  /* â”€â”€ Stage machine â”€â”€ */
  const [stage,      setStage]      = useState("form");
  //  form | uploading | analyzing | results | saving | posted | error

  /* â”€â”€ Cloudinary upload â”€â”€ */
  const [progress,   setProgress]   = useState(0);
  const [uploadErr,  setUploadErr]  = useState(null);
  const [cldResult,  setCldResult]  = useState(null);   // raw Cloudinary response

  /* â”€â”€ AI analysis â”€â”€ */
  const [report,     setReport]     = useState(null);

  /* â”€â”€ Save error â”€â”€ */
  const [saveErr,    setSaveErr]    = useState(null);

  const fileRef  = useRef(null);
  const abortRef = useRef(null);

  /* â”€â”€ File picker â”€â”€ */
  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setMediaFile(file);
    setMediaUrl(URL.createObjectURL(file));
    setIsVideo(file.type.startsWith("video/"));
    setUploadErr(null);
  };

  /* â”€â”€ Smart match preview (unchanged from original) â”€â”€ */
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

  /* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
     STEP 1 â€” Upload to Cloudinary
  â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
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
      // Move straight into AI analysis
      runAiAnalysis(result);
    } catch (err) {
      if (err.name === "AbortError") {
        setStage("form");
      } else {
        setUploadErr(err.message);
        setStage("error");
      }
    }
  };

  /* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
     STEP 2 â€” AI authenticity analysis
  â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  const runAiAnalysis = (cloudinaryResult) => {
    setStage("analyzing");
    // Simulate the AI processing delay
    // In production: swap setTimeout for a real CV/LLM service call
    setTimeout(() => {
      const aiReport = runAiAuthenticityEngine({
        title, desc, category, mediaFile, isVideo,
      });
      setReport(aiReport);
      setStage("results");
    }, 2200);
  };

  /* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
     STEP 3 â€” Save to Firestore
     Called when user taps "Confirm & Post" on the results screen
  â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  const saveToFirestore = async () => {
    if (!cldResult || !report) return;

    // â”€â”€ Auth guard â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

    // â”€â”€ Resolve live location â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const activeLocation = userLocation || DEFAULT_LOCATION;

    // â”€â”€ Build the Firestore document â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const postData = {
      // Auth binding
      userId:         uid,
      username:       currentUser.username       || currentUser.displayName || "",
      avatar:         currentUser.avatarEmoji    || currentUser.photoURL    || "ðŸ§‘",
      avatarUrl:      currentUser.avatarUrl      || null,
      verified:       currentUser.isVerified     || false,
      isProSeller:    currentUser.isProSeller    || false,

      // Content
      title:          title.trim(),
      description:    desc.trim(),
      category:       category.trim(),
      needsInReturn:  tradeType === "karma" ? "" : needsItem.trim(),
      tradeType:      tradeType,
      contentType:    isVid ? "video" : "image",

      // Cloudinary media (all fields needed for FeedCard + DetailScreen)
      mediaUrl:       cldResult.secure_url,
      mediaType:      isVid ? "video" : "image",
      thumbnailUrl,
      publicId:       cldResult.public_id,
      mediaFormat:    cldResult.format    || null,
      mediaBytes:     cldResult.bytes     || null,
      videoDuration:  cldResult.duration  || null,
      videoWidth:     cldResult.width     || null,
      videoHeight:    cldResult.height    || null,

      // AI scoring results
      aiKarmaScore:   report.finalScore,
      recommendedPm:  report.recommendedKp,
      karmaScore:     report.finalScore,        // FeedCard reads karmaScore
      aiValue:        report.recommendedKp,     // DetailScreen reads aiValue
      aiBadges:       report.badges.map((b) => b.label),
      aiAuthenticity: report.authenticity,
      aiCondition:    report.condition,
      aiNeedsReview:  report.needsReview,

      // Location
      city:           activeLocation.city  || "",
      lat:            activeLocation.lat   || null,
      lng:            activeLocation.lng   || null,

      // Feed defaults
      likes:          0,
      views:          0,
      saves:          0,
      comments:       0,
      isBoosted:      false,
      isRemoved:      false,
      status:         report.needsReview ? "pending_review" : "active",

      // Fallback gradient colours for FeedCard when media is loading
      color1:         "#bdeede",
      color2:         "#8fd9bd",
    };

    try {
      // â”€â”€ Write to top-level posts collection â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      // Path: /posts/{postId}
      // Indexed by userId, city, status so feeds can query efficiently.
      const postsCol  = collection(db, "posts");
      const postRef   = await addDoc(postsCol, {
        ...postData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // â”€â”€ Mirror under user's sub-collection â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      // Path: /users/{userId}/posts/{postId}
      // Used for PM Space "My Posts" feed without extra queries.
      const userPostRef = doc(db, "users", uid, "posts", postRef.id);
      await setDoc(userPostRef, {
        userId:     uid,
        postId:     postRef.id,
        title:      postData.title,
        thumbnailUrl,
        mediaUrl:   postData.mediaUrl,   // was missing â€” video/image was unrenderable from this mirror doc
        publicId:   postData.publicId,   // was missing â€” no fallback thumbnail could be built either
        mediaType:  postData.mediaType,
        status:     postData.status,
        aiKarmaScore: postData.aiKarmaScore,
        createdAt:  serverTimestamp(),
      });

      // Update user's seller statistics and assign Silver/Gold badges.
      try {
        const userRef = doc(db, "users", uid);
        const userSnap = await getDoc(userRef);
        const userData = userSnap.exists() ? userSnap.data() : {};

        // First listing ever â€” unlock the 100 PM welcome bonus that was
        // credited (but locked) at signup. Matches the promise shown in the
        // Wallet screen and the CreateScreen locked-balance hint.
        if (userData.pointsStatus === "locked") {
          updateDoc(userRef, { pointsStatus: "unlocked" }).catch((unlockErr) => {
            console.warn("Welcome bonus unlock failed:", unlockErr?.message || unlockErr);
          });
        }

        // If this listing passed AI checks (not flagged), count it as a successful listing
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

          // Assign badges based on thresholds (minimal, conservative rules):
          // Silver: avg AI score > 80, >=60 successful listings, no flagged listings
          // Gold:   avg AI score > 92, >=250 successful listings, no flagged listings
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
          // Flagged/under-review listings increment flagged count for the seller
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

  /* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
     RENDER â€” stage machine
  â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

  /* â”€â”€ Uploading to Cloudinary â”€â”€ */
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

  /* â”€â”€ AI analysis â”€â”€ */
  if (stage === "analyzing") return <AiAnalyzingScreen isVideo={isVideo} />;

  /* â”€â”€ AI results â”€â”€ */
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

  /* â”€â”€ Saving to Firestore â”€â”€ */
  if (stage === "saving") {
    return (
      <div className="kt-scroll">
        <div className="screen-header"><h2>Create Post</h2></div>
        <div className="cld-upload-stage">
          <div className="cld-upload-icon" style={{ background: "var(--sea-light)" }}>
            <CheckCircle2 size={36} color="#22c55e" />
          </div>
          <div className="cld-upload-title">Saving your listingâ€¦</div>
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

  /* â”€â”€ Success â”€â”€ */
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

          {/* Show the real Cloudinary thumbnail */}
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
                <div className="cld-info-row"><span>CDN URL</span><a href={cldResult.secure_url} target="_blank" rel="noopener noreferrer" style={{ color: "#22c55e", fontSize: 11, wordBreak: "break-all" }}>View on Cloudinary â†—</a></div>
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
            setCldResult(null); setReport(null);
          }}>
            <PlusCircle size={16} /> Create another post
          </button>
        </div>
      </div>
    );
  }

  /* â”€â”€ Error state â”€â”€ */
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

  /* â”€â”€ Form validation check â”€â”€ */
  const isFormValid = Boolean(
    title.trim() &&
    mediaFile &&
    (tradeType === "karma" || needsItem.trim())
  );

  /* â”€â”€ Main form â”€â”€ */
  return (
    <div className="kt-scroll cp-upload-screen">
      <div className="screen-header"><h2>Create Post</h2></div>
      <input ref={fileRef} type="file" accept="video/*,image/*" style={{ display: "none" }} onChange={handleFile} />

      <div className="cp-upload-body">
        {/* â”€â”€ Media picker / preview â€” compact 16:9 rounded card â”€â”€ */}
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
              <span className="cp-media-sub">{(mediaFile?.size / 1024 / 1024).toFixed(1)} MB Â· {isVideo ? "Video" : "Image"}</span>
            </div>
          </>
        )}

        {/* â”€â”€ Form fields â”€â”€ */}
        <div className="cp-fields-card">
          <div className="field-block">
            <label className="field-label">Title</label>
            <input className="field-input" placeholder="e.g. Razer Gaming Mouse" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="field-block">
            <label className="field-label">Description</label>
            <textarea className="field-textarea" placeholder="Describe condition, what you're looking to trade forâ€¦" value={desc} onChange={(e) => setDesc(e.target.value)} />
          </div>
          <div className="field-block">
            <label className="field-label">Category</label>
            <input className="field-input" placeholder="Electronics, Fashion, Skillsâ€¦" value={category} onChange={(e) => setCategory(e.target.value)} />
          </div>

          {/* â”€â”€ Trade Type Options â”€â”€ */}
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
                <span style={{ fontSize: 16 }}>ðŸ”„</span>
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
                <span style={{ fontSize: 16 }}>ðŸ’Ž</span>
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
                <span style={{ fontSize: 16 }}>ðŸ¤</span>
                <span style={{ fontSize: 11, fontWeight: 600, textAlign: "center" }}>Both</span>
              </button>
            </div>
          </div>

          {/* â”€â”€ Conditional "What do you need in return?" field â”€â”€ */}
          {tradeType !== "karma" && (
            <div className="field-block">
              <label className="field-label">
                What do you need in return? <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <input
                className="field-input"
                placeholder="e.g. Study Table, Headphones, Bicycleâ€¦"
                value={needsItem}
                onChange={(e) => setNeedsItem(e.target.value)}
              />
            </div>
          )}
        </div>

        {/* â”€â”€ Smart match preview â”€â”€ */}
        {matches.length > 0 && (
          <div className="match-preview-box">
            <div className="match-preview-title"><Sparkles size={13} /> Nearby traders offering "{needsItem}"</div>
            {matches.map((m) => (
              <div key={m.id} className="match-preview-row">
                <div className="avatar-sm">{m.avatar}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 12.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.title}</div>
                  <div style={{ fontSize: 11, color: "#6f8b80" }}>{m.city} Â· {formatDistance(m.distanceKm)} Â· â­ {m.karmaScore}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* â”€â”€ AI value + location info â”€â”€ */}
        <div className="cp-info-card">
          <div className="cp-info-row"><ScanEye size={15} /> <span>AI Authenticity &amp; Karma Score will be calculated right after upload</span></div>
          {userLocation?.city && (
            <div className="cp-info-row"><MapPin size={15} /> <span>Posting from <b>{userLocation.city}</b></span></div>
          )}
          <div className="cp-info-row"><ImageIcon size={15} /> <span>Media uploads securely via <b>Cloudinary CDN</b></span></div>
        </div>
      </div>

      {/* â”€â”€ Submit button â€” sticky to the bottom of the screen â”€â”€ */}
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
