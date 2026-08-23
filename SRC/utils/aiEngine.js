// ── Extracted from App.jsx: CATEGORY_VALUE_INDEX, KARMA_WEIGHTS, categoryValueFor, clampScore, karmaBandLabel, runAiAuthenticityEngine, seededRandom ──
import {
  Video
} from "lucide-react";

export const KARMA_WEIGHTS = {
  authenticity: 0.30,
  condition:    0.25,
  contentQuality: 0.20,
  categoryValue: 0.15,
  completeness:  0.10,
};


export const CATEGORY_VALUE_INDEX = {
  electronics: 88, fashion: 62, furniture: 70, books: 40,
  skills: 75, services: 72, vehicles: 95, sports: 58,
  appliances: 80, default: 55,
};


export function clampScore(n) { return Math.max(0, Math.min(100, Math.round(n))); }


export function seededRandom(seedStr) {
  let h = 0;
  for (let i = 0; i < seedStr.length; i++) { h = (h << 5) - h + seedStr.charCodeAt(i); h |= 0; }
  return () => {
    h = (h * 1103515245 + 12345) & 0x7fffffff;
    return (h % 1000) / 1000;
  };
}


export function categoryValueFor(category) {
  const key = (category || "").trim().toLowerCase();
  for (const k of Object.keys(CATEGORY_VALUE_INDEX)) {
    if (key.includes(k)) return CATEGORY_VALUE_INDEX[k];
  }
  return CATEGORY_VALUE_INDEX.default;
}


export function runAiAuthenticityEngine({ title, desc, category, mediaFile, isVideo, aiValue }) {
  const seed = `${title}|${desc}|${category}|${mediaFile?.name || ""}|${mediaFile?.size || 0}`;
  const rand = seededRandom(seed || "kt-default");

  const titleLen = (title || "").trim().length;
  const descLen  = (desc  || "").trim().length;
  const hasMedia = !!mediaFile;
  const fileSizeMb = mediaFile ? mediaFile.size / (1024 * 1024) : 0;

  // ── 1 & 2 & 3: Content / Video / Image analysis proxies ──
  // Clarity proxy: larger, well-formed files score higher (simulates resolution/bitrate check)
  let clarity = hasMedia ? 60 + Math.min(30, fileSizeMb * 4) : 25;
  clarity += rand() * 10;

  // Manipulation / duplicate-content risk: small deterministic noise,
  // flagged higher if filename looks generic/stocky or file is suspiciously tiny
  const genericName = mediaFile && /^(image|img|video|vid|file|download)[\d_\-]*\.(jpg|png|mp4|jpeg|mov)$/i.test(mediaFile.name || "");
  let manipulationRisk = rand() * 18 + (genericName ? 22 : 0) + (fileSizeMb < 0.05 && hasMedia ? 25 : 0);

  // Title/description ↔ media relevance proxy (keyword overlap heuristic)
  const titleWords = new Set((title || "").toLowerCase().split(/\W+/).filter(Boolean));
  const descWords  = new Set((desc  || "").toLowerCase().split(/\W+/).filter(Boolean));
  const overlap = [...titleWords].filter((w) => descWords.has(w)).length;
  const relevanceBonus = Math.min(15, overlap * 4);

  let authenticity = clampScore(78 + relevanceBonus - manipulationRisk + (hasMedia ? 6 : -20));
  let videoAuthenticity = isVideo ? clampScore(authenticity + (rand() * 6 - 3)) : null;
  let imageAuthenticity  = !isVideo && hasMedia ? clampScore(authenticity + (rand() * 6 - 3)) : null;

  // ── Condition score (image-led: damage/wear proxy from description keywords) ──
  const descLower = (desc || "").toLowerCase();
  const damageWords = ["scratch", "crack", "damage", "stain", "broken", "worn", "torn", "dent", "faded"];
  const goodWords = ["new", "mint", "excellent", "like new", "barely used", "sealed", "unused"];
  let condition = 80;
  damageWords.forEach((w) => { if (descLower.includes(w)) condition -= 12; });
  goodWords.forEach((w) => { if (descLower.includes(w)) condition += 6; });
  condition = clampScore(condition + (rand() * 10 - 5) + (hasMedia ? 4 : -10));

  // ── Content quality (production proxy: clarity + completeness of media) ──
  const contentQuality = clampScore(clarity - manipulationRisk * 0.4 + (hasMedia ? 8 : -25));

  // ── Category value index (0-100 normalized market-demand weight) ──
  const categoryValue = categoryValueFor(category);

  // ── Listing completeness ──
  let completeness = 0;
  if (titleLen >= 3)  completeness += 25;
  if (descLen  >= 15) completeness += 30;
  if ((category || "").trim().length >= 2) completeness += 20;
  if (hasMedia) completeness += 25;
  completeness = clampScore(completeness);

  // ── Trust signals (composite for fraud flagging) ──
  const trustScore = clampScore(
    authenticity * 0.45 + condition * 0.25 + completeness * 0.30 - manipulationRisk * 0.3
  );

  // ── Final weighted Karma Score ──
  const finalScore = clampScore(
    authenticity   * KARMA_WEIGHTS.authenticity +
    condition      * KARMA_WEIGHTS.condition +
    contentQuality * KARMA_WEIGHTS.contentQuality +
    categoryValue  * KARMA_WEIGHTS.categoryValue +
    completeness   * KARMA_WEIGHTS.completeness
  );

  // ── Fraud / suspicious-content detection ──
  const flags = [];
  if (manipulationRisk > 28) flags.push("Possible manipulated or AI-generated media detected");
  if (genericName) flags.push("Generic/stock-style filename — possible reused content");
  if (!hasMedia) flags.push("No media uploaded — cannot verify authenticity");
  if (descLen < 10) flags.push("Description too short to verify realistic claims");
  if (overlap === 0 && titleLen > 0 && descLen > 0) flags.push("Title and description don't clearly match — review for accuracy");
  if (fileSizeMb < 0.05 && hasMedia) flags.push("Media file unusually small — possible low-effort or placeholder upload");

  // Stronger review trigger when obvious manipulation or suspicious flags exist
  const isSuspicious = manipulationRisk > 28 || genericName || (fileSizeMb < 0.05 && hasMedia) || flags.length >= 2;
  const needsReview = finalScore < 30 || isSuspicious || flags.length >= 3;

  // Map AI finalScore (0-100) to PM points per product rules
  let recommendedKp = 0;
  if (finalScore >= 95) recommendedKp = 25;
  else if (finalScore >= 90) recommendedKp = 20;
  else if (finalScore >= 80) recommendedKp = 15;
  else if (finalScore >= 70) recommendedKp = 10;
  else if (finalScore >= 60) recommendedKp = 5;
  else recommendedKp = 0;
  // If listing needs review, halve the awarded PM points (conservative)
  if (needsReview) recommendedKp = Math.round(recommendedKp * 0.5);
  recommendedKp = clampScore(recommendedKp);

  // ── AI Trust Badges ──
  const badges = [];
  if (authenticity >= 85) badges.push({ label: "AI Verified", icon: "shield" });
  if (trustScore >= 80 && !needsReview) badges.push({ label: "Trusted Listing", icon: "check" });
  if (condition >= 85) badges.push({ label: "Excellent Condition", icon: "sparkle" });
  if (authenticity >= 90) badges.push({ label: "High Authenticity", icon: "award" });
  if (finalScore >= 80 && completeness >= 80) badges.push({ label: "Community Recommended", icon: "users" });

  return {
    authenticity,
    videoAuthenticity,
    imageAuthenticity,
    condition,
    contentQuality,
    categoryValue,
    completeness,
    trustScore,
    finalScore,
    recommendedKp,
    isSuspicious,
    isOriginal: !isSuspicious && flags.length === 0,
    badges,
    flags,
    needsReview,
    isVideo,
  };
}


export function karmaBandLabel(score) {
  if (score >= 90) return "Excellent";
  if (score >= 70) return "Good";
  if (score >= 50) return "Fair";
  if (score >= 30) return "Low";
  return "Flagged for Review";
}

// ── Skill/Service Karma — completely separate from runAiAuthenticityEngine
// and from Product's price × 0.2 formula. Duration is the main factor;
// quality adjustment is an HONEST heuristic built only from data that
// already exists elsewhere in this codebase (title/description length,
// the existing AI authenticity score) — this is NOT real video or audio
// content analysis, and none is claimed. No such capability exists in
// this project. Returns null when the video is outside the accepted
// 15s–5min range (caller is responsible for rejecting before upload
// completes). Result is always clamped to 5–80 KP, never NaN/undefined/
// negative for a valid duration. ──
export function evaluateSkillKarma({ videoDuration, title, desc, authenticityScore }) {
  const dur = Number(videoDuration);
  if (!Number.isFinite(dur) || dur < 15 || dur > 300) return null;

  let base;
  if (dur <= 30)  base = 10;
  else if (dur <= 60)  base = 20;
  else if (dur <= 120) base = 35;
  else if (dur <= 180) base = 50;
  else if (dur <= 240) base = 65;
  else                 base = 80; // dur <= 300, checked above

  // Heuristic quality signal (0-100), built only from existing signals —
  // title/description length as a proxy for how much real explanation was
  // given, blended with the AI authenticity score already computed for
  // every listing via runAiAuthenticityEngine (report.finalScore).
  const titleLen = (title || "").trim().length;
  const descLen  = (desc  || "").trim().length;
  let qualitySignal = 50; // neutral midpoint
  if (titleLen >= 8)   qualitySignal += 10;
  if (descLen  >= 40)  qualitySignal += 15;
  if (descLen  >= 100) qualitySignal += 10;
  if (typeof authenticityScore === "number") {
    qualitySignal = (qualitySignal + authenticityScore) / 2;
  }
  qualitySignal = Math.max(0, Math.min(100, qualitySignal));

  // Low quality → ~50% of base, Normal → 100%, High → ~125%
  let multiplier = 1;
  if (qualitySignal < 40) multiplier = 0.5;
  else if (qualitySignal >= 75) multiplier = 1.25;

  let finalKp = Math.round(base * multiplier);
  finalKp = Math.max(5, Math.min(80, finalKp)); // hard cap: never below 5 for a valid listing, never above 80
  return finalKp;
}

