// ── Extracted from App.jsx: CommentsSheet ──
import React, { useState } from "react";
import {
  Send
} from "lucide-react";
import { SAMPLE_COMMENTS } from "../utils/mockData";

export function CommentsSheet({ item, onClose }) {
  const [comments, setComments] = useState(SAMPLE_COMMENTS);
  const [input,    setInput]    = useState("");
  const post = () => {
    if (!input.trim()) return;
    setComments([...comments, { user: "@you.trades", avatar: "🧑‍🚀", text: input }]);
    setInput("");
  };
  return (
    <div className="sheet-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet">
        <div className="sheet-handle" />
        <h3 className="sheet-title">Comments</h3>
        <p className="sheet-sub">On: {item.title}</p>
        <div className="comment-list">
          {comments.length === 0 ? (
            <div className="empty-state" style={{ padding: "18px 0" }}>No comments yet. Be the first to leave feedback.</div>
          ) : (
            comments.map((c, i) => (
              <div key={i} className="comment-row">
                <div className="avatar-sm">{c.avatarUrl ? <img src={c.avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "999px" }} /> : c.avatar}</div>
                <div><div className="comment-user">{c.user}</div><div className="comment-text">{c.text}</div></div>
              </div>
            ))
          )}
        </div>
        <div className="chat-input-row">
          <input className="chat-input" placeholder="Add a comment…" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && post()} />
          <button className="send-btn" onClick={post}><Send size={16} /></button>
        </div>
      </div>
    </div>
  );
}

