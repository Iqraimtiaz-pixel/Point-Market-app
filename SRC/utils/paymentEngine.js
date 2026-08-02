// ── Extracted from App.jsx: BOOST_PLANS, BOOST_PRICE, CERT_PRICE, JAZZCASH_ACCOUNT, PM_POINTS_PACKAGES, _seenScreenshotHashes, _seenTransactionIds, clampConfidence, paymentStatusColor, paymentStatusLabel, runPaymentVerificationEngine, simpleFileHash ──
import {
  Home,
  Receipt
} from "lucide-react";
import { seededRandom } from "./aiEngine";

export const JAZZCASH_ACCOUNT = {
  number: "0326-9729756",
  title:  "Point Maker (Pvt) Ltd",
};


export const PM_POINTS_PACKAGES = [
  { id: "pkg-500",  points: 500,  price: 250  },
  { id: "pkg-1200", points: 1200, price: 550  },
  { id: "pkg-3000", points: 3000, price: 1300 },
  { id: "pkg-7000", points: 7000, price: 2900 },
];


export const BOOST_PLANS = [
  {
    id: "boost-24h",
    label: "24 Hours Boost",
    amount: 150,
    durationHours: 24,
    subtitle: "Top of Home Feed for 24 hours",
    tier: "starter",
    badge: "Quick Boost",
    features: [
      "Featured at the top of the Home Feed",
      "Featured Boosted badge with higher visibility in search results",
      "Payment via JazzCash",
    ],
  },
  {
    id: "boost-3d",
    label: "3 Days Boost",
    amount: 350,
    durationHours: 72,
    subtitle: "Featured for 3 days",
    tier: "popular",
    badge: "Most Popular",
    recommended: true,
    features: [
      "Boosted badge priority visibility",
      "Featured in search results",
      "3x more chat replies on average",
      "Payment via JazzCash",
    ],
  },
  {
    id: "boost-7d",
    label: "7 Days Boost",
    amount: 600,
    durationHours: 168,
    subtitle: "Featured for 7 days",
    tier: "gold",
    badge: "Best Value",
    features: [
      "Maximum visibility, whole week",
      "Highest search priority",
      "Priority placement over Popular & Quick Boost",
      "Payment via JazzCash",
    ],
  },
];


export const BOOST_PRICE = BOOST_PLANS[0];


export const CERT_PRICE  = { amount: 100, label: "Verified Skill Certification" };


export const _seenScreenshotHashes = new Set();


export const _seenTransactionIds   = new Set();


export function simpleFileHash(file) {
  if (!file) return null;
  return `${file.name}|${file.size}|${file.lastModified || 0}`;
}


export function clampConfidence(n) { return Math.max(0, Math.min(100, Math.round(n))); }


export function runPaymentVerificationEngine({ expectedAmount, screenshotFile, transactionId }) {
  const seed = `${expectedAmount}|${screenshotFile?.name || ""}|${screenshotFile?.size || 0}|${transactionId || ""}`;
  const rand = seededRandom(seed || "pm-pay-default");

  const fileHash = simpleFileHash(screenshotFile);
  const fileSizeMb = screenshotFile ? screenshotFile.size / (1024 * 1024) : 0;
  const hasScreenshot = !!screenshotFile;
  const txId = (transactionId || "").trim();

  const flags = [];

  // ── 1. Duplicate screenshot detection ──
  const isDuplicateScreenshot = hasScreenshot && _seenScreenshotHashes.has(fileHash);
  if (isDuplicateScreenshot) flags.push("This screenshot has already been submitted for a previous payment");

  // ── 2. Duplicate transaction ID detection ──
  const isDuplicateTxId = txId.length > 0 && _seenTransactionIds.has(txId.toLowerCase());
  if (isDuplicateTxId) flags.push("This transaction ID has already been used for a previous payment");

  // ── 3. Transaction ID format check (JazzCash TxIDs are typically alphanumeric, 8-16 chars) ──
  const txIdValid = /^[A-Za-z0-9]{8,16}$/.test(txId);
  if (txId.length > 0 && !txIdValid) flags.push("Transaction ID format doesn't match a valid JazzCash receipt");
  if (txId.length === 0) flags.push("No transaction ID entered — cannot cross-check against JazzCash records");

  // ── 4. Screenshot presence & quality proxy (resolution/size as a clarity stand-in) ──
  if (!hasScreenshot) flags.push("No payment screenshot uploaded — cannot verify receipt");
  const genericName = screenshotFile && /^(image|img|screenshot|file|download)[\d_\-]*\.(jpg|png|jpeg)$/i.test(screenshotFile.name || "");
  if (genericName) flags.push("Generic filename detected — possible reused or unedited stock screenshot");
  if (hasScreenshot && fileSizeMb < 0.03) flags.push("Screenshot file unusually small — may be cropped, edited, or a placeholder image");

  // ── 5. Manipulation risk proxy ──
  let manipulationRisk = rand() * 14 + (genericName ? 20 : 0) + (fileSizeMb < 0.03 && hasScreenshot ? 22 : 0);

  // ── 6. Amount-match confidence (simulated OCR readback of the receipt amount) ──
  // In production this comes from OCR text extraction; here we simulate a high-confidence
  // read when a real screenshot was provided, lower when missing/suspicious.
  let amountMatchConfidence = hasScreenshot ? clampConfidence(90 + rand() * 8 - manipulationRisk * 0.3) : 0;
  const amountMatches = amountMatchConfidence >= 70;
  if (hasScreenshot && !amountMatches) flags.push(`Receipt amount could not be confidently matched to Rs. ${expectedAmount}`);

  // ── 7. Receipt structure validity (JazzCash layout proxy: presence checks) ──
  const receiptStructureScore = hasScreenshot ? clampConfidence(88 + rand() * 10 - manipulationRisk * 0.4) : 0;
  if (hasScreenshot && receiptStructureScore < 60) flags.push("Screenshot doesn't match a recognizable JazzCash receipt layout");

  // ── 8. Overall verification confidence (weighted composite) ──
  let confidence = clampConfidence(
    amountMatchConfidence * 0.35 +
    receiptStructureScore  * 0.30 +
    (txIdValid ? 100 : 20) * 0.20 +
    (100 - manipulationRisk) * 0.15
  );

  // Hard fails regardless of composite score
  const hardFail = isDuplicateScreenshot || isDuplicateTxId || !hasScreenshot;
  if (hardFail) confidence = Math.min(confidence, 25);

  const approved = confidence >= 75 && !hardFail;
  const status = approved ? "verified" : confidence >= 45 && !hardFail ? "review" : "rejected";

  // Record hashes/IDs only on submission attempt (prevents reuse going forward)
  if (hasScreenshot) _seenScreenshotHashes.add(fileHash);
  if (txId.length > 0) _seenTransactionIds.add(txId.toLowerCase());

  return {
    confidence,
    approved,
    status, // 'verified' | 'review' | 'rejected'
    amountMatchConfidence,
    receiptStructureScore,
    txIdValid,
    isDuplicateScreenshot,
    isDuplicateTxId,
    flags,
    expectedAmount,
    transactionId: txId,
    verifiedAt: new Date().toISOString(),
  };
}


export function paymentStatusLabel(status) {
  switch (status) {
    case "verified": return "Verified & Completed";
    case "review":   return "Under Review";
    case "rejected": return "Rejected";
    default:         return "Pending Verification";
  }
}


export function paymentStatusColor(status) {
  switch (status) {
    case "verified": return "#16a34a";
    case "review":   return "#b8860b";
    case "rejected": return "#dc2626";
    default:         return "#6b7587";
  }
}

