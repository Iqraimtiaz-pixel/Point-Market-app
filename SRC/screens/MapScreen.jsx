// ── Extracted from App.jsx: MapScreen ──
import React, { useState } from "react";
import {
  User,
  ChevronLeft,
  ChevronRight,
  Handshake,
  MapPin
} from "lucide-react";
import { haversineDistanceKm, formatDistance } from "../utils/distance";
import { FEED } from "../utils/mockData";

export function MapScreen({ onBack, userLocation, onOpenDetail }) {
  const [selected, setSelected] = useState(null);

  const nearby = FEED
    .filter((item) => item.city === userLocation.city)
    .map((item) => ({
      ...item,
      distanceKm: haversineDistanceKm(userLocation.lat, userLocation.lng, item.lat, item.lng),
    }))
    .sort((a, b) => a.distanceKm - b.distanceKm);

  // Project lat/lng to a 0-100% box around the user's position for a simple visual map
  const SPAN = 0.06; // degrees shown edge-to-edge (~6-7km)
  const toPercent = (lat, lng) => {
    const x = 50 + ((lng - userLocation.lng) / SPAN) * 50;
    const y = 50 - ((lat - userLocation.lat) / SPAN) * 50;
    return { x: Math.max(4, Math.min(96, x)), y: Math.max(4, Math.min(96, y)) };
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div className="screen-header">
        <button className="back-btn-inline" onClick={onBack}><ChevronLeft size={20} /></button>
        <h2>Nearby Map</h2>
        <span style={{ marginLeft: "auto", fontSize: 11.5, color: "#6f8b80", display: "flex", alignItems: "center", gap: 4 }}>
          <MapPin size={12} /> {userLocation.city}
        </span>
      </div>

      <div className="map-canvas">
        <div className="map-grid" />
        {/* User's own position, dead center */}
        <div className="map-pin map-pin-self" style={{ left: "50%", top: "50%" }}>
          <div className="map-pin-dot self" />
          <div className="map-pin-pulse" />
        </div>

        {nearby.map((item) => {
          const { x, y } = toPercent(item.lat, item.lng);
          return (
            <div
              key={item.id}
              className={`map-pin ${selected?.id === item.id ? "active" : ""}`}
              style={{ left: `${x}%`, top: `${y}%` }}
              onClick={() => setSelected(item)}
            >
              <div className="map-pin-dot"><Handshake size={11} /></div>
            </div>
          );
        })}
      </div>

      {selected ? (
        <div className="map-detail-card">
          <div className="map-detail-thumb" style={{ background: `linear-gradient(160deg, ${selected.color1}, ${selected.color2})` }}>🎥</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 13.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selected.title}</div>
            <div className="loc-badge-row" style={{ marginTop: 4 }}>
              <span className="loc-badge dist">{selected.distanceKm <= 2 ? "🔥" : "📏"} {formatDistance(selected.distanceKm)}</span>
              <span className="loc-badge karma">⭐ {selected.karmaScore}</span>
            </div>
          </div>
          <button className="kt-btn" style={{ width: "auto", padding: "10px 14px", flexShrink: 0 }} onClick={() => onOpenDetail(selected)}>
            View <ChevronRight size={14} />
          </button>
        </div>
      ) : (
        <div className="map-list">
          {nearby.slice(0, 4).map((item) => (
            <div key={item.id} className="map-list-row" onClick={() => setSelected(item)}>
              <div className="map-list-thumb" style={{ background: `linear-gradient(160deg, ${item.color1}, ${item.color2})` }}>🎥</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 12.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title}</div>
                <div style={{ fontSize: 11, color: "#6f8b80" }}>{item.distanceKm <= 2 ? "🔥 Nearby Trader" : "📍"} · {formatDistance(item.distanceKm)} away</div>
              </div>
              <ChevronRight size={15} color="#6f8b80" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

