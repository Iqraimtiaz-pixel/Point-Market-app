// =============================================================================
//  pointsEngine.js  ·  Point Market — Complete PM Points Engine
//  src/pointsEngine.js
//
//  This file is the SINGLE SOURCE OF TRUTH for all PM Points operations.
//  Never write points directly from UI components — always go through here.
//
//  Collections used:
//    points_ledger        every credit / debit / lock / transfer
//    points_rewards       reward rule definitions (admin-configurable)
//    points_transfers     peer-to-peer transfer records
//    points_fraud_log     flagged / blocked transactions
//    users                pmPoints balance field
// =============================================================================

import { db } from "../firebase";
import {
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  collection,
  serverTimestamp,
  increment,
  runTransaction,
  writeBatch,
  Timestamp,
} from "firebase/firestore";

// ─────────────────────────────────────────────────────────────────────────────
//  CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

export const POINTS_COL = {
  USERS:            "users",
  LEDGER:           "points_ledger",
  REWARDS:          "points_rewards",
  TRANSFERS:        "points_transfers",
  FRAUD_LOG:        "points_fraud_log",
};

// Transaction types — every entry in points_ledger has one of these
export const TX_TYPE = {
  CREDIT:           "credit",           // points added
  DEBIT:            "debit",            // points spent
  LOCK:             "lock",             // locked (e.g. welcome bonus)
  UNLOCK:           "unlock",           // unlocked after condition met
  TRANSFER_IN:      "transfer_in",      // received from another user
  TRANSFER_OUT:     "transfer_out",     // sent to another user
  PURCHASE:         "purchase",         // bought via JazzCash
  REFUND:           "refund",           // admin-issued refund
  PENALTY:          "penalty",          // fraud penalty deduction
  REWARD:           "reward",           // earned via activity
};

// Status values for ledger entries
export const TX_STATUS = {
  COMPLETED:        "completed",
  LOCKED:           "locked",
  PENDING:          "pending_verification",
  FAILED:           "failed",
  REVERSED:         "reversed",
  FLAGGED:          "flagged",
};

// Reward rule keys — matched against REWARD_RULES below
export const REWARD = {
  WELCOME:          "WELCOME_BONUS",
  FIRST_LISTING:    "FIRST_LISTING",
  FIRST_TRADE:      "FIRST_TRADE",
  TRADE_COMPLETED:  "TRADE_COMPLETED",
  REVIEW_RECEIVED:  "REVIEW_RECEIVED",
  REFERRAL:         "REFERRAL",
  DAILY_LOGIN:      "DAILY_LOGIN",
  PROFILE_COMPLETE: "PROFILE_COMPLETE",
  VIDEO_UPLOAD:     "VIDEO_UPLOAD",
  VERIFIED_PRO:     "VERIFIED_PRO",
};

// ─────────────────────────────────────────────────────────────────────────────
//  REWARD RULES
//  These live here as defaults. Admins can override them in Firestore
//  under the points_rewards collection (fetched at runtime).
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULT_REWARD_RULES = {
  [REWARD.WELCOME]:          { points: 100,  locked: true,  oneTime: true,  description: "Welcome bonus — unlocks after first listing" },
  [REWARD.FIRST_LISTING]:    { points: 50,   locked: false, oneTime: true,  description: "First item or service listing uploaded" },
  [REWARD.FIRST_TRADE]:      { points: 75,   locked: false, oneTime: true,  description: "First successful trade completed" },
  [REWARD.TRADE_COMPLETED]:  { points: 25,   locked: false, oneTime: false, description: "Each subsequent completed trade" },
  [REWARD.REVIEW_RECEIVED]:  { points: 10,   locked: false, oneTime: false, description: "Positive review received (4★ or 5★)" },
  [REWARD.REFERRAL]:         { points: 150,  locked: false, oneTime: false, description: "Each verified referral signup" },
  [REWARD.DAILY_LOGIN]:      { points: 5,    locked: false, oneTime: false, description: "Daily login reward (once per 24 hours)" },
  [REWARD.PROFILE_COMPLETE]: { points: 30,   locked: false, oneTime: true,  description: "Profile fully completed" },
  [REWARD.VIDEO_UPLOAD]:     { points: 20,   locked: false, oneTime: false, description: "Video listing uploaded" },
  [REWARD.VERIFIED_PRO]:     { points: 200,  locked: false, oneTime: true,  description: "Verified Pro Seller badge earned" },
};

// ─────────────────────────────────────────────────────────────────────────────
//  ANTI-FRAUD THRESHOLDS
// ─────────────────────────────────────────────────────────────────────────────

const FRAUD = {
  MAX_REWARDS_PER_HOUR:         10,    // max reward transactions in 1 hour
  MAX_TRANSFERS_PER_DAY:        5,     // max outbound transfers per user per day
  MAX_TRANSFER_AMOUNT:          5000,  // single transfer ceiling (PM Points)
  MIN_ACCOUNT_AGE_FOR_TRANSFER: 3,     // days old before transfers allowed
  MAX_DAILY_EARNED_POINTS:      500,   // total reward points earnable per day
  SUSPICIOUS_VELOCITY_WINDOW:   3600,  // 1 hour in seconds
};

// ─────────────────────────────────────────────────────────────────────────────
//  INTERNAL HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Write a ledger entry. All point movements go through here. */
async function _writeLedger(data) {
  return addDoc(collection(db, POINTS_COL.LEDGER), {
    ...data,
    createdAt: serverTimestamp(),
  });
}

/** Write to the fraud log. */
async function _logFraud(data) {
  return addDoc(collection(db, POINTS_COL.FRAUD_LOG), {
    ...data,
    flaggedAt: serverTimestamp(),
  });
}

/** Get a user snapshot — throws if not found. */
async function _getUser(uid) {
  const snap = await getDoc(doc(db, POINTS_COL.USERS, uid));
  if (!snap.exists()) throw new Error(`User ${uid} not found.`);
  return { id: snap.id, ...snap.data() };
}

/** Count ledger entries matching a query in the last N seconds. */
async function _countRecent(uid, type, windowSeconds) {
  const since = Timestamp.fromMillis(Date.now() - windowSeconds * 1000);
  const q = query(
    collection(db, POINTS_COL.LEDGER),
    where("uid", "==", uid),
    where("type", "==", type),
    where("createdAt", ">=", since)
  );
  const snap = await getDocs(q);
  return snap.size;
}

/** Check whether a one-time reward was already issued to this user. */
async function _rewardAlreadyIssued(uid, reason) {
  const q = query(
    collection(db, POINTS_COL.LEDGER),
    where("uid", "==", uid),
    where("reason", "==", reason),
    limit(1)
  );
  const snap = await getDocs(q);
  return !snap.empty;
}

/** Sum a user's daily earned points (rewards only, not purchases). */
async function _dailyEarnedPoints(uid) {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const q = query(
    collection(db, POINTS_COL.LEDGER),
    where("uid", "==", uid),
    where("type", "==", TX_TYPE.REWARD),
    where("createdAt", ">=", Timestamp.fromDate(startOfDay))
  );
  const snap = await getDocs(q);
  return snap.docs.reduce((sum, d) => sum + (d.data().amount || 0), 0);
}

// ─────────────────────────────────────────────────────────────────────────────
//  1. CREDIT POINTS  (admin, rewards, refunds)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Directly credit PM Points to a user.
 * Used for admin grants, refunds, and one-off credits.
 * @param {string} uid
 * @param {number} amount
 * @param {string} reason    — human-readable reason string
 * @param {object} [meta]    — extra metadata stored on the ledger entry
 */
export async function creditPoints(uid, amount, reason, meta = {}) {
  if (amount <= 0) throw new Error("Credit amount must be positive.");

  await runTransaction(db, async (tx) => {
    const userRef = doc(db, POINTS_COL.USERS, uid);
    const userSnap = await tx.get(userRef);
    if (!userSnap.exists()) throw new Error("User not found.");

    tx.update(userRef, { pmPoints: increment(amount) });
  });

  await _writeLedger({
    uid,
    amount,
    type:   TX_TYPE.CREDIT,
    status: TX_STATUS.COMPLETED,
    reason,
    ...meta,
  });

  return { success: true, amount };
}

// ─────────────────────────────────────────────────────────────────────────────
//  2. REWARD POINTS ENGINE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Award a reward to a user based on a reward key.
 * Enforces one-time rules, daily caps, and velocity checks.
 * @param {string} uid
 * @param {string} rewardKey   — one of REWARD.* constants
 * @param {object} [overrides] — optional: { points, locked } to override defaults
 * @returns {object} { success, points, reason } or { success: false, reason }
 */
export async function awardReward(uid, rewardKey, overrides = {}) {
  const rule = { ...DEFAULT_REWARD_RULES[rewardKey], ...overrides };
  if (!rule) throw new Error(`Unknown reward key: ${rewardKey}`);

  // ── One-time check ──
  if (rule.oneTime) {
    const alreadyIssued = await _rewardAlreadyIssued(uid, rewardKey);
    if (alreadyIssued) {
      return { success: false, reason: `Reward ${rewardKey} already issued to this user.` };
    }
  }

  // ── Daily cap check ──
  const dailyEarned = await _dailyEarnedPoints(uid);
  if (dailyEarned + rule.points > FRAUD.MAX_DAILY_EARNED_POINTS) {
    await _logFraud({
      uid,
      type:   "DAILY_CAP_EXCEEDED",
      reason: `Reward ${rewardKey} blocked — daily cap of ${FRAUD.MAX_DAILY_EARNED_POINTS} PM would be exceeded.`,
      attempted: rule.points,
      dailyTotal: dailyEarned,
    });
    return { success: false, reason: "Daily reward limit reached." };
  }

  // ── Velocity check ──
  const recentRewards = await _countRecent(uid, TX_TYPE.REWARD, FRAUD.SUSPICIOUS_VELOCITY_WINDOW);
  if (recentRewards >= FRAUD.MAX_REWARDS_PER_HOUR) {
    await _logFraud({
      uid,
      type:   "VELOCITY_EXCEEDED",
      reason: `${recentRewards} rewards in last hour — suspicious velocity.`,
    });
    return { success: false, reason: "Reward velocity limit exceeded. Please try again later." };
  }

  const status = rule.locked ? TX_STATUS.LOCKED : TX_STATUS.COMPLETED;

  // ── Atomic balance update + ledger write ──
  await runTransaction(db, async (tx) => {
    const userRef = doc(db, POINTS_COL.USERS, uid);
    const userSnap = await tx.get(userRef);
    if (!userSnap.exists()) throw new Error("User not found.");
    if (!rule.locked) {
      tx.update(userRef, { pmPoints: increment(rule.points) });
    }
    // Locked points don't touch the spendable balance until unlocked
  });

  await _writeLedger({
    uid,
    amount:  rule.points,
    type:    TX_TYPE.REWARD,
    status,
    reason:  rewardKey,
    description: rule.description,
    locked:  rule.locked || false,
  });

  return { success: true, points: rule.points, locked: rule.locked };
}

/**
 * Unlock previously locked reward points (e.g. welcome bonus after first listing).
 * @param {string} uid
 * @param {string} rewardKey — reason string matching the locked ledger entry
 */
export async function unlockReward(uid, rewardKey) {
  const q = query(
    collection(db, POINTS_COL.LEDGER),
    where("uid",    "==", uid),
    where("reason", "==", rewardKey),
    where("status", "==", TX_STATUS.LOCKED),
    limit(1)
  );
  const snap = await getDocs(q);
  if (snap.empty) return { success: false, reason: "No locked reward found." };

  const ledgerDoc = snap.docs[0];
  const { amount } = ledgerDoc.data();

  await runTransaction(db, async (tx) => {
    const userRef = doc(db, POINTS_COL.USERS, uid);
    const userSnap = await tx.get(userRef);
    if (!userSnap.exists()) throw new Error("User not found.");
    tx.update(userRef, {
      pmPoints:     increment(amount),
      pointsStatus: "unlocked",
    });
    tx.update(ledgerDoc.ref, { status: TX_STATUS.COMPLETED, unlockedAt: serverTimestamp() });
  });

  await _writeLedger({
    uid,
    amount,
    type:   TX_TYPE.UNLOCK,
    status: TX_STATUS.COMPLETED,
    reason: `UNLOCK_${rewardKey}`,
  });

  return { success: true, amount };
}

// ─────────────────────────────────────────────────────────────────────────────
//  3. DEBIT / PURCHASE DEDUCTION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Deduct PM Points from a user's balance.
 * Used for spending on boosts, certifications, trade offers etc.
 * Atomic — will throw if balance is insufficient.
 * @param {string} uid
 * @param {number} amount
 * @param {string} reason
 * @param {object} [meta]
 */
export async function deductPoints(uid, amount, reason, meta = {}) {
  if (amount <= 0) throw new Error("Deduction amount must be positive.");

  let newBalance;

  await runTransaction(db, async (tx) => {
    const userRef  = doc(db, POINTS_COL.USERS, uid);
    const userSnap = await tx.get(userRef);
    if (!userSnap.exists()) throw new Error("User not found.");

    const current = userSnap.data().pmPoints || 0;
    if (current < amount) {
      throw new Error(`Insufficient PM Points. Balance: ${current}, required: ${amount}.`);
    }

    newBalance = current - amount;
    tx.update(userRef, { pmPoints: increment(-amount) });
  });

  await _writeLedger({
    uid,
    amount,
    type:       TX_TYPE.DEBIT,
    status:     TX_STATUS.COMPLETED,
    reason,
    newBalance,
    ...meta,
  });

  return { success: true, deducted: amount, newBalance };
}

// ─────────────────────────────────────────────────────────────────────────────
//  4. PEER-TO-PEER TRANSFER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Transfer PM Points from one user to another.
 * Enforces account age, per-day limits, max amount, and self-transfer block.
 * Fully atomic — either both sides update or neither does.
 * @param {string} fromUid
 * @param {string} toUid
 * @param {number} amount
 * @param {string} [note]     — optional message from sender
 */
export async function transferPoints(fromUid, toUid, amount, note = "") {
  if (fromUid === toUid) throw new Error("Cannot transfer points to yourself.");
  if (amount <= 0)       throw new Error("Transfer amount must be positive.");
  if (amount > FRAUD.MAX_TRANSFER_AMOUNT) {
    throw new Error(`Transfer exceeds maximum allowed (${FRAUD.MAX_TRANSFER_AMOUNT} PM).`);
  }

  // ── Account age check ──
  const sender = await _getUser(fromUid);
  const accountAgeMs = Date.now() - (sender.createdAt?.toMillis?.() || Date.now());
  const accountAgeDays = accountAgeMs / (1000 * 60 * 60 * 24);
  if (accountAgeDays < FRAUD.MIN_ACCOUNT_AGE_FOR_TRANSFER) {
    await _logFraud({
      uid:    fromUid,
      type:   "ACCOUNT_TOO_NEW",
      reason: `Account ${accountAgeDays.toFixed(1)} days old — transfers require ${FRAUD.MIN_ACCOUNT_AGE_FOR_TRANSFER}+ days.`,
    });
    throw new Error(`Transfers are available after your account is ${FRAUD.MIN_ACCOUNT_AGE_FOR_TRANSFER} days old.`);
  }

  // ── Daily transfer count check ──
  const dailyTransfers = await _countRecent(fromUid, TX_TYPE.TRANSFER_OUT, 86400);
  if (dailyTransfers >= FRAUD.MAX_TRANSFERS_PER_DAY) {
    await _logFraud({
      uid:    fromUid,
      type:   "TRANSFER_LIMIT_EXCEEDED",
      reason: `${dailyTransfers} transfers today — limit is ${FRAUD.MAX_TRANSFERS_PER_DAY}.`,
    });
    throw new Error(`Daily transfer limit (${FRAUD.MAX_TRANSFERS_PER_DAY}) reached.`);
  }

  // ── Receiver existence check ──
  await _getUser(toUid); // throws if not found

  // ── Atomic double-entry bookkeeping ──
  const transferId = `tf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  let senderBalance, receiverBalance;

  await runTransaction(db, async (tx) => {
    const fromRef  = doc(db, POINTS_COL.USERS, fromUid);
    const toRef    = doc(db, POINTS_COL.USERS, toUid);
    const fromSnap = await tx.get(fromRef);
    const toSnap   = await tx.get(toRef);

    if (!fromSnap.exists()) throw new Error("Sender not found.");
    if (!toSnap.exists())   throw new Error("Receiver not found.");

    const senderCurrent   = fromSnap.data().pmPoints || 0;
    const receiverCurrent = toSnap.data().pmPoints   || 0;

    if (senderCurrent < amount) {
      throw new Error(`Insufficient PM Points. Balance: ${senderCurrent}, required: ${amount}.`);
    }

    senderBalance   = senderCurrent   - amount;
    receiverBalance = receiverCurrent + amount;

    tx.update(fromRef, { pmPoints: increment(-amount) });
    tx.update(toRef,   { pmPoints: increment(amount)  });
  });

  // ── Transfer record ──
  await addDoc(collection(db, POINTS_COL.TRANSFERS), {
    transferId,
    fromUid,
    toUid,
    amount,
    note,
    status:     "completed",
    createdAt:  serverTimestamp(),
  });

  // ── Double-entry ledger (both sides) ──
  const batch = writeBatch(db);

  const outRef = doc(collection(db, POINTS_COL.LEDGER));
  batch.set(outRef, {
    uid:        fromUid,
    amount,
    type:       TX_TYPE.TRANSFER_OUT,
    status:     TX_STATUS.COMPLETED,
    reason:     "TRANSFER",
    transferId,
    counterpartUid: toUid,
    newBalance: senderBalance,
    note,
    createdAt:  serverTimestamp(),
  });

  const inRef = doc(collection(db, POINTS_COL.LEDGER));
  batch.set(inRef, {
    uid:        toUid,
    amount,
    type:       TX_TYPE.TRANSFER_IN,
    status:     TX_STATUS.COMPLETED,
    reason:     "TRANSFER",
    transferId,
    counterpartUid: fromUid,
    newBalance: receiverBalance,
    note,
    createdAt:  serverTimestamp(),
  });

  await batch.commit();

  return { success: true, transferId, amount, senderBalance, receiverBalance };
}

// ─────────────────────────────────────────────────────────────────────────────
//  5. JAZZCASH PURCHASE  (connects to payment verification engine)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Record a JazzCash PM Points purchase submission.
 * Call this BEFORE AI verification runs — status starts as pending.
 * @returns {string} ledgerDocId — pass this to completePurchase() or rejectPurchase()
 */
export async function submitPurchase(uid, { amount, pmPoints, transactionId, screenshotHash, label }) {
  // ── Duplicate TxID check ──
  const txQuery = query(
    collection(db, POINTS_COL.LEDGER),
    where("transactionId", "==", transactionId),
    limit(1)
  );
  const txSnap = await getDocs(txQuery);
  if (!txSnap.empty) {
    await _logFraud({
      uid,
      type:   "DUPLICATE_TRANSACTION_ID",
      transactionId,
      reason: "Transaction ID already exists in ledger.",
    });
    throw new Error("Duplicate transaction ID. This payment has already been submitted.");
  }

  // ── Duplicate screenshot check ──
  if (screenshotHash) {
    const ssQuery = query(
      collection(db, POINTS_COL.LEDGER),
      where("screenshotHash", "==", screenshotHash),
      limit(1)
    );
    const ssSnap = await getDocs(ssQuery);
    if (!ssSnap.empty) {
      await _logFraud({
        uid,
        type:   "DUPLICATE_SCREENSHOT",
        screenshotHash,
        reason: "Screenshot hash already exists in ledger.",
      });
      throw new Error("This screenshot has already been used for a previous payment.");
    }
  }

  const ref = await _writeLedger({
    uid,
    amount,
    pmPoints,
    type:           TX_TYPE.PURCHASE,
    status:         TX_STATUS.PENDING,
    reason:         label || "JAZZCASH_PURCHASE",
    transactionId,
    screenshotHash: screenshotHash || null,
    aiConfidence:   null,
    aiFlags:        [],
  });

  return ref.id;  // ledgerDocId
}

/**
 * Called when AI verification passes — credits points and marks ledger completed.
 */
export async function completePurchase(uid, ledgerDocId, pmPoints, aiReport) {
  await runTransaction(db, async (tx) => {
    const userRef    = doc(db, POINTS_COL.USERS, uid);
    const ledgerRef  = doc(db, POINTS_COL.LEDGER, ledgerDocId);
    const userSnap   = await tx.get(userRef);
    if (!userSnap.exists()) throw new Error("User not found.");

    tx.update(userRef, { pmPoints: increment(pmPoints) });
    tx.update(ledgerRef, {
      status:       TX_STATUS.COMPLETED,
      aiConfidence: aiReport.confidence,
      aiFlags:      aiReport.flags || [],
      verifiedAt:   serverTimestamp(),
    });
  });

  return { success: true, pmPoints };
}

/**
 * Called when AI verification fails or payment is under review.
 */
export async function rejectPurchase(ledgerDocId, aiReport, underReview = false) {
  const status = underReview ? "under_review" : TX_STATUS.FAILED;
  await updateDoc(doc(db, POINTS_COL.LEDGER, ledgerDocId), {
    status,
    aiConfidence: aiReport.confidence,
    aiFlags:      aiReport.flags || [],
    verifiedAt:   serverTimestamp(),
  });
  return { success: false, status };
}

// ─────────────────────────────────────────────────────────────────────────────
//  6. ADMIN OPERATIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Admin: issue a manual refund of PM Points.
 */
export async function adminRefund(uid, amount, reason, adminUid) {
  await creditPoints(uid, amount, "ADMIN_REFUND", { adminUid, refundReason: reason });
  await _writeLedger({
    uid:       adminUid,
    amount,
    type:      TX_TYPE.REFUND,
    status:    TX_STATUS.COMPLETED,
    reason:    `ADMIN_REFUND_ISSUED → ${uid}`,
    targetUid: uid,
  });
  return { success: true };
}

/**
 * Admin: apply a penalty (deduct points for fraud).
 */
export async function adminPenalty(uid, amount, reason, adminUid) {
  const user = await _getUser(uid);
  const deduct = Math.min(amount, user.pmPoints || 0); // never below zero
  if (deduct > 0) {
    await runTransaction(db, async (tx) => {
      tx.update(doc(db, POINTS_COL.USERS, uid), { pmPoints: increment(-deduct) });
    });
  }
  await _writeLedger({
    uid,
    amount:   deduct,
    type:     TX_TYPE.PENALTY,
    status:   TX_STATUS.COMPLETED,
    reason,
    adminUid,
  });
  return { success: true, deducted: deduct };
}

// ─────────────────────────────────────────────────────────────────────────────
//  7. READ / QUERY FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get a user's current PM Points balance.
 */
export async function getBalance(uid) {
  const user = await _getUser(uid);
  return {
    balance:      user.pmPoints      || 0,
    pointsStatus: user.pointsStatus  || "locked",
  };
}

/**
 * Paginated transaction history for a user.
 * @param {string}               uid
 * @param {number}               pageSize
 * @param {DocumentSnapshot}     lastDoc     null for first page
 */
export async function getTransactionHistory(uid, pageSize = 20, lastDoc = null) {
  let q = query(
    collection(db, POINTS_COL.LEDGER),
    where("uid", "==", uid),
    orderBy("createdAt", "desc"),
    limit(pageSize)
  );
  if (lastDoc) q = query(q, startAfter(lastDoc));
  const snap = await getDocs(q);
  return {
    transactions: snap.docs.map((d) => ({ id: d.id, ...d.data() })),
    lastDoc:      snap.docs[snap.docs.length - 1] || null,
    hasMore:      snap.docs.length === pageSize,
  };
}

/**
 * Get all pending purchase submissions (for admin review queue).
 */
export async function getPendingPurchases() {
  const q = query(
    collection(db, POINTS_COL.LEDGER),
    where("status", "==", TX_STATUS.PENDING),
    where("type",   "==", TX_TYPE.PURCHASE),
    orderBy("createdAt", "asc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Get all fraud log entries (admin dashboard).
 */
export async function getFraudLog(pageSize = 50) {
  const q = query(
    collection(db, POINTS_COL.FRAUD_LOG),
    orderBy("flaggedAt", "desc"),
    limit(pageSize)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Get transfer history between two specific users.
 */
export async function getTransferHistory(uid, pageSize = 20) {
  const sent = query(
    collection(db, POINTS_COL.TRANSFERS),
    where("fromUid", "==", uid),
    orderBy("createdAt", "desc"),
    limit(pageSize)
  );
  const received = query(
    collection(db, POINTS_COL.TRANSFERS),
    where("toUid", "==", uid),
    orderBy("createdAt", "desc"),
    limit(pageSize)
  );
  const [sentSnap, receivedSnap] = await Promise.all([getDocs(sent), getDocs(received)]);
  const all = [
    ...sentSnap.docs.map((d)     => ({ id: d.id, direction: "sent",     ...d.data() })),
    ...receivedSnap.docs.map((d) => ({ id: d.id, direction: "received", ...d.data() })),
  ].sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  return all.slice(0, pageSize);
}

/**
 * Get platform-wide point stats (admin dashboard analytics).
 */
export async function getPlatformPointStats() {
  // Total circulating points — sum all user balances
  // Note: for scale, maintain a running total in a separate aggregate doc
  // rather than summing all users. This implementation is for < 10k users.
  const usersSnap = await getDocs(collection(db, POINTS_COL.USERS));
  const totalCirculating = usersSnap.docs.reduce((sum, d) => sum + (d.data().pmPoints || 0), 0);

  const txSnap = await getDocs(collection(db, POINTS_COL.LEDGER));
  const transactions = txSnap.docs.map((d) => d.data());

  const totalPurchased = transactions
    .filter((t) => t.type === TX_TYPE.PURCHASE && t.status === TX_STATUS.COMPLETED)
    .reduce((s, t) => s + (t.pmPoints || 0), 0);

  const totalRewarded = transactions
    .filter((t) => t.type === TX_TYPE.REWARD && t.status === TX_STATUS.COMPLETED)
    .reduce((s, t) => s + (t.amount || 0), 0);

  const totalTransferred = transactions
    .filter((t) => t.type === TX_TYPE.TRANSFER_OUT && t.status === TX_STATUS.COMPLETED)
    .reduce((s, t) => s + (t.amount || 0), 0);

  const pendingVerification = transactions.filter((t) => t.status === TX_STATUS.PENDING).length;
  const fraudFlagged        = transactions.filter((t) => t.status === TX_STATUS.FLAGGED).length;

  return {
    totalCirculating,
    totalPurchased,
    totalRewarded,
    totalTransferred,
    pendingVerification,
    fraudFlagged,
  };
}
