// ── Extracted from App.jsx: buildTrendSeries, computePlatformAnalytics, mostActive ──
import { seededRandom } from "./aiEngine";
import { PM_POINTS_PACKAGES } from "./paymentEngine";

export function buildTrendSeries(currentTotal, points, seedKey) {
  const rand = seededRandom(seedKey);
  const series = [];
  let value = Math.max(1, Math.round(currentTotal * 0.55));
  for (let i = 0; i < points; i++) {
    const remaining = points - i;
    const target = currentTotal;
    const step = (target - value) / remaining;
    value = Math.max(0, Math.round(value + step + (rand() * 4 - 2)));
    series.push(value);
  }
  series[series.length - 1] = currentTotal; // ensure it lands exactly on the real total
  return series;
}


export function computePlatformAnalytics({ users, feed, transactions, reports, reviews }) {
  const totalUsers = users.length;
  const totalVerified = users.filter((u) => u.verified).length;
  const totalFollowers = users.reduce((sum, u) => sum + (u.followers || 0), 0);
  const totalFollowing = users.reduce((sum, u) => sum + (u.following || 0), 0);
  const totalTrades = users.reduce((sum, u) => sum + (u.trades || 0), 0);

  const products = feed.filter((f) => f.contentType === "product").length;
  const services = feed.filter((f) => f.contentType === "service").length;
  const videos   = feed.filter((f) => f.contentType === "video").length;

  const pointsCirculating = PM_POINTS_PACKAGES.reduce((sum, p) => sum + p.points, 0) * 3; // rough float estimate from packages × avg purchases this session
  const verifiedTxPoints = transactions.filter((t) => t.status === "verified" && t.points).reduce((sum, t) => sum + t.points, 0);

  // Active-user bands simulated as realistic fractions of total registered users
  const dau = Math.round(totalUsers * 0.42);
  const wau = Math.round(totalUsers * 0.71);
  const mau = Math.round(totalUsers * 0.93);

  const avgRating = reviews.length
    ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length)
    : 0;
  const positiveReviews = reviews.filter((r) => r.rating >= 4).length;
  const negativeReviews = reviews.filter((r) => r.rating <= 2).length;

  return {
    totalUsers,
    totalVerified,
    totalFollowers,
    totalFollowing,
    totalTrades,
    products,
    services,
    videos,
    totalContent: products + services + videos,
    pointsCirculating: pointsCirculating + verifiedTxPoints,
    dau, wau, mau,
    newRegistrations: Math.max(1, Math.round(totalUsers * 0.08)),
    avgRating,
    totalRatings: reviews.length,
    positiveReviews,
    negativeReviews,
  };
}


export function mostActive(list, key, n = 5) {
  return [...list].sort((a, b) => (b[key] || 0) - (a[key] || 0)).slice(0, n);
}

