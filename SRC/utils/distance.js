// ── Extracted from App.jsx: formatDistance, haversineDistanceKm, jitterCoord ──

export function jitterCoord(lat, lng, seed) {
  const r = (Math.sin(seed * 999) + 1) / 2; // deterministic pseudo-random 0..1
  const r2 = (Math.cos(seed * 555) + 1) / 2;
  const dLat = (r - 0.5) * 0.09;  // ≈ ±5km
  const dLng = (r2 - 0.5) * 0.09;
  return { lat: lat + dLat, lng: lng + dLng };
}


export function haversineDistanceKm(lat1, lon1, lat2, lon2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371; // Earth radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}


export function formatDistance(km) {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} KM`;
}

