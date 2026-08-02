/* ============================================================
   POINT MAKER (PM) — Production App
   Auth flow (splash → signup → otp → security → success)
   followed by the full marketplace experience.
   ============================================================ */
import React, { useState } from "react";
import { signOut } from "firebase/auth";
import { auth } from "./firebase";
import { AuthFlow } from "./auth/AuthFlow";
import { AdminGate } from "./screens/AdminDashboard";
import MainApp from "./MainApp";
import { DEFAULT_LOCATION } from "./utils/location";

/* ─────────────────────────────────────────
   ROOT — switches between Auth flow, Main App, and Admin Dashboard
───────────────────────────────────────── */
export default function PointMaker() {
  const [authComplete, setAuthComplete] = useState(false);
  const [userLocation,  setUserLocation] = useState(null);
  const [currentUser,   setCurrentUser]  = useState(null); // real Firebase Auth user + Firestore profile
  const [authKey, setAuthKey] = useState(0);
  const [adminMode, setAdminMode] = useState(false);

  // AuthFlow calls onComplete(userObj, locationObj) on successful auth
  const handleAuthComplete = (user, loc) => {
    setCurrentUser(user  || null);
    setUserLocation(loc  || DEFAULT_LOCATION);
    setAuthComplete(true);
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (e) { /* ignore */ }
    setAuthComplete(false);
    setCurrentUser(null);
    setUserLocation(null);
    setAuthKey((k) => k + 1);
  };

  // Merge profile field updates into currentUser without requiring a full logout/login
  const handleProfileUpdate = (updates) => {
    setCurrentUser((prev) => prev ? { ...prev, ...updates } : prev);
  };

  if (adminMode) return <AdminGate onExit={() => setAdminMode(false)} />;

  return authComplete
    ? <MainApp initialLocation={userLocation || DEFAULT_LOCATION} currentUser={currentUser} onLogout={handleLogout} onProfileUpdate={handleProfileUpdate} />
    : <AuthFlow key={authKey} onComplete={handleAuthComplete} onAdminMode={() => setAdminMode(true)} />;
}
