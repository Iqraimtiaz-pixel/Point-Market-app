// ── New: MarketplaceScreen — public browse view for Products or Skills.
// One parameterized component (filter="products"|"skills") rather than two
// near-duplicate screens. Reuses: the status/city/createdAt query pattern
// already established in HomeScreen.jsx, the category classification from
// utils/categoryHelpers.js (same source ListingsScreen.jsx now uses), the
// .listings-grid CSS already defined for ListingsScreen's medium-sized
// cards, and DetailScreen for the detail step — nothing here is a new
// visual language, all reused from what already exists in the project. ──
import React, { useState, useEffect } from "react";
import {
  ChevronLeft,
  Search,
  Sparkles,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  ShoppingBag,
  Handshake,
  Bell,
  X
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
import { haversineDistanceKm, formatDistance } from "../utils/distance";
import { DEFAULT_LOCATION } from "../utils/location";
import { isSkillCategory, isServiceCategory } from "../utils/categoryHelpers";
import { DISTANCE_FILTERS } from "./HomeScreen";

export function MarketplaceScreen({ filter, initialCategory, userLocation, currentUser, onBack, onOpenDetail, onOpenNotifs }) {
  const isSkillsMode = filter === "skills";
  const [query,           setQuery]           = useState("");
  const [distFilter,      setDistFilter]      = useState("5km");
  const [categoryFilter,  setCategoryFilter]  = useState(initialCategory || null);
  const [posts,      setPosts]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);

  const activeCity = (userLocation || DEFAULT_LOCATION).city;

  // ── Same status/city/createdAt query HomeScreen already uses, so this
  // screen relies on the exact same composite index — no new index needed. ──
  useEffect(() => {
    setLoading(true);
    setError(null);
    try {
      const q = fsQuery(
        collection(db, "posts"),
        where("status", "==", "active"),
        where("city", "==", activeCity),
        orderBy("createdAt", "desc"),
        limit(60)
      );
      const unsub = onSnapshot(q,
        (snap) => {
          setPosts(snap.docs.map((d) => ({
            id: d.id,
            ...d.data(),
            desc:       d.data().description || d.data().desc || "",
            aiValue:    d.data().recommendedPm ?? d.data().aiValue ?? 0,
            karmaScore: d.data().aiKarmaScore  ?? d.data().karmaScore ?? 0,
            avatar:     d.data().avatar        || "🧑",
            user:       d.data().username      || d.data().userId || "unknown",
            comments:   d.data().comments      ?? 0,
            lat:        d.data().lat ?? DEFAULT_LOCATION.lat,
            lng:        d.data().lng ?? DEFAULT_LOCATION.lng,
          })));
          setLoading(false);
        },
        (err) => { console.warn("Marketplace listener error:", err.message); setPosts([]); setLoading(false); setError("Could not load listings. Check your connection and try again."); }
      );
      return unsub;
    } catch (err) {
      setLoading(false);
      setError("Could not connect to the marketplace.");
    }
  }, [activeCity]);

  // ── This is the fix for "Products and Skills mixed incorrectly" — the
  // same category split already used by ListingsScreen, applied here to
  // every user's public posts instead of just the current user's own. ──
  const typeFiltered = posts.filter((p) => isSkillsMode ? isSkillCategory(p.category) : !isSkillCategory(p.category) && !isServiceCategory(p.category));

  // ── Category chip filter (e.g. "Furniture", "Web Development"). Category
  // is a free-text field at listing-creation time — there's no fixed
  // taxonomy — so this matches the same case-insensitive substring way as
  // isSkillCategory/isServiceCategory above, and also checks title/desc so
  // a listing doesn't get missed just because its category text differs
  // slightly from the chip label. ──
  const categoryFiltered = categoryFilter
    ? typeFiltered.filter((p) => {
        const needle = categoryFilter.toLowerCase();
        return (p.category || "").toLowerCase().includes(needle)
            || (p.title    || "").toLowerCase().includes(needle)
            || (p.desc     || "").toLowerCase().includes(needle);
      })
    : typeFiltered;

  const enriched = categoryFiltered.map((item) => ({
    ...item,
    distanceKm: haversineDistanceKm(userLocation.lat, userLocation.lng, item.lat, item.lng),
  }));
  const activeFilter = DISTANCE_FILTERS.find((f) => f.key === distFilter) || DISTANCE_FILTERS[0];
  const distScoped = enriched.filter((item) => item.distanceKm <= activeFilter.maxKm);
  const searchFiltered = distScoped.filter((item) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (item.title || "").toLowerCase().includes(q) || (item.desc || "").toLowerCase().includes(q);
  });

  const openItemDetail = (item) => onOpenDetail?.(item);

  return (
    <div className="kt-scroll">
      <div className="screen-header">
        <button className="back-btn-inline" onClick={onBack}><ChevronLeft size={20} /></button>
        <h2 style={{ flex: 1 }}>{isSkillsMode ? "Skills Marketplace" : "Products Marketplace"}</h2>
        <button className="icon-btn" title="Notifications" onClick={() => onOpenNotifs?.()}><Bell size={17} /></button>
      </div>

      <div style={{ padding: "0 16px 10px" }}>
        <div className="search-pill" style={{ width: "100%" }}>
          <Search size={15} />
          <input
            className="search-input"
            placeholder={isSkillsMode ? "Search skills, services, traders…" : "Search products, traders…"}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="location-bar">
        <div className="location-pill"><MapPin size={12} /> {activeCity}</div>
        <div className="filter-scroll">
          {DISTANCE_FILTERS.map((f) => (
            <div key={f.key} className={`filter-chip ${distFilter === f.key ? "active" : ""}`} onClick={() => setDistFilter(f.key)}>
              {f.label}
            </div>
          ))}
        </div>
      </div>

      {categoryFilter && (
        <div style={{ padding: "0 16px 8px" }}>
          <div className={`filter-chip active`} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: isSkillsMode ? "var(--pink-light)" : "var(--sea-light)", color: isSkillsMode ? "var(--pink-dark)" : "var(--sea-dark)" }}>
            {categoryFilter}
            <X size={12} onClick={() => setCategoryFilter(null)} style={{ cursor: "pointer" }} />
          </div>
        </div>
      )}

      <div style={{ padding: "8px 16px 16px" }}>
        {loading && (
          <div className="listings-grid market-grid">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="listings-grid-tile">
                <div className="skeleton" style={{ aspectRatio: "1 / 1", borderRadius: 16 }} />
                <div className="skeleton skeleton-line w-60" style={{ margin: "8px 0 0" }} />
              </div>
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="empty-state" style={{ color: "#dc2626" }}>
            <AlertTriangle size={20} style={{ marginBottom: 8 }} />
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Could not load listings</div>
            <div style={{ fontSize: 12.5 }}>{error}</div>
          </div>
        )}

        {!loading && !error && searchFiltered.length === 0 && (
          <div className="empty-state">
            <div style={{ fontSize: 28, marginBottom: 8 }}>{isSkillsMode ? "🤝" : "🛍️"}</div>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>
              No {isSkillsMode ? "skills or services" : "products"} nearby yet
            </div>
            <div style={{ fontSize: 12.5, color: "#6f8b80" }}>
              {query ? "Try clearing your search or widening the distance filter." : `Be the first to list a ${isSkillsMode ? "skill" : "product"} in ${activeCity}.`}
            </div>
          </div>
        )}

        {!loading && !error && searchFiltered.length > 0 && (
          <div className="listings-grid market-grid">
            {searchFiltered.map((item) => (
              <div key={item.id} className="listings-grid-tile" onClick={() => openItemDetail(item)}>
                <div className="listings-grid-thumb" style={{ background: `linear-gradient(160deg, ${item.color1 || "#bdeede"}, ${item.color2 || "#8fd9bd"})` }}>
                  {(item.thumbnailUrl || item.mediaUrl)
                    ? <img src={item.thumbnailUrl || item.mediaUrl} alt="" />
                    : <span className="listings-grid-emoji">{isSkillsMode ? <Handshake size={22} /> : <ShoppingBag size={22} />}</span>}
                  {item.verified && <CheckCircle2 size={13} color="#22c55e" style={{ position: "absolute", top: 6, right: 6, background: "#fff", borderRadius: "999px" }} />}
                </div>
                <div className="listings-grid-title">{item.title}</div>
                <div className="listings-grid-pm market-kp-badge"><Sparkles size={10} /> {item.aiValue.toLocaleString()} KP</div>
                <div style={{ fontSize: 10, color: "#6f8b80", marginTop: 1 }}>{item.user} · {formatDistance(item.distanceKm)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
