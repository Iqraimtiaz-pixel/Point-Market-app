      
</div>
      {/* â”€â”€ TEMP DEBUG PANEL â€” shows on-screen what previously only went to console â”€â”€ */}
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
        <input className="chat-input" placeholder="Messageâ€¦" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} />
        <button className="send-btn" onClick={send}><Send size={16} /></button>
      </div>
    </div>
  );
}
     
