// ── Extracted from App.jsx: UpdateLocationSheet ──
import React, { useState } from "react";
import {
  CheckCircle2,
  MapPin,
  Navigation
} from "lucide-react";
import { PAKISTANI_CITIES } from "../utils/location";

export function UpdateLocationSheet({ currentLocation, onSave, onClose }) {
  const [city, setCity] = useState(currentLocation?.city || PAKISTANI_CITIES[0].name);
  const [completeAddress, setCompleteAddress] = useState(currentLocation?.completeAddress || "");
  const [gpsState, setGpsState] = useState("idle"); // idle | requesting | granted | denied
  const [coords, setCoords] = useState(currentLocation ? { lat: currentLocation.lat, lng: currentLocation.lng } : null);

  const requestGps = () => {
    setGpsState("requesting");
    const fallback = PAKISTANI_CITIES.find((c) => c.name === city);
    if (!navigator.geolocation) {
      setCoords({ lat: fallback.lat, lng: fallback.lng });
      setGpsState("granted");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => { setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setGpsState("granted"); },
      () => { setCoords({ lat: fallback.lat, lng: fallback.lng }); setGpsState("denied"); },
      { enableHighAccuracy: true, timeout: 6000 }
    );
  };

  const save = () => {
    const c = PAKISTANI_CITIES.find((c) => c.name === city);
    onSave({ city, completeAddress: completeAddress.trim(), lat: coords?.lat ?? c.lat, lng: coords?.lng ?? c.lng });
  };

  return (
    <div className="sheet-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet">
        <div className="sheet-handle" />
        <h3 className="sheet-title">Update Location</h3>
        <p className="sheet-sub">Change your city or refresh your GPS position to improve nearby matches.</p>

        <div className="field-label" style={{ marginBottom: 8 }}>City</div>
        <div className="city-grid-light">
          {PAKISTANI_CITIES.map((c) => (
            <div key={c.name} className={`city-chip-light ${city === c.name ? "selected" : ""}`} onClick={() => { setCity(c.name); setGpsState("idle"); setCoords(null); }}>
              <MapPin size={12} /> {c.name}
            </div>
          ))}
        </div>

        <div className="field-label" style={{ marginBottom: 8, marginTop: 14 }}>Complete address</div>
        <input
          className="field-input"
          placeholder="House / Street / Area / Block"
          value={completeAddress}
          onChange={(e) => setCompleteAddress(e.target.value)}
          style={{ marginBottom: 14 }}
        />

        <button className="kt-btn ghost" style={{ marginBottom: 14 }} onClick={requestGps}>
          <Navigation size={15} /> {gpsState === "granted" ? "Refresh GPS position" : "Use my current GPS position"}
        </button>

        {gpsState === "requesting" && <div className="empty-state" style={{ padding: "0 0 14px" }}>Requesting location…</div>}
        {gpsState === "granted" && coords && (
          <div className="confirm-box">
            <div className="confirm-row"><span>Latitude</span><b>{coords.lat.toFixed(4)}</b></div>
            <div className="confirm-row"><span>Longitude</span><b>{coords.lng.toFixed(4)}</b></div>
          </div>
        )}
        {gpsState === "denied" && <div className="empty-state" style={{ padding: "0 0 14px" }}>GPS denied — using {city} city center instead.</div>}

        <button className="kt-btn" onClick={save}><CheckCircle2 size={16} /> Save location</button>
      </div>
    </div>
  );
}

