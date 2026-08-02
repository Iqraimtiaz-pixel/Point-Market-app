// ── Extracted from App.jsx: DISTANCE_FILTERS, HomeScreen, SmartNotificationsSheet, buildSmartNotifications ──
import React, { useState, useEffect } from "react";
import {
  PlusCircle,
  CheckCircle2,
  Sparkles,
  ChevronRight,
  AlertTriangle,
  MapPin,
  Map as MapIcon
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
import { getDemoListingsForCity } from "../demoListings";
import AdsterraNativeBanner from "../components/AdsterraNativeBanner";
import { FeedCard } from "../components/FeedCard";
import { TopAppBar } from "../components/TopAppBar";
import { DetailScreen } from "./DetailScreen";
import { haversineDistanceKm, formatDistance } from "../utils/distance";
import { DEFAULT_LOCATION } from "../utils/location";

export const DISTANCE_FILTERS = [
  { key: "5km",   label: "Within 5 KM",  maxKm: 5 },
  { key: "10km",  label: "Within 10 KM", maxKm: 10 },
  { key: "20km",  label: "Within 20 KM", maxKm: 20 },
  { key: "city",  label: "Entire City",  maxKm: Infinity },
];


export function HomeScreen({ userLocation, currentUser, onOpenDetail, onTrade, onOpenMap, onOpenProfile, onOpenPmSpace, onOpenCreate }) {
  const [query,        setQuery]        = useState("");
  const [distFilter,   setDistFilter]   = useState("5km");
  const [showNotifs,   setShowNotifs]   = useState(false);

  // ── Real Firestore posts feed ──
  const [firestorePosts, setFirestorePosts] = useState([]);
  const [feedLoading,    setFeedLoading]    = useState(true);
  const [feedError,      setFeedError]      = useState(null);

  const activeCity = (userLocation || DEFAULT_LOCATION).city;

  useEffect(() => {
    setFeedLoading(true);
    setFeedError(null);

    try {
      // Listen to posts collection — scoped to the user's current city, then
      // ordered by createdAt descending. This matches the (status, city,
      // createdAt) composite index already defined in firestore.indexes.json.
      // Previously this query had no city filter at all and simply pulled the
      // newest 30 posts across every city, so a brand-new post in the user's
      // own city could be crowded out by posts from other cities and never
      // reach the client-side city filter below.
      const postsRef = collection(db, "posts");
      const q = fsQuery(
        postsRef,
        where("status", "==", "active"),
        where("city", "==", activeCity),
        orderBy("createdAt", "desc"),
        limit(30)
      );

      const unsub = onSnapshot(q,
        (snap) => {
          const posts = snap.docs.map((docSnap) => ({
            id:          docSnap.id,
            ...docSnap.data(),
            // Normalise field names to match what FeedCard and DetailScreen expect
            desc:        docSnap.data().description || docSnap.data().desc || "",
            aiValue:     docSnap.data().recommendedPm || docSnap.data().aiValue || 0,
            karmaScore:  docSnap.data().aiKarmaScore  || docSnap.data().karmaScore || 0,
            avatar:      docSnap.data().avatar        || "🧑",
            user:        docSnap.data().username      || docSnap.data().userId || "unknown",
            comments:    docSnap.data().comments      || 0,
            // Location defaults
            city:        docSnap.data().city   || DEFAULT_LOCATION.city,
            lat:         docSnap.data().lat    || DEFAULT_LOCATION.lat,
            lng:         docSnap.data().lng    || DEFAULT_LOCATION.lng,
            // Fallback colours for gradient when no Cloudinary media
            color1:      docSnap.data().color1 || "#bdeede",
            color2:      docSnap.data().color2 || "#8fd9bd",
          }))
          // Boosted posts still float to the top — now done client-side
          // since the Firestore-level sort is by city+createdAt only.
          .sort((a, b) => (b.isBoosted === true) - (a.isBoosted === true));

          // Only show real Firestore posts — no static merge
          setFirestorePosts(posts);
          setFeedLoading(false);
        },
        (err) => {
          console.warn("Feed listener error:", err.message);
          setFirestorePosts([]);   // show empty feed, not stale demo data
          setFeedLoading(false);
          setFeedError("Could not load feed. Check your connection and try again.");
        }
      );

      return () => unsub();
    } catch (err) {
      console.warn("Feed setup error:", err.message);
      setFirestorePosts([]);
      setFeedLoading(false);
      setFeedError("Could not connect to the feed. Please check your Firebase setup.");
    }
  }, [activeCity]); // Re-subscribe whenever the user's active city changes

  // Attach live distance + same-city flag to every post
  const enriched = firestorePosts.map((item) => {
    const distanceKm = item.lat && item.lng
      ? haversineDistanceKm(userLocation.lat, userLocation.lng, item.lat, item.lng)
      : 999;
    return { ...item, distanceKm, sameCity: item.city === userLocation.city };
  });

  const activeFilter = DISTANCE_FILTERS.find((f) => f.key === distFilter) || DISTANCE_FILTERS[0];
  const cityScoped    = enriched.filter((item) => item.sameCity);
  const distScoped    = cityScoped.filter((item) => item.distanceKm <= activeFilter.maxKm);
  const searchFiltered = distScoped.filter((item) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (item.title || "").toLowerCase().includes(q) ||
           (item.desc  || "").toLowerCase().includes(q) ||
           (item.user  || "").toLowerCase().includes(q);
  });

  // Demo listings (presentation-layer only). Show when real listings are few
  // and always place demo items below authentic user listings.
  const demoCandidates = getDemoListingsForCity(userLocation?.city || DEFAULT_LOCATION.city) || [];
  const showDemo = demoCandidates.length > 0 && (searchFiltered.length < 3 || firestorePosts.length === 0);
  const demoNeeded = Math.max(0, 5 - searchFiltered.length);
  const demoItems = showDemo ? demoCandidates.slice(0, demoNeeded) : [];

  const rankScore = (item) => {
    if (item.sameCity && item.distanceKm <= 5)  return 0;
    if (item.sameCity && item.distanceKm <= 10) return 1;
    if (item.sameCity && item.distanceKm <= 20) return 2;
    if (item.sameCity)                          return 3;
    return 4;
  };
  const nearbyForYou = [...enriched]
    .sort((a, b) => {
      const ra = rankScore(a), rb = rankScore(b);
      if (ra !== rb) return ra - rb;
      if (ra === 3) return (b.karmaScore || 0) - (a.karmaScore || 0);
      return a.distanceKm - b.distanceKm;
    })
    .slice(0, 5);

  const notifications = buildSmartNotifications(enriched, userLocation);

  return (
    <>
      <TopAppBar
        query={query}
        onQueryChange={setQuery}
        rightExtra={<button className="icon-btn" onClick={onOpenMap} title="Map view"><MapIcon size={17} /></button>}
        notifCount={notifications.length}
        onOpenNotifs={() => setShowNotifs(true)}
        onOpenProfile={onOpenProfile}
      />

      <div className="location-bar">
        <div className="location-pill"><MapPin size={12} /> {userLocation.city}</div>
        <div className="filter-scroll">
          {DISTANCE_FILTERS.map((f) => (
            <div key={f.key} className={`filter-chip ${distFilter === f.key ? "active" : ""}`} onClick={() => setDistFilter(f.key)}>
              {f.label}
            </div>
          ))}
        </div>
      </div>

      <div className="kt-scroll">
        {/* Loading state — skeleton cards */}
        {feedLoading && (
          <>
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton-card">
                <div className="skeleton skeleton-media" />
                <div className="skeleton skeleton-line w-60" />
                <div className="skeleton skeleton-line w-40" />
              </div>
            ))}
          </>
        )}

        {/* Nearby For You section */}
        {!feedLoading && nearbyForYou.length > 0 && (
          <div className="nearby-section">
            <div className="nearby-header"><Sparkles size={14} /> Nearby For You</div>
            <div className="nearby-scroll">
              {nearbyForYou.map((item) => (
                <div key={item.id} className="nearby-card" onClick={() => onOpenDetail(item)}>
                  {item.thumbnailUrl ? (
                    <img src={item.thumbnailUrl} alt={item.title} className="nearby-thumb-img" />
                  ) : (
                    <div className="nearby-thumb" style={{ background: `linear-gradient(160deg, ${item.color1 || "#bdeede"}, ${item.color2 || "#8fd9bd"})` }}>🎥</div>
                  )}
                  <div className="nearby-title">{item.title}</div>
                  <div className="nearby-meta">
                    <span className="nearby-dist">{item.distanceKm <= 2 ? "🔥" : "📍"} {formatDistance(item.distanceKm)}</span>
                    {item.verified && <CheckCircle2 size={11} color="#22c55e" />}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Feed error state — only shown when Firestore actually failed */}
        {!feedLoading && feedError && (
          <div className="empty-state" style={{ color: "#dc2626" }}>
            <AlertTriangle size={20} style={{ marginBottom: 8 }} />
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Could not load feed</div>
            <div style={{ fontSize: 12.5 }}>{feedError}</div>
          </div>
        )}

        {/* Main feed — professional empty state when there simply are no listings yet */}
        {!feedLoading && !feedError && searchFiltered.length === 0 && demoItems.length === 0 && (
          firestorePosts.length === 0 ? (
            <div className="empty-state feed-empty-pro">
              <div className="feed-empty-icon"><Sparkles size={22} /></div>
              <div className="feed-empty-title">No listings available yet.</div>
              <div className="feed-empty-sub">Be the first person to post in your area.</div>
              <button className="kt-btn primary feed-empty-cta" onClick={onOpenCreate}>
                <PlusCircle size={16} /> Create First Listing
              </button>
            </div>
          ) : (
            <div className="empty-state">
              <div style={{ fontSize: 28, marginBottom: 8 }}>📭</div>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>No listings nearby</div>
              <div style={{ fontSize: 12.5, color: "#6f8b80" }}>
                No listings within {activeFilter.label.toLowerCase()} in {userLocation.city}.{query ? " Try clearing your search." : ""}
              </div>
            </div>
          )
        )}
        {!feedLoading && searchFiltered.map((item, i) => (
          <React.Fragment key={item.id}>
            <FeedCard item={item} onOpenDetail={onOpenDetail} onTrade={onTrade} onOpenPmSpace={onOpenPmSpace} currentUser={currentUser} />
            {/* Native ad slot after every 5 listings */}
            {(i + 1) % 5 === 0 && <AdsterraNativeBanner />}
          </React.Fragment>
        ))}

        {/* Demo listings (UI-only). Always render below authentic listings. */}
        {!feedLoading && demoItems.length > 0 && (
          <div className="demo-section">
            <div className="demo-header">Explore Demos — Browse Only</div>
            {demoItems.map((d) => (
              <FeedCard key={d.id} item={d} onOpenDetail={onOpenDetail} onTrade={onTrade} onOpenPmSpace={onOpenPmSpace} currentUser={currentUser} />
            ))}
          </div>
        )}
      </div>

      {showNotifs && <SmartNotificationsSheet notifications={notifications} onClose={() => setShowNotifs(false)} onOpenDetail={(item) => { setShowNotifs(false); onOpenDetail(item); }} />}
    </>
  );
}


export function buildSmartNotifications(enriched, userLocation) {
  const notifs = [];
  enriched
    .filter((i) => i.sameCity && i.distanceKm <= 5)
    .slice(0, 2)
    .forEach((i) => {
      notifs.push({
        id: `match-${i.id}`,
        icon: "🔥",
        text: `Someone ${formatDistance(i.distanceKm)} away is looking for a ${i.needsItem || "trade"} — your nearby match: "${i.title}"`,
        item: i,
      });
    });
  // Cross-match example: bicycle ↔ study table (Intelligent Requirement Matching demo)
  const bike = enriched.find((i) => i.title.toLowerCase().includes("bicycle"));
  const table = enriched.find((i) => i.title.toLowerCase().includes("study table"));
  if (bike && table) {
    notifs.push({
      id: "smart-match-1",
      icon: "✨",
      text: `A Study Table matching your requirement was found ${formatDistance(table.distanceKm)} away.`,
      item: table,
    });
  }
  return notifs;
}


export function SmartNotificationsSheet({ notifications, onClose, onOpenDetail }) {
  return (
    <div className="sheet-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet">
        <div className="sheet-handle" />
        <h3 className="sheet-title">Smart Notifications</h3>
        <p className="sheet-sub">Nearby matches based on your location and trade requirements.</p>
        {notifications.length === 0 ? (
          <div className="empty-state">No nearby matches right now. Check back soon!</div>
        ) : (
          notifications.map((n) => (
            <div key={n.id} className="notif-row" onClick={() => onOpenDetail(n.item)}>
              <span className="notif-emoji">{n.icon}</span>
              <span className="notif-text">{n.text}</span>
              <ChevronRight size={15} color="#6f8b80" />
            </div>
          ))
        )}
      </div>
    </div>
  );
}

