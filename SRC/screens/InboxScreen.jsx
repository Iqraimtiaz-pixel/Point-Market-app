// ── Extracted from App.jsx: InboxScreen ──
import React, { useState, useEffect } from "react";
import {
  Search,
  Inbox
} from "lucide-react";
import {
  collection,
  query as fsQuery,
  where,
  orderBy,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../firebase";
import { FindUserModal } from "../components/FindUserModal";

export function InboxScreen({ onOpenChat, currentUser }) {
  const [showFindUser, setShowFindUser] = useState(false);
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);

  // ── Live list of this user's conversations, most-recently-active first.
  // Reading straight from Firestore — this is what makes the inbox survive
  // navigation, refresh, and logging back in later. ──
  useEffect(() => {
    if (!currentUser?.uid) { setChats([]); setLoading(false); return; }
    const q = fsQuery(
      collection(db, "chats"),
      where("participants", "array-contains", currentUser.uid),
      orderBy("updatedAt", "desc")
    );
    const unsub = onSnapshot(q,
      (snap) => {
        const rows = snap.docs.map((d) => {
          const data = d.data();
          const otherUid = (data.participants || []).find((p) => p !== currentUser.uid);
          const info = data.participantInfo?.[otherUid] || {};
          return {
            id: d.id,
            otherUid,
            user: info.user || "Trader",
            avatar: info.avatar || "🧑",
            avatarUrl: info.avatarUrl || null,
            last: data.lastMessage || "",
            time: data.updatedAt?.toDate ? data.updatedAt.toDate().toLocaleDateString() : "",
            unread: 0,
          };
        });
        setChats(rows);
        setLoading(false);
      },
      (err) => { console.warn("Inbox listener error:", err.message); setLoading(false); }
    );
    return unsub;
  }, [currentUser?.uid]);

  return (
    <>
      <div className="screen-header">
        <h2 style={{ flex: 1 }}>Inbox</h2>
        <button className="icon-btn" title="Find trader by ID" onClick={() => setShowFindUser(true)}><Search size={17} /></button>
      </div>
      <div className="kt-scroll">
        {!loading && chats.length === 0 ? (
          <div className="empty-state" style={{ padding: "18px 16px" }}>Your inbox is empty. Start a conversation by finding a trader.</div>
        ) : (
          chats.map((c) => (
            <div key={c.id} className="chat-row" onClick={() => onOpenChat(c)}>
              <div className="avatar-sm" style={{ width: 44, height: 44, fontSize: 20, flexShrink: 0 }}>{c.avatarUrl ? <img src={c.avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "999px" }} /> : c.avatar}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="feed-username">{c.user}</div>
                <div style={{ fontSize: 12.5, color: "#6f8b80", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.last}</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                <span style={{ fontSize: 11, color: "#6f8b80" }}>{c.time}</span>
                {c.unread > 0 && <div className="unread-dot">{c.unread}</div>}
              </div>
            </div>
          ))
        )}
      </div>
      {showFindUser && (
        <FindUserModal onClose={() => setShowFindUser(false)} onOpenChat={(c) => { setShowFindUser(false); onOpenChat(c); }} />
      )}
    </>
  );
}

