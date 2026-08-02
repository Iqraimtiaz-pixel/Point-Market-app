// ── Extracted from App.jsx: LocationScreen ──
import React, { useState } from "react";
import {
  CheckCircle2,
  ChevronRight,
  AlertTriangle,
  MapPin,
  Navigation,
  Crosshair,
  Compass
} from "lucide-react";
import { ProgressBar } from "../components/ProgressBar";
import { PAKISTANI_CITIES } from "../utils/location";

export function LocationScreen({ onDone }) {
  const [selectedCity, setSelectedCity] = useState(null);
  const [gpsState,     setGpsState]     = useState("idle"); // idle | requesting | granted | denied
  const [coords,       setCoords]       = useState(null);

  const requestGps = () => {
    setGpsState("requesting");
    if (!navigator.geolocation) {
      // Fallback: use the selected city's center coordinates
      const c = PAKISTANI_CITIES.find((c) => c.name === selectedCity);
      setCoords({ lat: c.lat, lng: c.lng });
      setGpsState("granted");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGpsState("granted");
      },
      () => {
        // Permission denied — fall back to city center so the app still works
        const c = PAKISTANI_CITIES.find((c) => c.name === selectedCity);
        setCoords({ lat: c.lat, lng: c.lng });
        setGpsState("denied");
      },
      { enableHighAccuracy: true, timeout: 6000 }
    );
  };

  const finish = () => {
    const city = PAKISTANI_CITIES.find((c) => c.name === selectedCity);
    onDone({
      city: selectedCity,
      lat: coords?.lat ?? city.lat,
      lng: coords?.lng ?? city.lng,
    });
  };

  return (
    <div className="kt-scroll">
      <ProgressBar current="location" />

      <div className="screen-pad">
        <div className="eyebrow"><MapPin size={13} /> Step 4 of 5 · Set Your Location</div>
        <h1 className="screen-h1">Where are you trading from?</h1>
        <p className="screen-sub">We use your city and GPS location to show you the closest, most relevant trades near you.</p>

        <div className="field-label" style={{ marginBottom: 10 }}>Select your city</div>
        <div className="city-grid">
          {PAKISTANI_CITIES.map((c) => (
            <div
              key={c.name}
              className={`city-chip ${selectedCity === c.name ? "selected" : ""}`}
              onClick={() => { setSelectedCity(c.name); setGpsState("idle"); setCoords(null); }}
            >
              <MapPin size={13} /> {c.name}
            </div>
          ))}
        </div>

        {selectedCity && (
          <div className="gps-card">
            {gpsState === "idle" && (
              <>
                <div className="gps-icon"><Crosshair size={20} /></div>
                <div className="gps-text">
                  <div className="gps-title">Enable precise location</div>
                  <div className="gps-sub">Allow GPS access so we can rank trades by exact distance within {selectedCity}.</div>
                </div>
                <button className="kt-btn primary" style={{ marginTop: 12 }} onClick={requestGps}>
                  <Navigation size={15} /> Allow GPS access
                </button>
              </>
            )}
            {gpsState === "requesting" && (
              <div className="gps-loading"><Compass size={18} className="spin" /> Requesting location…</div>
            )}
            {gpsState === "granted" && (
              <div className="gps-success">
                <CheckCircle2 size={18} color="#3b82f6" />
                <div>
                  <div className="gps-title">Location enabled</div>
                  <div className="gps-sub">Lat {coords?.lat.toFixed(4)}, Lng {coords?.lng.toFixed(4)}</div>
                </div>
              </div>
            )}
            {gpsState === "denied" && (
              <div className="gps-warning">
                <AlertTriangle size={18} color="#f87171" />
                <div>
                  <div className="gps-title">GPS permission denied</div>
                  <div className="gps-sub">No problem — we'll use {selectedCity}'s city center instead. You can enable precise GPS anytime from Settings.</div>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="hint-row" style={{ marginTop: 18 }}>
          <MapPin size={13} />
          <span>You can update your city or GPS location later anytime from Profile → Settings → Location.</span>
        </div>

        <button
          className="kt-btn primary"
          disabled={!selectedCity || gpsState === "requesting"}
          style={(!selectedCity || gpsState === "requesting") ? { opacity: 0.4 } : {}}
          onClick={finish}
        >
          Continue <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

