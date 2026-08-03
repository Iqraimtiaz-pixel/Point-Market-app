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
  // ── TEMP DEBUG STATE (on-screen debug layer — safe to delete later) ──
  const [debugInfo,  setDebugInfo]  = useState(null);
  const [debugStage, setDebugStage] = useState("");
  const [debugError, setDebugError] = useState(null);
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
    console.log("send() debug:", { text, myUid, otherUid, chatId });
    // ── TEMP DEBUG: snapshot everything relevant, even if we're about to early-return ──
    setDebugInfo({ currentUser, myUid, otherUid, chatId, text });
    setDebugError(null);
    if (!text || !chatId || !myUid) { setDebugStage("EARLY RETURN (missing text/chatId/myUid)"); return; }
    setInput("");
    try {
      // Upsert the parent chat doc (creates it on the very first message)
      console.log("Before setDoc");
      setDebugStage("Before setDoc");
      await setDoc(doc(db, "chats", chatId), {
        participants: [myUid, otherUid],
        participantInfo: {
          [myUid]:    { user: currentUser.username || currentUser.fullName || "Trader", avatar: currentUser.avatarEmoji || "🧑", avatarUrl: currentUser.avatarUrl || null },
          [otherUid]: { user: chat.user || "Trader", avatar: chat.avatar || "🧑", avatarUrl: chat.avatarUrl || null },
        },
        lastMessage: text,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      console.log("After setDoc");
      setDebugStage("After setDoc");
      // Then append the actual message
      await addDoc(collection(db, "chats", chatId, "messages"), {
        from: myUid,
        text,
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      console.error("SEND ERROR:", err);
      // ── TEMP DEBUG: surface the complete Firebase error on-screen ──
      setDebugStage("ERROR");
      setDebugError({
        code: err?.code ?? "(no code)",
        message: err?.message ?? String(err),
        name: err?.name ?? "(no name)",
        plainStringify: (() => { try { return JSON.stringify(err); } catch (e) { return "JSON.stringify(error) failed: " + e.message; } })(),
        full: (() => { try { return JSON.stringify(err, Object.getOwnPropertyNames(err), 2); } catch { return String(err); } })(),
      });
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* ── TEMP DEBUG BANNER — confirms this file is the one actually deployed ── */}
      <div style={{ background: "#ff0000", color: "#fff", fontWeight: 900, textAlign: "center", padding: "6px 4px", fontSize: 13, letterSpacing: 1, fontFamily: "monospace" }}>
        DEBUG VERSION ACTIVE
      </div>
      <div className="screen-header">
        <button className="back-btn-inline" onClick={onBack}><ChevronLeft size={20} /></button>
        <div className="avatar-sm" style={{ width: 34, height: 34, fontSize: 16, flexShrink: 0 }}>{chat.avatarUrl ? <img src={chat.avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "999px" }} /> : chat.avatar}</div>
        <h2>{chat.user}</h2>
      </div>
      {/* ── TEMP DEBUG PANEL — shows on-screen what previously only went to console ── */}
      {(debugInfo || debugStage || debugError) && (
        <div style={{ background: "#111", color: "#0f0", fontFamily: "monospace", fontSize: 11, padding: 10, maxHeight: 260, overflowY: "auto", whiteSpace: "pre-wrap", wordBreak: "break-word", borderBottom: "3px solid #ff0000" }}>
          <div style={{ color: "#0ff", fontWeight: 700, marginBottom: 4 }}>DEBUG STAGE: {debugStage || "(idle)"}</div>
          {debugInfo && (
            <div style={{ marginBottom: 6 }}>
              <div style={{ color: "#ff0" }}>currentUser:</div>
              <div>{(() => { try { return JSON.stringify(debugInfo.currentUser, null, 2); } catch { return String(debugInfo.currentUser); } })()}</div>
              <div style={{ color: "#ff0", marginTop: 4 }}>myUid: <span style={{ color: "#fff" }}>{String(debugInfo.myUid)}</span></div>
              <div style={{ color: "#ff0" }}>otherUid: <span style={{ color: "#fff" }}>{String(debugInfo.otherUid)}</span></div>
              <div style={{ color: "#ff0" }}>chatId: <span style={{ color: "#fff" }}>{String(debugInfo.chatId)}</span></div>
              <div style={{ color: "#ff0" }}>message text: <span style={{ color: "#fff" }}>{String(debugInfo.text)}</span></div>
            </div>
          )}
          {debugError && (
            <div style={{ color: "#f66", borderTop: "1px solid #f66", paddingTop: 6, marginTop: 6 }}>
              <div>Firebase error code: {debugError.code}</div>
              <div>Firebase error message: {debugError.message}</div>
              <div>Firebase error name: {debugError.name}</div>
              <div style={{ marginTop: 4 }}>JSON.stringify(error):</div>
              <div>{debugError.plainStringify}</div>
              <div style={{ marginTop: 4 }}>Full error details:</div>
              <div>{debugError.full}</div>
            </div>
          )}
        </div>
      )}
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

