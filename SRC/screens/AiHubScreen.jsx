// ── Extracted from App.jsx: AiHubScreen ──
import React from "react";
import {
  ChevronLeft,
  Sparkles
} from "lucide-react";
import { MatchCard } from "../components/MatchCard";
import { AI_SUGGESTIONS } from "../utils/mockData";

export function AiHubScreen({ onBack }) {
  return (
    <div className="kt-scroll">
      <div className="screen-header">
        <button className="back-btn-inline" onClick={onBack}><ChevronLeft size={20} /></button>
        <h2>AI Hub</h2>
      </div>
      <div className="ai-banner"><Sparkles size={20} /><div><div className="ai-banner-title">Item unavailable</div><div className="ai-banner-sub">Searched: "iPhone 14" — here's what AI found.</div></div></div>
      <div style={{ padding: "0 16px 16px" }}>
        <div className="section-title">Available Items</div>
        {AI_SUGGESTIONS.available.length === 0 ? (
          <div className="empty-state">No AI suggestions available right now.</div>
        ) : (
          AI_SUGGESTIONS.available.map((s) => <MatchCard key={s.name} item={s} />)
        )}
        <div className="section-title">Similar Items</div>
        {AI_SUGGESTIONS.similar.length === 0 ? (
          <div className="empty-state">No similar items available at the moment.</div>
        ) : (
          AI_SUGGESTIONS.similar.map((s) => <MatchCard key={s.name} item={s} />)
        )}
      </div>
    </div>
  );
}

