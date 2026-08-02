// ── Extracted from App.jsx: ListingsScreen ──
import React, { useState, useEffect } from "react";
import {
  Home,
  ChevronLeft,
  Sparkles,
  TrendingUp,
  AlertTriangle,
  Video,
  Trash2
} from "lucide-react";
import {
  doc,
  collection,
  query as fsQuery,
  where,
  orderBy,
  onSnapshot,
  deleteDoc,
} from "firebase/firestore";
import { db } from "../firebase";
import { DetailScreen } from "./DetailScreen";

export function ListingsScreen({ onBack, currentUser, onOpenDetail }) {
  const uid = currentUser?.uid;
  const [listings, setListings] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);

  // ── Live Firestore subscription — this user's own posts, newest first.
  // Always the real source of truth; updates automatically the instant a
  // new listing is created (no manual refresh needed). ──
  useEffect(() => {
    if (!uid) { setListings([]); setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const q = fsQuery(
        collection(db, "posts"),
        where("userId", "==", uid),
        orderBy("createdAt", "desc")
      );
      const unsub = onSnapshot(
        q,
        (snap) => {
          setListings(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
          setLoading(false);
        },
        (err) => {
          console.warn("My Listings query failed:", err.message);
          setListings([]);
          setLoading(false);
          setError("Could not load your listings. Check your connection and try again.");
        }
      );
      return unsub;
    } catch (err) {
      setLoading(false);
      setError("Could not connect to your listings.");
    }
  }, [uid]);

  const toggleBoost = (id) => setListings((l) => l.map((x) => x.id === id ? { ...x, isBoosted: !x.isBoosted } : x));

  // ── Delete a listing — client only ever targets this user's own posts
  // (this screen's query is already scoped to userId == uid), and Firestore
  // rules independently enforce the same ownership check server-side, so
  // this can never delete someone else's post even if the client were
  // tampered with. ──
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteErr, setDeleteErr] = useState(null);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteErr(null);
    try {
      await deleteDoc(doc(db, "posts", deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      console.warn("Failed to delete listing:", err.message);
      setDeleteErr("Could not delete this listing. Please try again.");
    } finally {
      setDeleting(false);
    }
  };

  // Normalise a raw Firestore post doc into the exact shape DetailScreen
  // expects — same mapping used by the Home feed and Profile grid.
  const openListingDetail = (l) => {
    if (!onOpenDetail) return;
    onOpenDetail({
      ...l,
      desc:       l.description || l.desc || "",
      aiValue:    l.recommendedPm || l.aiValue || 0,
      karmaScore: l.aiKarmaScore  || l.karmaScore || 0,
      avatar:     l.avatar        || "🧑",
      user:       l.username      || l.userId || "unknown",
      comments:   l.comments      || 0,
    });
  };

  // ── Category counts — Products / Skills / Services / Videos — always
  // derived live from the same Firestore data, 0 when nothing exists yet. ──
  const isSkillCat   = (c) => (c || "").toLowerCase().includes("skill");
  const isServiceCat = (c) => (c || "").toLowerCase().includes("service");
  const skillsCount   = listings.filter((l) => isSkillCat(l.category)).length;
  const servicesCount = listings.filter((l) => isServiceCat(l.category)).length;
  const productsCount = listings.filter((l) => !isSkillCat(l.category) && !isServiceCat(l.category)).length;
  const videosCount   = listings.filter((l) => l.mediaType === "video").length;

  return (
    <div className="kt-scroll">
      <div className="screen-header">
        <button className="back-btn-inline" onClick={onBack}><ChevronLeft size={20} /></button>
        <h2>My Listings</h2>
      </div>
      <div style={{ padding: "0 16px 4px" }}>
        <div className="karma-id-box">
          📦 {productsCount} Products &nbsp;·&nbsp; 🛠️ {skillsCount} Skills &nbsp;·&nbsp; 🧰 {servicesCount} Services &nbsp;·&nbsp; 🎥 {videosCount} Videos
        </div>
      </div>
      <div style={{ padding: "12px 16px 16px" }}>
        {loading && (
          <div className="listings-grid">
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

        {!loading && !error && listings.length === 0 && (
          <div className="empty-state">You haven't created any listings yet. Post your first item, skill, or service to see it here.</div>
        )}

        {!loading && !error && listings.length > 0 && (
          <div className="listings-grid">
            {listings.map((l) => (
              <div key={l.id} className="listings-grid-tile" onClick={() => openListingDetail(l)}>
                <div className="listings-grid-thumb" style={{ background: `linear-gradient(160deg, ${l.color1 || "#bdeede"}, ${l.color2 || "#8fd9bd"})` }}>
                  {(l.thumbnailUrl || l.mediaUrl)
                    ? <img src={l.thumbnailUrl || l.mediaUrl} alt="" />
                    : <span className="listings-grid-emoji">{l.mediaType === "video" ? "🎥" : "🖼️"}</span>}
                  {l.mediaType === "video" && <Video size={13} className="listings-grid-video-badge" />}
                  {l.isBoosted && <span className="listings-grid-boost-badge" title="Boosted">⭐</span>}
                </div>
                <div className="listings-grid-title">{l.title}</div>
                <div className="listings-grid-pm"><Sparkles size={10} /> {(l.recommendedPm || l.aiValue || 0).toLocaleString()} PM</div>
                <div style={{ display: "flex", gap: 6, marginTop: 5 }}>
                  <button
                    className={`listings-grid-boost-pill ${l.isBoosted ? "on" : ""}`}
                    style={{ flex: 1, marginTop: 0 }}
                    onClick={(e) => { e.stopPropagation(); toggleBoost(l.id); }}
                  >
                    <TrendingUp size={11} /> {l.isBoosted ? "Boosted" : "Boost"}
                  </button>
                  <button
                    className="listings-grid-delete-btn"
                    title="Delete listing"
                    onClick={(e) => { e.stopPropagation(); setDeleteErr(null); setDeleteTarget(l); }}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Delete confirmation ── */}
      {deleteTarget && (
        <div className="sheet-backdrop" onClick={(e) => { if (e.target === e.currentTarget && !deleting) setDeleteTarget(null); }}>
          <div className="sheet">
            <div className="sheet-handle" />
            <h3 className="sheet-title">Delete this listing?</h3>
            <p className="sheet-sub">This action cannot be undone.</p>
            {deleteErr && <div className="upload-error" style={{ marginBottom: 12 }}><AlertTriangle size={13} /> {deleteErr}</div>}
            <div style={{ display: "flex", gap: 10 }}>
              <button className="kt-btn ghost" style={{ flex: 1 }} onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</button>
              <button className="kt-btn" style={{ flex: 1, background: "#dc2626", borderColor: "#dc2626" }} onClick={confirmDelete} disabled={deleting}>
                <Trash2 size={15} /> {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

