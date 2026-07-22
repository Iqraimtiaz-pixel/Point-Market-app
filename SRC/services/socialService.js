// =============================================================================
//  services/socialService.js  ·  Point Market — Users, Trades, Reviews,
//  Reports, Follow System, Device Fingerprinting, Admin User Management
//
//  Listings/marketplace logic lives in marketplace.js (do not duplicate here).
//  Points/payments logic lives in pointsEngine.js (do not duplicate here).
// =============================================================================

import { db } from "../firebase";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  collection,
  serverTimestamp,
  increment,
  arrayUnion,
  arrayRemove,
  onSnapshot,
} from "firebase/firestore";

export const SOCIAL_COL = {
  USERS:    "users",
  TRADES:   "trades",
  REVIEWS:  "reviews",
  REPORTS:  "reports",
  DEVICE_FP:"device_fingerprints",
};

// ─────────────────────────────────────────────────────────────────────────────
//  USERS
// ─────────────────────────────────────────────────────────────────────────────

/** Fetch a single user document by uid. */
export async function getUser(uid) {
  const snap = await getDoc(doc(db, SOCIAL_COL.USERS, uid));
  return snap.exists() ? snap.data() : null;
}

/** Fetch a user by exact username (for PM Space / public profiles). */
export async function getUserByUsername(username) {
  const q = query(
    collection(db, SOCIAL_COL.USERS),
    where("username", "==", username),
    limit(1)
  );
  const snap = await getDocs(q);
  return snap.empty ? null : snap.docs[0].data();
}

/** Search users by username prefix (for Find a Trader). */
export async function searchUsers(queryStr, pageSize = 10) {
  const q = query(
    collection(db, SOCIAL_COL.USERS),
    where("username", ">=", queryStr),
    where("username", "<=", queryStr + "\uf8ff"),
    orderBy("username"),
    limit(pageSize)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data());
}

/** Follow / unfollow another user (mutual arrayUnion/Remove on both docs). */
export async function toggleFollow(currentUid, targetUid, isFollowing) {
  const currentRef = doc(db, SOCIAL_COL.USERS, currentUid);
  const targetRef  = doc(db, SOCIAL_COL.USERS, targetUid);
  if (isFollowing) {
    await updateDoc(currentRef, { following: arrayRemove(targetUid) });
    await updateDoc(targetRef,  { followers: arrayRemove(currentUid) });
  } else {
    await updateDoc(currentRef, { following: arrayUnion(targetUid) });
    await updateDoc(targetRef,  { followers: arrayUnion(currentUid) });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  DEVICE FINGERPRINT  (Sybil / multi-account fraud prevention)
// ─────────────────────────────────────────────────────────────────────────────

export async function checkAndRecordFingerprint(uid, fingerprintHash) {
  if (!fingerprintHash) return { isReused: false };
  const ref  = doc(db, SOCIAL_COL.DEVICE_FP, fingerprintHash);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    const existing = snap.data();
    return { isReused: existing.uid !== uid, existingUid: existing.uid };
  }
  await setDoc(ref, { uid, fingerprintHash, firstSeenAt: serverTimestamp() });
  return { isReused: false };
}

// ─────────────────────────────────────────────────────────────────────────────
//  TRADES
// ─────────────────────────────────────────────────────────────────────────────

/** Submit a trade request. */
export async function createTrade(data) {
  return addDoc(collection(db, SOCIAL_COL.TRADES), {
    fromUid:   data.fromUid,
    toUid:     data.toUid,
    listingId: data.listingId,
    offerText: data.offerText || "",
    offerPm:   data.offerPm   || 0,
    status:    "pending", // pending | accepted | rejected | cancelled
    createdAt: serverTimestamp(),
  });
}

/** Update a trade's status. Increments both users' totalTrades on acceptance. */
export async function updateTradeStatus(tradeId, status) {
  await updateDoc(doc(db, SOCIAL_COL.TRADES, tradeId), {
    status,
    updatedAt: serverTimestamp(),
  });
  if (status === "accepted") {
    const snap  = await getDoc(doc(db, SOCIAL_COL.TRADES, tradeId));
    const trade = snap.data();
    await updateDoc(doc(db, SOCIAL_COL.USERS, trade.fromUid), { totalTrades: increment(1) });
    await updateDoc(doc(db, SOCIAL_COL.USERS, trade.toUid),   { totalTrades: increment(1) });
  }
}

/** Get all trades involving a user, sent or received (Orders screen). */
export async function getUserTrades(uid) {
  const asFrom = query(collection(db, SOCIAL_COL.TRADES), where("fromUid", "==", uid), orderBy("createdAt", "desc"));
  const asTo   = query(collection(db, SOCIAL_COL.TRADES), where("toUid",   "==", uid), orderBy("createdAt", "desc"));
  const [fromSnap, toSnap] = await Promise.all([getDocs(asFrom), getDocs(asTo)]);
  const all = [
    ...fromSnap.docs.map((d) => ({ id: d.id, role: "sender",   ...d.data() })),
    ...toSnap.docs.map((d)   => ({ id: d.id, role: "receiver", ...d.data() })),
  ];
  return all.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
}

// ─────────────────────────────────────────────────────────────────────────────
//  REVIEWS
// ─────────────────────────────────────────────────────────────────────────────

export async function submitReviewToFirestore(data) {
  return addDoc(collection(db, SOCIAL_COL.REVIEWS), {
    reviewerUid:  data.reviewerUid,
    reviewerName: data.reviewer,
    avatar:       data.avatar,
    targetUid:    data.targetUid || null,
    targetUser:   data.target    || null,
    rating:       data.rating,
    text:         data.text      || "",
    createdAt:    serverTimestamp(),
  });
}

export async function getReviewsForUser(targetUid, pageSize = 20) {
  const q = query(
    collection(db, SOCIAL_COL.REVIEWS),
    where("targetUid", "==", targetUid),
    orderBy("createdAt", "desc"),
    limit(pageSize)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// ─────────────────────────────────────────────────────────────────────────────
//  REPORTS  (bug / scam / fake listing / suggestion / feedback)
// ─────────────────────────────────────────────────────────────────────────────

export async function submitReportToFirestore(data) {
  return addDoc(collection(db, SOCIAL_COL.REPORTS), {
    reporterUid: data.reporterUid,
    reporter:    data.reporter,
    type:        data.type,
    subject:     data.subject,
    details:     data.details,
    status:      "open",
    createdAt:   serverTimestamp(),
  });
}

export async function getAllReports() {
  const q = query(collection(db, SOCIAL_COL.REPORTS), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function resolveReportInFirestore(reportId, resolution) {
  await updateDoc(doc(db, SOCIAL_COL.REPORTS, reportId), {
    status:     resolution,
    resolvedAt: serverTimestamp(),
  });
}

export function listenToReports(callback) {
  const q = query(collection(db, SOCIAL_COL.REPORTS), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

// ─────────────────────────────────────────────────────────────────────────────
//  ADMIN — USER MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

export async function adminSuspendUser(uid) {
  await updateDoc(doc(db, SOCIAL_COL.USERS, uid), {
    isSuspended: true,
    suspendedAt: serverTimestamp(),
  });
}

export async function adminUnsuspendUser(uid) {
  await updateDoc(doc(db, SOCIAL_COL.USERS, uid), {
    isSuspended: false,
    suspendedAt: null,
  });
}

export async function adminGetAllUsers(pageSize = 50) {
  const q = query(
    collection(db, SOCIAL_COL.USERS),
    orderBy("createdAt", "desc"),
    limit(pageSize)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data());
}

export function listenToUser(uid, callback) {
  return onSnapshot(doc(db, SOCIAL_COL.USERS, uid), (snap) => {
    if (snap.exists()) callback(snap.data());
  });
}
