// ── Extracted from App.jsx: useLivePmPoints ──
import { useState, useEffect } from "react";
import {
  Wallet
} from "lucide-react";
import {
  doc,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../firebase";

export function useLivePmPoints(uid) {
  const [points, setPoints]   = useState(null); // null = loading
  const [status, setStatus]   = useState(null); // "locked" | "unlocked"
  const [error,  setError]    = useState(null);

  useEffect(() => {
    if (!uid) { setPoints(null); setStatus(null); return; }
    setError(null);
    const ref = doc(db, "users", uid);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setPoints(typeof data.pmPoints === "number" ? data.pmPoints : 0);
          setStatus(data.pointsStatus || "unlocked");
        } else {
          setPoints(0);
          setStatus("unlocked");
        }
      },
      (err) => {
        console.warn("Wallet balance listener error:", err.message);
        setError("Could not load your balance. Check your connection.");
      }
    );
    return unsub;
  }, [uid]);

  return { points, status, error };
}

