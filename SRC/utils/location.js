// ── Extracted from App.jsx: DEFAULT_LOCATION, PAKISTANI_CITIES ──

export const PAKISTANI_CITIES = [
  { name: "Lahore",      lat: 31.5497, lng: 74.3436 },
  { name: "Faisalabad",  lat: 31.4504, lng: 73.1350 },
  { name: "Gujranwala",  lat: 32.1877, lng: 74.1945 },
  { name: "Gujrat",      lat: 32.5731, lng: 74.0789 },
  { name: "Rawalpindi",  lat: 33.5651, lng: 73.0169 },
  { name: "Multan",      lat: 30.1575, lng: 71.5249 },
  { name: "Sialkot",     lat: 32.4945, lng: 74.5229 },
  { name: "Sargodha",    lat: 32.0836, lng: 72.6711 },
  { name: "Bahawalpur",  lat: 29.3956, lng: 71.6722 },
  { name: "Hafizabad",   lat: 32.0712, lng: 73.6877 },
];


export const DEFAULT_LOCATION = (() => {
  const lahore = PAKISTANI_CITIES[0];
  return { city: lahore.name, lat: lahore.lat, lng: lahore.lng };
})();

