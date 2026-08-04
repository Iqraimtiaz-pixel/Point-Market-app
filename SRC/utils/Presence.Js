// ── Presence system: online/offline + lastActiveAt for users/{uid} ──
// New module — supports Feature 2 (Online / Last Seen).
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";

const HEARTBEAT_MS = 60000;      // refresh lastActiveAt every 60s while visible
const STALE_MS      = 120000;    // if lastActiveAt is older than this, treat as offline
                                  // even if `online` is still true (covers crashes /
                                  // lost connections, which a Firestore-only setup
                                  // — no Realtime Database onDisconnect() — can't
                                  // otherwise detect reliably).

/**
 * Starts presence tracking for the given uid: marks online immediately,
 * heartbeats lastActiveAt every HEARTBEAT_MS while the tab is visible,
 * and marks offline on tab hide / unload / unmount.
 * Call once at the app-shell level (MainApp), not per-screen.
 * Returns a cleanup function.
 */
export function startPresence(uid) {
  if (!uid) return () => {};
  const ref = doc(db, "users", uid);

  const mark = (online) => {
    setDoc(ref, { online, lastActiveAt: serverTimestamp() }, { merge: true })
      .catch((e) => console.warn("Presence update failed:", e.message));
  };

  mark(true);

  const heartbeat = setInterval(() => {
    if (document.visibilityState === "visible") mark(true);
  }, HEARTBEAT_MS);

  const onVisibility = () => mark(document.visibilityState === "visible");
  const onBeforeUnload = () => mark(false);

  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("beforeunload", onBeforeUnload);

  return () => {
    clearInterval(heartbeat);
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("beforeunload", onBeforeUnload);
    mark(false);
  };
}

/**
 * Given a users/{uid} doc's { online, lastActiveAt } fields, returns
 * whether the user should be shown as online right now. Treats a stale
 * lastActiveAt as offline even if the stored `online` flag is still true.
 */
export function isEffectivelyOnline(online, lastActiveAt) {
  if (!online || !lastActiveAt?.toDate) return false;
  return Date.now() - lastActiveAt.toDate().getTime() < STALE_MS;
}

/** "Last seen 5 min ago" style relative-time label. */
export function formatLastSeen(lastActiveAt) {
  if (!lastActiveAt?.toDate) return "Offline";
  const diffMs = Date.now() - lastActiveAt.toDate().getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1)  return "Last seen just now";
  if (min < 60) return `Last seen ${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24)  return `Last seen ${hr}h ago`;
  const days = Math.floor(hr / 24);
  return `Last seen ${days}d ago`;
}
