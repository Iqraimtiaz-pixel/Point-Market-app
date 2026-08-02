// ── Extracted from App.jsx: ChatScreen ──
import React, { useState, useEffect } from "react";
import {
  ChevronLeft,
  Send
} from "lucide-react";
import {
  doc,
  setDoc,
  addDoc,
  collection,
  query as fsQuery,
  orderBy,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";

export function ChatScreen({ chat, onBack, currentUser }) {
  const [input,    setInput]    = useState("");
  const [messages, setMessages] = useState([]);
  const myUid = currentUser?.uid;
  const otherUid = chat?.otherUid;
  // Deterministic conversation id — same regardless of who opened the chat first.
  const chatId = (myUid && otherUid) ? [myUid, otherUid].sort().join("_") : null;

  // ── Live message history for this conversation ──
  useEffect(() => {
    if (!chatId) { setMessages([]); return; }
    const q = fsQuery(collection(db, "chats", chatId, "messages"), orderBy("createdAt", "asc"));
    const unsub = onSnapshot(q,
      (snap) => {
        setMessages(snap.docs.map((d) => {
          const m = d.data();
          return {
            from: m.from === myUid ? "me" : "them",
            text: m.text,
            time: m.createdAt?.toDate ? m.createdAt.toDate().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "…",
          };
        }));
      },
      (err) => console.warn("Chat listener error:", err.message)
    );
    return unsub;
  }, [chatId, myUid]);

  const send = async () => {
    const text = input.trim();
    if (!text || !chatId || !myUid) return;
    setInput("");
    try {
      // Upsert the parent chat doc (creates it on the very first message)
      await setDoc(doc(db, "chats", chatId), {
        participants: [myUid, otherUid],
        participantInfo: {
          [myUid]:    { user: currentUser.username || currentUser.fullName || "Trader", avatar: currentUser.avatarEmoji || "🧑", avatarUrl: currentUser.avatarUrl || null },
          [otherUid]: { user: chat.user || "Trader", avatar: chat.avatar || "🧑", avatarUrl: chat.avatarUrl || null },
        },
        lastMessage: text,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      // Then append the actual message
      await addDoc(collection(db, "chats", chatId, "messages"), {
        from: myUid,
        text,
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      console.warn("Failed to send message:", err.message);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div className="screen-header">
        <button className="back-btn-inline" onClick={onBack}><ChevronLeft size={20} /></button>
        <div className="avatar-sm" style={{ width: 34, height: 34, fontSize: 16, flexShrink: 0 }}>{chat.avatarUrl ? <img src={chat.avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "999px" }} /> : chat.avatar}</div>
        <h2>{chat.user}</h2>
      </div>
      <div className="kt-scroll" style={{ paddingTop: 10 }}>
        {messages.length === 0 ? (
          <div className="empty-state" style={{ padding: "18px 16px" }}>No messages yet. Start the conversation below.</div>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={`msg-row ${m.from}`}>
              <div>
                <div className={`msg-bubble ${m.from}`}>{m.text}</div>
                <div style={{ fontSize: 10, color: "#6f8b80", marginTop: 2, textAlign: m.from === "me" ? "right" : "left" }}>{m.time}</div>
              </div>
            </div>
          ))
        )}
      </div>
      <div className="chat-input-row">
        <input className="chat-input" placeholder="Message…" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} />
        <button className="send-btn" onClick={send}><Send size={16} /></button>
      </div>
    </div>
  );
}

