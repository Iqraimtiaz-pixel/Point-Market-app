// ── Extracted from App.jsx: ChatScreen ──
import React, { useState, useEffect, useRef } from "react";
import {
  ChevronLeft,
  Send,
  Check,
  CheckCheck
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
  increment,
} from "firebase/firestore";
import { db } from "../firebase";
import { isEffectivelyOnline, formatLastSeen } from "../utils/presence";

const TYPING_CLEAR_MS = 3000; // auto-clear "typing" after this long with no keystrokes

export function ChatScreen({ chat, onBack, currentUser }) {
  const [input,    setInput]    = useState("");
  const [messages, setMessages] = useState([]);
  const myUid = currentUser?.uid;
  const otherUid = chat?.otherUid;
  // Deterministic conversation id — same regardless of who opened the chat first.
  const chatId = (myUid && otherUid) ? [myUid, otherUid].sort().join("_") : null;

  // ── Feature 2: other user's presence (users/{otherUid}) ──
  const [otherPresence, setOtherPresence] = useState({ online: false, lastActiveAt: null });
  useEffect(() => {
    if (!otherUid) return;
    const unsub = onSnapshot(doc(db, "users", otherUid),
      (snap) => {
        const d = snap.data() || {};
        setOtherPresence({ online: !!d.online, lastActiveAt: d.lastActiveAt || null });
      },
      (err) => console.warn("Presence listener error:", err.message)
    );
    return unsub;
  }, [otherUid]);

  // ── Feature 3 + 4: parent chat doc — typing flag + read/delivered maps ──
  const [otherTyping,        setOtherTyping]        = useState(false);
  const [otherLastReadAt,    setOtherLastReadAt]     = useState(null);
  const [otherLastDeliveredAt, setOtherLastDeliveredAt] = useState(null);
  useEffect(() => {
    if (!chatId || !otherUid) return;
    const unsub = onSnapshot(doc(db, "chats", chatId),
      (snap) => {
        const d = snap.data() || {};
        setOtherTyping(!!d.typing?.[otherUid]);
        setOtherLastReadAt(d.lastReadAt?.[otherUid] || null);
        setOtherLastDeliveredAt(d.lastDeliveredAt?.[otherUid] || null);
      },
      (err) => console.warn("Chat doc listener error:", err.message)
    );
    return unsub;
  }, [chatId, otherUid]);

  // ── Feature 1 + 4: mark this chat read the moment it's opened —
  // resets my own unread badge and stamps lastReadAt for read-receipt
  // derivation on the sender's side. setDoc+merge (not updateDoc) because
  // the chat doc may not exist yet if nobody has sent a message here yet. ──
  useEffect(() => {
    if (!chatId || !myUid) return;
    setDoc(doc(db, "chats", chatId), {
      unreadCount: { [myUid]: 0 },
      lastReadAt: { [myUid]: serverTimestamp() },
      lastDeliveredAt: { [myUid]: serverTimestamp() }, // opening the chat also implies delivered
    }, { merge: true }).catch((e) => console.warn("Failed to mark chat read:", e.message));
  }, [chatId, myUid]);

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
            createdAtMillis: m.createdAt?.toDate ? m.createdAt.toDate().getTime() : null,
          };
        }));
      },
      (err) => console.warn("Chat listener error:", err.message)
    );
    return unsub;
  }, [chatId, myUid]);

  // ── Feature 3: typing indicator — debounced write, auto-clear after idle ──
  const typingTimeoutRef = useRef(null);
  const isTypingRef = useRef(false);

  const setTypingState = (isTyping) => {
    if (!chatId || !myUid || isTypingRef.current === isTyping) return;
    isTypingRef.current = isTyping;
    setDoc(doc(db, "chats", chatId), { typing: { [myUid]: isTyping } }, { merge: true })
      .catch((e) => console.warn("Failed to update typing state:", e.message));
  };

  const handleInputChange = (e) => {
    setInput(e.target.value);
    if (!chatId || !myUid) return;
    setTypingState(true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => setTypingState(false), TYPING_CLEAR_MS);
  };

  // Clear typing state if the user navigates away mid-type.
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      setTypingState(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId, myUid]);

  const send = async () => {
    const text = input.trim();
    if (!text || !chatId || !myUid) return;
    setInput("");
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    setTypingState(false);
    try {
      // Upsert the parent chat doc (creates it on the very first message).
      // unreadCount increment only ever touches the RECIPIENT's own key —
      // never the sender's — so replying to a chat never silently clears
      // unread messages the sender hasn't actually read themselves.
      await setDoc(doc(db, "chats", chatId), {
        participants: [myUid, otherUid],
        participantInfo: {
          [myUid]:    { user: currentUser.username || currentUser.fullName || "Trader", avatar: currentUser.avatarEmoji || "🧑", avatarUrl: currentUser.avatarUrl || null },
          [otherUid]: { user: chat.user || "Trader", avatar: chat.avatar || "🧑", avatarUrl: chat.avatarUrl || null },
        },
        lastMessage: text,
        updatedAt: serverTimestamp(),
        unreadCount: { [otherUid]: increment(1) },
        typing: { [myUid]: false },
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

  // ── Header status line: Typing... > Online > Last seen ──
  const effectivelyOnline = isEffectivelyOnline(otherPresence.online, otherPresence.lastActiveAt);
  const statusLine = otherTyping
    ? "Typing…"
    : effectivelyOnline
      ? "Online"
      : formatLastSeen(otherPresence.lastActiveAt);

  // ── Feature 4: derive each of my own sent messages' tick state from the
  // other user's lastReadAt / lastDeliveredAt timestamps — no per-message
  // writes needed. ──
  const tickFor = (m) => {
    if (m.from !== "me") return null;
    const readMs      = otherLastReadAt?.toDate ? otherLastReadAt.toDate().getTime() : null;
    const deliveredMs = otherLastDeliveredAt?.toDate ? otherLastDeliveredAt.toDate().getTime() : null;
    if (readMs != null && m.createdAtMillis != null && m.createdAtMillis <= readMs) {
      return <CheckCheck size={13} color="#2563eb" />;               // read — blue double check
    }
    if (deliveredMs != null && m.createdAtMillis != null && m.createdAtMillis <= deliveredMs) {
      return <CheckCheck size={13} color="#6f8b80" />;                // delivered — gray double check
    }
    return <Check size={13} color="#6f8b80" />;                       // sent — single check
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div className="screen-header">
        <button className="back-btn-inline" onClick={onBack}><ChevronLeft size={20} /></button>
        <div className="avatar-sm" style={{ width: 34, height: 34, fontSize: 16, flexShrink: 0 }}>{chat.avatarUrl ? <img src={chat.avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "999px" }} /> : chat.avatar}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ margin: 0 }}>{chat.user}</h2>
          <div style={{ fontSize: 11.5, color: otherTyping ? "#2563eb" : "#6f8b80" }}>{statusLine}</div>
        </div>
      </div>
      <div className="kt-scroll" style={{ paddingTop: 10 }}>
        {messages.length === 0 ? (
          <div className="empty-state" style={{ padding: "18px 16px" }}>No messages yet. Start the conversation below.</div>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={`msg-row ${m.from}`}>
              <div>
                <div className={`msg-bubble ${m.from}`}>{m.text}</div>
                <div style={{ fontSize: 10, color: "#6f8b80", marginTop: 2, display: "flex", alignItems: "center", gap: 4, justifyContent: m.from === "me" ? "flex-end" : "flex-start" }}>
                  {m.time}{tickFor(m)}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      <div className="chat-input-row">
        <input className="chat-input" placeholder="Message…" value={input} onChange={handleInputChange} onKeyDown={(e) => e.key === "Enter" && send()} />
        <button className="send-btn" onClick={send}><Send size={16} /></button>
      </div>
    </div>
  );
}
