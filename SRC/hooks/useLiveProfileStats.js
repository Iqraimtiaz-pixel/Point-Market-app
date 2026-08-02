// ── Extracted from App.jsx: useLiveProfileStats ──
import { useState, useEffect } from "react";
import {
  doc,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../firebase";

export function useLiveProfileStats(uid) {
  const [stats, setStats] = useState({ karmaScore: 0, totalTrades: 0, followers: 0, following: 0, loading: true });

  useEffect(() => {
    if (!uid) { setStats({ karmaScore: 0, totalTrades: 0, followers: 0, following: 0, loading: false }); return; }
    const ref = doc(db, "users", uid);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        const data = snap.exists() ? snap.data() : {};
        setStats({
          karmaScore:  typeof data.karmaScore  === "number" ? data.karmaScore  : 0,
          totalTrades: typeof data.totalTrades === "number" ? data.totalTrades : 0,
          followers:   Array.isArray(data.followers) ? data.followers.length : (typeof data.followers === "number" ? data.followers : 0),
          following:   Array.isArray(data.following) ? data.following.length : (typeof data.following === "number" ? data.following : 0),
          loading:     false,
        });
      },
      (err) => {
        console.warn("Profile stats listener error:", err.message);
        setStats({ karmaScore: 0, totalTrades: 0, followers: 0, following: 0, loading: false });
      }
    );
    return unsub;
  }, [uid]);

  return stats;
}

