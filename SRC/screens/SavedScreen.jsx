// ── Extracted from App.jsx: SavedScreen ──
import React, { useState, useEffect } from "react";
import {
  Bookmark,
  ChevronLeft,
  Sparkles
} from "lucide-react";
import {
  collection,
  query as fsQuery,
  orderBy,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../firebase";

export function SavedScreen({ onBack, onOpenDetail, currentUser }) {
  const [savedPosts, setSavedPosts] = useState([]);

  useEffect(() => {
    if (!currentUser?.uid) return;
    const q = fsQuery(
      collection(db, "users", currentUser.uid, "savedPosts"),
      orderBy("savedAt", "desc")
    );
    const unsub = onSnapshot(q,
      (snap) => { setSavedPosts(snap.docs.map((d) => ({ id: d.id, ...d.data() }))); },
      (err) => { console.warn("SavedScreen listener error:", err.message); }
    );
    return unsub;
  }, [currentUser?.uid]);

  return (
    <div className="kt-scroll">
      <div className="screen-header">
        <button className="back-btn-inline" onClick={onBack}><ChevronLeft size={20} /></button>
        <h2>Saved Items</h2>
      </div>
      <div style={{ padding: "12px 16px 16px" }}>
        {savedPosts.length === 0 ? (
          <div className="empty-state">No saved items yet. Save listings to view them here.</div>
        ) : (
          savedPosts.map((item) => (
            <div key={item.id} className="listing-card" style={{ cursor: "pointer" }} onClick={() => onOpenDetail(item)}>
              <div className="listing-thumb" style={{ background: `linear-gradient(160deg, ${item.color1 || "#bdeede"}, ${item.color2 || "#8fd9bd"})` }}>
                {item.thumbnailUrl
                  ? <img src={item.thumbnailUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 8 }} />
                  : "🎥"}
              </div>
              <div className="listing-info">
                <div className="listing-title">{item.title}</div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span className="ai-row" style={{ fontSize: 12 }}><Sparkles size={11} /> {(item.aiValue || 0).toLocaleString()} PM</span>
                  <span style={{ fontSize: 12, color: "#6f8b80" }}>{item.user}</span>
                </div>
              </div>
              <Bookmark size={18} fill="#22c55e" color="#22c55e" style={{ flexShrink: 0 }} />
            </div>
          ))
        )}
      </div>
    </div>
  );
}

