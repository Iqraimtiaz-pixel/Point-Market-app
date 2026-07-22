// =============================================================================
//  services/userService.js  Â·  Point Market â€” User Profile Operations
//  Profile create/read/touch used by the Auth flow in App.jsx.
//  Wraps Firestore "users" collection.
// =============================================================================
import { db } from "../firebase";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  addDoc,
  collection,
  serverTimestamp,
} from "firebase/firestore";

/**
 * Create a new user's Firestore profile after first OTP verification.
 * No-op (returns existing profile) if the user already exists.
 */
export async function createUserProfile(uid, data) {
  const ref  = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return snap.data();

  const profile = {
    uid,
    phone:             data.phone             || "",
    email:             data.email             || "",
    fullName:          data.fullName          || "",
    username:          data.username          || `user_${uid.slice(0, 8)}`,
    dob:               data.dob               || "",
    avatarEmoji:       "ðŸ§‘",
    bio:               "",
    city:              data.city              || "",
    lat:               data.latitude          || null,
    lng:               data.longitude         || null,
    pmPoints:          100,
    pointsStatus:      "locked",
    karmaScore:        0,
    totalTrades:       0,
    followers:         [],
    following:         [],
    likedListings:     [],
    isVerified:        false,
    isProSeller:       false,
    isAdmin:           false,
    isSuspended:       false,
    deviceFingerprint: data.deviceFingerprint || null,
    createdAt:         serverTimestamp(),
    lastActiveAt:      serverTimestamp(),
  };

  await setDoc(ref, profile);

  // Welcome bonus ledger entry (locked until first listing)
  await addDoc(collection(db, "points_ledger"), {
    uid,
    amount:    100,
    type:      "credit",
    reason:    "WELCOME_BONUS",
    status:    "locked",
    createdAt: serverTimestamp(),
  });

  return profile;
}

/** Fetch a user's Firestore profile by uid. Returns null if not found. */
export async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? { uid: snap.id, ...snap.data() } : null;
}

/** Update lastActiveAt â€” called on every login. Fails silently. */
export async function touchLastSeen(uid) {
  try {
    await updateDoc(doc(db, "users", uid), { lastActiveAt: serverTimestamp() });
  } catch (e) {
    // non-critical â€” never block login on this
  }
}

/** Update editable profile fields (bio, username, city, avatar, etc.) */
export async function updateUserProfile(uid, fields) {
  await updateDoc(doc(db, "users", uid), { ...fields, updatedAt: serverTimestamp() });
}
