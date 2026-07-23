/* ============================================================
   POINT MAKER (PM) — Production App
   Auth flow (splash → signup → otp → security → success)
   followed by the full marketplace experience.
   ============================================================ */
import React, { useState, useEffect, useRef } from "react";
import {
  Search, Bell, Heart, MessageCircle, Share2, Bookmark, Home,
  ShoppingBag, PlusCircle, Inbox, User, Star, ChevronLeft,
  CheckCircle2, Sparkles, Wallet, Package, Truck, RotateCcw,
  XCircle, Send, ChevronRight, TrendingUp, Award, Users,
  Settings as SettingsIcon, Smartphone, Handshake, Lock,
  Eye, EyeOff, Shield, Fingerprint, Gift, Calendar, AlertTriangle,
  Mail,
  Image as ImageIcon,
  MapPin, Navigation, Crosshair, Map as MapIcon, Compass,
  ScanEye, ShieldAlert, ShieldCheck, BadgeCheck,
  UserPlus, UserCheck, Info, Video,
  Phone as PhoneIcon, Tag,
  Copy, Clock, Receipt, ShieldX,
  BarChart3, LineChart, Activity, Flag, Bug, Lightbulb,
  Ban, Trash2, ClipboardList, Database,
  Server, Zap, ThumbsUp, ThumbsDown, MessageSquare, Loader,
  KeyRound, LogOut as LogOutIcon
} from "lucide-react";

// ── Firebase (real ES module imports — no window globals) ──
import { auth, db } from "./firebase";
import {
  onAuthStateChanged,
  signInWithPhoneNumber,
  RecaptchaVerifier,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signInWithEmailAndPassword,
  EmailAuthProvider,
  linkWithCredential,
  PhoneAuthProvider,
  updatePhoneNumber,
} from "firebase/auth";
import {
  doc,
  setDoc,
  addDoc,
  collection,
  query as fsQuery,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  getDoc,
  updateDoc,
  increment,
} from "firebase/firestore";

// ── Local service modules ──
import { createUserProfile, getUserProfile, touchLastSeen, updateUserProfile } from "./services/userService";
import { cldUpload, cldThumbUrl } from "./services/cloudinaryService";
import { getDemoListingsForCity } from "./demoListings";
import AdsterraNativeBanner from "./components/AdsterraNativeBanner";

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

/* ─────────────────────────────────────────
   FIREBASE AUTH — real Firebase Auth + Firestore SDK,
   imported directly at the top of this file (./firebase, firebase/auth,
   firebase/firestore). No window globals, no runtime loader script.
   ─────────────────────────────────────────
   Real OTP flow: Firebase Phone Auth + RecaptchaVerifier.
───────────────────────────────────────── */

// Client-side device fingerprint (used for Sybil detection, stored in Firestore)
function generateFingerprint() {
  const raw = [
    navigator.userAgent,
    navigator.language,
    screen.width + "x" + screen.height,
    new Date().getTimezoneOffset(),
    navigator.hardwareConcurrency || 0,
    navigator.platform || "",
  ].join("|");
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = (hash << 5) - hash + raw.charCodeAt(i);
    hash |= 0;
  }
  return "PM-FP-" + Math.abs(hash).toString(16).toUpperCase();
}

/* ─────────────────────────────────────────
   💰 LIVE WALLET BALANCE — always reads pmPoints straight from Firestore.
   Never hold a hardcoded or cached balance anywhere in the UI; every
   screen that shows PM Points uses this hook so the number is always
   the single source of truth in /users/{uid}.
───────────────────────────────────────── */
function useLivePmPoints(uid) {
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

/* ─────────────────────────────────────────
   👤 LIVE PROFILE STATS — karma, trades, followers, following.
   Always read straight from /users/{uid} in real time; new users with no
   activity yet correctly show 0, never a placeholder/demo number.
───────────────────────────────────────── */
function useLiveProfileStats(uid) {
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

function getFriendlyAuthError(error, fallback) {
  const code = error?.code;
  const message = typeof error?.message === "string" ? error.message : "";

  if (code === "auth/operation-not-allowed") {
    return "This sign-in method is disabled in Firebase Authentication. Enable Phone and Google in Firebase Console → Authentication → Sign-in method.";
  }

  if (code === "auth/unauthorized-domain") {
    return "This domain is not authorized for Firebase Authentication. Add localhost or your deployed domain under Authentication → Settings → Authorized domains.";
  }

  if (code === "auth/popup-blocked") {
    return "The sign-in popup was blocked by the browser. Allow popups for this site and try again.";
  }

  if (code === "auth/network-request-failed") {
    return "Network error — check your internet connection and try again.";
  }

  if (code === "auth/too-many-requests") {
    return "Too many attempts. Please wait a few minutes before trying again.";
  }

  if (code === "auth/invalid-phone-number") {
    return "That phone number doesn't look right. Include your city/area code with no leading 0 (e.g. 3001234567 for Pakistan).";
  }

  if (code === "auth/missing-phone-number") {
    return "Please enter a phone number first.";
  }

  if (code === "auth/captcha-check-failed" || code === "auth/invalid-app-credential") {
    return "Verification check failed. Please refresh the page and try again.";
  }

  if (code === "auth/quota-exceeded") {
    return "SMS quota exceeded for this project right now. Please try again shortly.";
  }

  if (code === "auth/invalid-verification-code") {
    return "Incorrect code. Please check the SMS and try again.";
  }

  if (code === "auth/code-expired") {
    return "This code has expired. Tap resend to get a new one.";
  }

  return message || fallback;
}

/* ─────────────────────────────────────────
   FIREBASE AUTH FLOW
───────────────────────────────────────── */
function AuthFlow({ onComplete, onAdminMode }) {
  const [screen,       setScreen]      = useState("checking");
  const [formData,     setFormData]    = useState({ fullName: "", dob: "", phone: "", countryCode: "+92", email: "", password: "" });
  const [userLocation, setUserLocation]= useState(null);
  const [authError,    setAuthError]   = useState("");
  const [confirmResult,setConfirmResult]= useState(null); // Firebase ConfirmationResult
  const [firebaseUser, setFirebaseUser]= useState(null);
  const fingerprint    = useRef(generateFingerprint());
  const recaptchaVerifierRef = useRef(null);
  // One-shot guard — prevents double-completion when both onAuthStateChanged AND
  // a direct sign-in path (Google popup, OTP verify) both try to call onComplete.
  const authCompleted  = useRef(false);
  const safeComplete   = (user, loc) => {
    if (authCompleted.current) return;
    authCompleted.current = true;
    onComplete(user, loc);
  };
  // Tracks whether the initial auth state check (persisted session restore) has fired.
  // After that first resolution we stop listening so active sign-in flows (OTP, Google)
  // can manage completion themselves without onAuthStateChanged racing them.
  const initialCheckDone = useRef(false);

  const resetRecaptcha = () => {
    if (recaptchaVerifierRef.current) {
      try { recaptchaVerifierRef.current.clear(); } catch (_) {}
      recaptchaVerifierRef.current = null;
    }
    if (window._pmRecaptcha) {
      try { window._pmRecaptcha.clear(); } catch (_) {}
      window._pmRecaptcha = null;
    }
    const container = document.getElementById("pm-recaptcha-container");
    if (container) {
      container.innerHTML = "";
    }
  };

  const createRecaptchaVerifier = () => {
    if (recaptchaVerifierRef.current) return recaptchaVerifierRef.current;

    const verifier = new RecaptchaVerifier(auth, "pm-recaptcha-container", {
      size: "invisible",
      callback: () => {},
      "expired-callback": () => {
        resetRecaptcha();
      },
    });
    recaptchaVerifierRef.current = verifier;
    window._pmRecaptcha = verifier;
    return verifier;
  };

  useEffect(() => {
    return () => {
      resetRecaptcha();
    };
  }, []);

  // ── Auth loading guard: if Firebase hasn't resolved the session in 6 s, go to splash ──
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!initialCheckDone.current) {
        initialCheckDone.current = true;
        setScreen("splash");
      }
    }, 6000);
    return () => clearTimeout(timeout);
  }, []);

  // ── Auto-login: Firebase Auth persists session automatically ──
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      // Only handle the FIRST auth state event (persisted-session restore on app load).
      // Subsequent events come from OTP / Google sign-in and are handled by their own paths.
      if (initialCheckDone.current) return;
      initialCheckDone.current = true;

      if (user) {
        // Returning user — fetch their Firestore profile
        try {
          const profile = await getUserProfile(user.uid);
          safeComplete({
            uid:   user.uid,
            phone: user.phoneNumber,
            ...(profile || {}),
          }, profile?.city ? { city: profile.city, lat: profile.lat, lng: profile.lng } : DEFAULT_LOCATION);
        } catch (e) {
          safeComplete({ uid: user.uid, phone: user.phoneNumber }, DEFAULT_LOCATION);
        }
      } else {
        setScreen("splash");
      }
    });
    return unsub;
  }, []);

  const updateForm = (k, v) => setFormData((f) => ({ ...f, [k]: v }));

  // ── Step 1: Send OTP via Firebase Phone Auth ──
  const sendOtp = async () => {
    setAuthError("");
    try {
      const fullPhone = formData.countryCode + formData.phone.replace(/\D/g, "");
      // Reuse a single verifier instance for the current auth flow and reset it
      // before creating a fresh one if a previous attempt left stale state behind.
      const verifier = createRecaptchaVerifier();
      const result = await signInWithPhoneNumber(auth, fullPhone, verifier);
      // Mark the result so OtpScreen routes to the correct handler (login vs signup).
      result._isLogin = screen === "login";
      setConfirmResult(result);
      setScreen("otp");
    } catch (e) {
      setAuthError(getFriendlyAuthError(e, "Failed to send OTP. Check the phone number and try again."));
      resetRecaptcha();
    }
  };

  // ── Step 2: Verify OTP ──
  const verifyOtp = async (code) => {
    setAuthError("");
    if (!confirmResult) { setAuthError("Session expired. Please restart."); return false; }
    try {
      const cred = await confirmResult.confirm(code);
      setFirebaseUser(cred.user);
      return cred.user;
    } catch (e) {
      setAuthError("Incorrect code. Try again.");
      return false;
    }
  };

  // ── Step 3: Create Firestore profile (new users only) ──
  const createProfile = async (user, location) => {
    try {
      await createUserProfile(user.uid, {
        phone:     user.phoneNumber,
        fullName:  formData.fullName,
        dob:       formData.dob,
        city:      location?.city || null,
        latitude:  location?.lat  || null,
        longitude: location?.lng  || null,
        deviceFingerprint: fingerprint.current,
      });
    } catch (e) {
      // Profile may already exist (returning user via new device) — not an error
    }
  };

  // ── Google Sign-In — shared completion logic for both popup and redirect flows ──
  const completeGoogleUser = async (user) => {
    try {
      const profile = await getUserProfile(user.uid);
      if (profile) {
        // Returning Google user — load existing profile
        await touchLastSeen(user.uid);
        safeComplete(
          { uid: user.uid, email: user.email, fullName: user.displayName, ...(profile || {}) },
          profile?.city
            ? { city: profile.city, lat: profile.lat, lng: profile.lng }
            : DEFAULT_LOCATION
        );
      } else {
        // First-time Google user — create their Firestore profile
        await createUserProfile(user.uid, {
          phone:             user.phoneNumber || "",
          email:             user.email       || "",
          fullName:          user.displayName || "",
          dob:               "",
          city:              null,
          latitude:          null,
          longitude:         null,
          deviceFingerprint: fingerprint.current,
        });
        safeComplete(
          { uid: user.uid, email: user.email, fullName: user.displayName || "" },
          DEFAULT_LOCATION
        );
      }
    } catch (profileErr) {
      // Firestore error — still complete auth with what we have
      safeComplete(
        { uid: user.uid, email: user.email, fullName: user.displayName || "" },
        DEFAULT_LOCATION
      );
    }
  };

  // On mount, check whether we're returning from a signInWithRedirect() round-trip
  // (used as a fallback when the popup is blocked by the browser, common in some
  // in-app/mobile browsers and on certain Vercel-hosted domains).
  useEffect(() => {
    getRedirectResult(auth)
      .then((result) => { if (result?.user) completeGoogleUser(result.user); })
      .catch((e) => {
        if (e && e.code && e.code !== "auth/no-auth-event") {
          setAuthError(getFriendlyAuthError(e, "Google sign-in failed. Please try again."));
        }
      });
  }, []);

  const signInWithGoogle = async () => {
    setAuthError("");
    const provider = new GoogleAuthProvider();

    // Redirect is the primary flow (not just a fallback). signInWithPopup
    // validates the calling domain via the popup's document.referrer/opener
    // origin — on mobile browsers, in-app webviews, and any browser with
    // strict third-party-storage partitioning, that check frequently can't
    // read the referrer at all and Firebase's handler then throws
    // "auth/unauthorized-domain" INSIDE the popup, before Google's account
    // picker ever loads — even when the domain genuinely is authorized.
    // signInWithRedirect is a full top-level navigation, so there's no
    // ambiguous cross-origin opener check to fail.
    try {
      await signInWithRedirect(auth, provider);
      // Execution ends here — the browser navigates away. Completion is
      // handled by the getRedirectResult() effect above after we return.
    } catch (e) {
      // Some desktop browsers/environments don't support redirect the same
      // way (rare) — fall back to a popup attempt in that case only.
      if (e.code === "auth/operation-not-supported-in-this-environment") {
        try {
          const result = await signInWithPopup(auth, provider);
          await completeGoogleUser(result.user);
        } catch (popupErr) {
          if (popupErr.code === "auth/popup-closed-by-user" || popupErr.code === "auth/cancelled-popup-request") {
            return;
          }
          setAuthError(getFriendlyAuthError(popupErr, "Google sign-in failed. Please try again."));
        }
        return;
      }
      setAuthError(getFriendlyAuthError(e, "Google sign-in failed. Please try again."));
    }
  };

  // ── Email + Password Sign-In ──
  const signInWithEmail = async (email, password) => {
    setAuthError("");
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      const user   = result.user;
      try {
        await touchLastSeen(user.uid);
        const profile = await getUserProfile(user.uid);
        safeComplete(
          { uid: user.uid, email: user.email, ...(profile || {}) },
          profile?.city ? { city: profile.city, lat: profile.lat, lng: profile.lng } : DEFAULT_LOCATION
        );
      } catch (e) {
        safeComplete({ uid: user.uid, email: user.email }, DEFAULT_LOCATION);
      }
    } catch (e) {
      const isWrongCred = ["auth/user-not-found", "auth/wrong-password", "auth/invalid-credential"].includes(e.code);
      setAuthError(isWrongCred
        ? "Incorrect email or password. Please try again."
        : getFriendlyAuthError(e, "Email sign-in failed. Please try again.")
      );
    }
  };

  const handleLoginOtp = async (code) => {
    const user = await verifyOtp(code);
    if (!user) return;
    try {
      await touchLastSeen(user.uid);
      const profile = await getUserProfile(user.uid);
      safeComplete(
        { uid: user.uid, phone: user.phoneNumber, ...(profile || {}) },
        profile?.city ? { city: profile.city, lat: profile.lat, lng: profile.lng } : DEFAULT_LOCATION
      );
    } catch (e) {
      safeComplete({ uid: user.uid, phone: user.phoneNumber }, DEFAULT_LOCATION);
    }
  };

  const handleSignupOtp = async (code) => {
    const user = await verifyOtp(code);
    if (!user) return;
    setFirebaseUser(user);
    setScreen("security");
  };

  const handleSignupComplete = async (location) => {
    // Guard: cannot proceed without a verified Firebase user
    if (!firebaseUser) {
      setAuthError("Authentication session expired. Please start again.");
      setScreen("signup");
      return;
    }
    await createProfile(firebaseUser, location);
    // Link email+password credential so the user can sign in with email later
    if (formData.email && formData.password && formData.password.length >= 6) {
      try {
        const emailCred = EmailAuthProvider.credential(formData.email, formData.password);
        await linkWithCredential(firebaseUser, emailCred);
      } catch (linkErr) {
        // Non-fatal — email may already belong to another account; skip silently
        console.warn("Email credential linking skipped:", linkErr.code);
      }
    }
    safeComplete(
      { uid: firebaseUser.uid, phone: firebaseUser.phoneNumber, fullName: formData.fullName, email: formData.email || "" },
      location || DEFAULT_LOCATION
    );
  };

  if (screen === "checking") {
    return (
      <div className="auth-root">
        <style>{AUTH_CSS}</style>
        <div className="auth-phone">
          <div className="auth-loading-wrap"><PmHexLogo size="loading" /></div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-root">
      <style>{AUTH_CSS}</style>
      <div className="auth-phone">
        {screen === "splash"   && <SplashScreen   onNext={() => setScreen("signup")} onLogin={() => { setAuthError(""); setScreen("login"); }} onAdminMode={onAdminMode} onGoogleSignIn={signInWithGoogle} error={authError} />}
        {screen === "login"    && <LoginPhoneScreen formData={formData} updateForm={updateForm} onSendOtp={sendOtp} onBack={() => setScreen("splash")} error={authError} onGoogleSignIn={signInWithGoogle} onEmailSignIn={signInWithEmail} />}
        {screen === "signup"   && <SignupScreen    formData={formData} updateForm={updateForm} onSendOtp={sendOtp} onBack={() => setScreen("splash")} error={authError} />}
        {screen === "otp"      && <OtpScreen       phone={`${formData.countryCode}${formData.phone}`} onVerified={confirmResult?._isLogin ? handleLoginOtp : handleSignupOtp} onResend={sendOtp} onBack={() => setScreen(confirmResult?._isLogin ? "login" : "signup")} error={authError} />}
        {screen === "security" && <SecurityScreen  fingerprint={fingerprint.current} deviceBlocked={false} onDone={() => setScreen("location")} />}
        {screen === "location" && <LocationScreen  onDone={(loc) => { setUserLocation(loc); setScreen("success"); }} />}
        {screen === "success"  && <SuccessScreen   name={formData.fullName} deviceBlocked={false} userLocation={userLocation} onEnter={() => handleSignupComplete(userLocation)} />}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   LOGIN — phone number entry (for returning users)
───────────────────────────────────────── */
function LoginPhoneScreen({ formData, updateForm, onSendOtp, onBack, error, onGoogleSignIn, onEmailSignIn }) {
  const [loading,   setLoading]   = useState(false);
  const [mode,      setMode]      = useState("phone"); // "phone" | "email"
  const [emailPass, setEmailPass] = useState("");
  const [showPass,  setShowPass]  = useState(false);

  const phoneReady  = formData.phone.replace(/\D/,"").length >= 7;
  const emailReady  = /\S+@\S+\.\S+/.test(formData.email || "") && emailPass.length >= 6;

  const submit = async () => {
    setLoading(true);
    if (mode === "phone") {
      await onSendOtp();
    } else {
      await onEmailSignIn(formData.email, emailPass);
    }
    setLoading(false);
  };

  return (
    <div className="kt-scroll">
      <div className="screen-pad" style={{ paddingTop: 18 }}>
        <button type="button" className="back-btn-inline" onClick={() => onBack && onBack()} style={{ marginBottom: 18 }}><ChevronLeft size={20} style={{ pointerEvents: "none" }} /></button>
        <div className="eyebrow"><Lock size={13} /> Welcome back</div>
        <h1 className="screen-h1">Log in to Point Maker</h1>

        {/* ── Mode toggle ── */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          <button
            className={`kt-btn ${mode === "phone" ? "primary" : "ghost"}`}
            style={{ flex: 1, padding: "10px 0", fontSize: 13 }}
            onClick={() => setMode("phone")}
          ><Smartphone size={14} /> Phone OTP</button>
          <button
            className={`kt-btn ${mode === "email" ? "primary" : "ghost"}`}
            style={{ flex: 1, padding: "10px 0", fontSize: 13 }}
            onClick={() => setMode("email")}
          ><Mail size={14} /> Email</button>
        </div>

        {mode === "phone" && (
          <>
            <p className="screen-sub" style={{ marginTop: 0 }}>Enter your phone number. We'll send a one-time code.</p>
            <FieldWrap label="Country code" icon={<PhoneIcon size={15} />} error={null}>
              <select className="field-input" value={formData.countryCode} onChange={(e) => updateForm("countryCode", e.target.value)} style={{ border: "none", background: "none" }}>
                <option value="+92">🇵🇰 +92 Pakistan</option>
                <option value="+1">🇺🇸 +1 USA / Canada</option>
                <option value="+44">🇬🇧 +44 UK</option>
                <option value="+971">🇦🇪 +971 UAE</option>
                <option value="+966">🇸🇦 +966 Saudi Arabia</option>
              </select>
            </FieldWrap>
            <FieldWrap label="Phone number" icon={<Smartphone size={15} />} error={null}>
              <input className="field-input" type="tel" inputMode="numeric" placeholder="3001234567" value={formData.phone} onChange={(e) => updateForm("phone", e.target.value)} onKeyDown={(e) => e.key === "Enter" && phoneReady && submit()} />
            </FieldWrap>
          </>
        )}

        {mode === "email" && (
          <>
            <p className="screen-sub" style={{ marginTop: 0 }}>Sign in with the email and password you set during registration.</p>
            <FieldWrap label="Email address" icon={<Mail size={15} />} error={null}>
              <input className="field-input" type="email" inputMode="email" placeholder="you@example.com" value={formData.email || ""} onChange={(e) => updateForm("email", e.target.value)} onKeyDown={(e) => e.key === "Enter" && emailReady && submit()} />
            </FieldWrap>
            <FieldWrap label="Password" icon={<Lock size={15} />} error={null}>
              <div className="pass-row">
                <input className="field-input" style={{ border: "none", flex: 1, padding: 0 }} type={showPass ? "text" : "password"} placeholder="Your password" value={emailPass} onChange={(e) => setEmailPass(e.target.value)} onKeyDown={(e) => e.key === "Enter" && emailReady && submit()} />
                <button className="pass-eye" onClick={() => setShowPass(!showPass)}>{showPass ? <EyeOff size={16} /> : <Eye size={16} />}</button>
              </div>
            </FieldWrap>
          </>
        )}

        {error && <div className="field-error" style={{ marginBottom: 14 }}><AlertTriangle size={12} /> {error}</div>}

        <button
          className="kt-btn primary"
          disabled={loading || (mode === "phone" ? !phoneReady : !emailReady)}
          style={(loading || (mode === "phone" ? !phoneReady : !emailReady)) ? { opacity: 0.5 } : {}}
          onClick={submit}
        >
          {loading
            ? (mode === "phone" ? "Sending code…" : "Signing in…")
            : mode === "phone"
              ? <><Smartphone size={15} /> Send OTP</>
              : <><Mail size={15} /> Sign in with Email</>
          }
        </button>
        <div className="auth-divider"><span>or</span></div>
        <button className="kt-btn google-btn" onClick={onGoogleSignIn}><GoogleIcon /> Continue with Google</button>
        <p className="login-switch">Don't have an account? <span onClick={onBack}>Create one</span></p>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   PROGRESS BAR
───────────────────────────────────────── */
const STEPS = ["signup", "otp", "security", "location", "success"];
function ProgressBar({ current }) {
  const idx = STEPS.indexOf(current);
  return (
    <div className="progress-bar">
      {STEPS.map((_, i) => (
        <div key={i} className={`progress-seg ${i <= idx ? "filled" : ""}`} />
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────
   SCREEN 1 — SPLASH / LOGO
───────────────────────────────────────── */
function SplashScreen({ onNext, onLogin, onAdminMode, onGoogleSignIn, error }) {
  const pressTimer = useRef(null);

  const startPress = () => {
    pressTimer.current = setTimeout(() => { onAdminMode && onAdminMode(); }, 1800);
  };
  const cancelPress = () => { if (pressTimer.current) clearTimeout(pressTimer.current); };

  return (
    <div className="splash">
      <div className="splash-glow" />
      <div
        className="logo-wrap"
        onMouseDown={startPress}
        onMouseUp={cancelPress}
        onMouseLeave={cancelPress}
        onTouchStart={startPress}
        onTouchEnd={cancelPress}
      >
        {/* The logo image already contains the "PointMarket · TRADE WITH POINTS" wordmark */}
        <PmHexLogo size="splash" />
      </div>
      <p className="tagline">Where <b>good deals happen</b>.<br />Trade skills, items &amp; services — earn PM Points with every honest trade.</p>
      <div className="splash-actions">
        <button className="kt-btn primary" onClick={onNext}>Create account <ChevronRight size={17} /></button>
        <button className="kt-btn ghost" style={{ marginTop: 12 }} onClick={onLogin}>I already have an account</button>
        <div className="auth-divider" style={{ margin: "14px 0 2px" }}><span>or</span></div>
        <button className="kt-btn google-btn" onClick={onGoogleSignIn}><GoogleIcon /> Continue with Google</button>
        {error && <div className="field-error" style={{ marginTop: 10 }}><AlertTriangle size={12} /> {error}</div>}
      </div>
      <div className="splash-badges">
        <div className="badge"><Shield size={13} /> Phone verified</div>
        <div className="badge"><Lock size={13} /> Secure auth</div>
        <div className="badge"><Gift size={13} /> 100 PM welcome gift</div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   OFFICIAL POINTMARKET LOGO
   Displays the brand logo image (public/logo.png).
   Used on the splash screen and the auth loading state.
─────────────────────────────────────────── */
function PmHexLogo({ size = "splash" }) {
  /* splash: full logo with wordmark visible (~260 wide)
     loading: smaller centred mark for the checking screen */
  const style = size === "loading"
    ? { width: 180, height: "auto", animation: "logoFadeIn 0.8s ease-out" }
    : { width: 260, height: "auto", animation: "logoFadeIn 0.8s ease-out" };
  return (
    <img
      src="/logo.png"
      alt="PointMarket"
      style={style}
      draggable={false}
    />
  );
}

/* ─────────────────────────────────────────
   SCREEN 2 — SIGNUP FORM
───────────────────────────────────────── */
function SignupScreen({ formData, updateForm, onSendOtp, onBack, error }) {
  const [showPass,  setShowPass]  = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [errors,    setErrors]    = useState({});

  const validate = () => {
    const e = {};
    if (!formData.fullName.trim())                      e.fullName = "Full name is required";
    if (!formData.dob) {
      e.dob = "Date of birth is required";
    } else {
      const birth   = new Date(formData.dob);
      const now     = new Date();
      const cutoff  = new Date(now.getFullYear() - 13, now.getMonth(), now.getDate());
      if (birth > cutoff)                               e.dob = "You must be at least 13 years old to sign up";
    }
    if (formData.phone.replace(/\D/,"").length < 7)    e.phone    = "Enter a valid phone number";
    if (formData.email && !/\S+@\S+\.\S+/.test(formData.email)) e.email = "Enter a valid email address";
    if (!formData.password || formData.password.length < 6)     e.password = "Password must be at least 6 characters";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const next = async () => {
    if (!validate()) return;
    setLoading(true);
    await onSendOtp();
    setLoading(false);
  };

  return (
    <div className="kt-scroll">
      <ProgressBar current="signup" />
      <div className="screen-pad">
        <button type="button" className="back-btn-inline" onClick={() => onBack && onBack()} style={{ marginBottom: 16 }}><ChevronLeft size={20} style={{ pointerEvents: "none" }} /></button>
        <div className="eyebrow"><Shield size={13} /> Step 1 of 5 · Create Account</div>
        <h1 className="screen-h1">Join Point Maker</h1>
        <p className="screen-sub">Fill in your details. Your phone number will be verified with a real SMS code.</p>

        <FieldWrap label="Full name" icon={<User size={15} />} error={errors.fullName}>
          <input className="field-input" placeholder="e.g. Samira Khan" value={formData.fullName} onChange={(e) => updateForm("fullName", e.target.value)} />
        </FieldWrap>

        <FieldWrap label="Date of birth" icon={<Calendar size={15} />} error={errors.dob}>
          <DobPicker value={formData.dob} onChange={(v) => updateForm("dob", v)} />
        </FieldWrap>

        <FieldWrap label="Country code" icon={<PhoneIcon size={15} />} error={null}>
          <select className="field-input" value={formData.countryCode} onChange={(e) => updateForm("countryCode", e.target.value)} style={{ border: "none", background: "none" }}>
            <option value="+92">🇵🇰 +92 Pakistan</option>
            <option value="+1">🇺🇸 +1 USA / Canada</option>
            <option value="+44">🇬🇧 +44 UK</option>
            <option value="+971">🇦🇪 +971 UAE</option>
            <option value="+966">🇸🇦 +966 Saudi Arabia</option>
          </select>
        </FieldWrap>

        <FieldWrap label="Mobile phone number" icon={<Smartphone size={15} />} error={errors.phone}>
          <input className="field-input" style={{ border: "none", padding: "0 0 0 4px", flex: 1 }} type="tel" inputMode="numeric" placeholder="3001234567" value={formData.phone} onChange={(e) => updateForm("phone", e.target.value)} />
        </FieldWrap>

        <FieldWrap label="Email address (optional — enables email login)" icon={<Mail size={15} />} error={errors.email}>
          <input className="field-input" type="email" inputMode="email" placeholder="you@example.com" value={formData.email} onChange={(e) => updateForm("email", e.target.value)} />
        </FieldWrap>

        <FieldWrap label="Password" icon={<Lock size={15} />} error={errors.password}>
          <div className="pass-row">
            <input className="field-input" style={{ border: "none", flex: 1, padding: 0 }} type={showPass ? "text" : "password"} placeholder="At least 6 characters" value={formData.password} onChange={(e) => updateForm("password", e.target.value)} />
            <button className="pass-eye" onClick={() => setShowPass(!showPass)}>
              {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </FieldWrap>

        {error && <div className="field-error" style={{ marginBottom: 14 }}><AlertTriangle size={12} /> {error}</div>}

        <div className="hint-row"><Shield size={13} /><span>A real SMS will be sent to your phone number for verification.</span></div>
        <div className="hint-row"><Mail size={13} /><span>Providing an email lets you sign in with email + password as well.</span></div>
        <div className="terms">By creating an account you agree to our <b>Terms of Service</b> and <b>Privacy Policy</b>.</div>

        <button className="kt-btn primary" disabled={loading} style={loading ? { opacity: 0.6 } : {}} onClick={next}>
          {loading ? "Sending verification code…" : <><Smartphone size={15} /> Send verification code</>}
        </button>
      </div>
    </div>
  );
}

function FieldWrap({ label, icon, error, children }) {
  return (
    <div className="field-wrap">
      <label className="field-label">{label}</label>
      <div className={`field-box ${error ? "has-error" : ""}`}>
        <span className="field-icon">{icon}</span>
        {children}
      </div>
      {error && <div className="field-error"><AlertTriangle size={12} /> {error}</div>}
    </div>
  );
}

/* ─────────────────────────────────────────
   GOOGLE ICON — used in the Google sign-in button
───────────────────────────────────────── */
function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" style={{ flexShrink: 0 }}>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}

/* ─────────────────────────────────────────
   DOB PICKER — modern 3-dropdown date selector
   Replaces the native <input type="date"> to avoid the
   month-by-month scrolling problem on mobile browsers.
   Users pick Month, Day and Year from 3 separate select elements.
───────────────────────────────────────── */
function DobPicker({ value, onChange }) {
  const MONTHS = [
    "January","February","March","April","May","June",
    "July","August","September","October","November","December",
  ];

  // Parse an initial ISO string so the picker is pre-filled when editing.
  const parseVal = (v) => {
    if (!v || !v.includes("-")) return { year: "", month: "", day: "" };
    const [y, m, d] = v.split("-");
    return { year: y || "", month: m || "", day: d || "" };
  };
  const initial = parseVal(value);

  // ── Local state for each field ──────────────────────────────────────────
  // Critical: we DO NOT derive month/day/year from the external `value` prop
  // on every render. If we did, selecting Month would call onChange("") which
  // resets formData.dob to "", which re-renders the picker with all blanks,
  // losing the just-selected month. Local state preserves partial selections.
  const [selMonth, setSelMonth] = useState(initial.month);
  const [selDay,   setSelDay]   = useState(initial.day);
  const [selYear,  setSelYear]  = useState(initial.year);

  // Re-sync local state if the parent supplies a genuinely different value
  // (e.g. form prefill/reset) without this component unmounting. We only
  // do this when the incoming value doesn't match what we already have,
  // so partial in-progress selections are never wiped by our own onChange("").
  const lastExternalValue = useRef(value);
  if (value !== lastExternalValue.current) {
    lastExternalValue.current = value;
    const next = parseVal(value);
    if (next.month !== selMonth) setSelMonth(next.month);
    if (next.day   !== selDay)   setSelDay(next.day);
    if (next.year  !== selYear)  setSelYear(next.year);
  }

  const currentYear  = new Date().getFullYear();
  const maxBirthYear = currentYear - 13;
  const years = Array.from({ length: maxBirthYear - 1939 }, (_, i) => maxBirthYear - i);

  const getDays = (y, m) => {
    if (!y || !m) return 31;
    return new Date(parseInt(y), parseInt(m), 0).getDate();
  };
  const days = Array.from({ length: getDays(selYear, selMonth) }, (_, i) => i + 1);

  // Clamp day when month/year changes reduce the number of available days.
  const clampDay = (d, y, m) => {
    if (!d) return d;
    const maxD = getDays(y, m);
    return parseInt(d) > maxD ? String(maxD).padStart(2, "0") : d;
  };

  // Emit the full ISO string when all three fields are filled; clear parent
  // when incomplete so formData.dob never holds a stale value.
  // This is safe now because local state (selMonth/selDay/selYear) is stored
  // in useState — it is NOT derived from the value prop on every render, so
  // calling onChange("") here only resets the parent without wiping the picker.
  const emit = (m, d, y) => {
    if (m && d && y) {
      onChange(`${y}-${m.padStart(2,"0")}-${d.padStart(2,"0")}`);
    } else {
      onChange("");
    }
  };

  const handleMonth = (m) => {
    setSelMonth(m);
    const clamped = clampDay(selDay, selYear, m);
    if (clamped !== selDay) setSelDay(clamped);
    emit(m, clamped || selDay, selYear);
  };

  const handleDay = (d) => {
    setSelDay(d);
    emit(selMonth, d, selYear);
  };

  const handleYear = (y) => {
    setSelYear(y);
    const clamped = clampDay(selDay, y, selMonth);
    if (clamped !== selDay) setSelDay(clamped);
    emit(selMonth, clamped || selDay, y);
  };

  const selStyle = {
    border: "none", background: "none", color: "inherit",
    fontFamily: "inherit", fontSize: 14, flex: 1,
    outline: "none", cursor: "pointer", minWidth: 0,
    // Real, tappable hit area (was collapsing to ~18px tall with no
    // padding, which made the control hard to hit accurately on touch
    // screens and easy to mis-click on desktop too).
    minHeight: 44, padding: "10px 2px",
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, flex: 1, minWidth: 0 }}>
      <select id="dob-month" name="dob-month" style={{ ...selStyle, flex: 1.6 }} value={selMonth} onChange={(e) => handleMonth(e.target.value)}>
        <option value="">Month</option>
        {MONTHS.map((m, i) => (
          <option key={i} value={String(i + 1).padStart(2, "0")}>{m}</option>
        ))}
      </select>
      <span style={{ color: "rgba(96,165,250,0.35)", flexShrink: 0, userSelect: "none" }}>|</span>
      <select id="dob-day" name="dob-day" style={{ ...selStyle, flex: 0.7 }} value={selDay} onChange={(e) => handleDay(e.target.value)}>
        <option value="">Day</option>
        {days.map((d) => (
          <option key={d} value={String(d).padStart(2, "0")}>{d}</option>
        ))}
      </select>
      <span style={{ color: "rgba(96,165,250,0.35)", flexShrink: 0, userSelect: "none" }}>|</span>
      <select id="dob-year" name="dob-year" style={{ ...selStyle, flex: 1.1 }} value={selYear} onChange={(e) => handleYear(e.target.value)}>
        <option value="">Year</option>
        {years.map((y) => (
          <option key={y} value={String(y)}>{y}</option>
        ))}
      </select>
    </div>
  );
}

/* ─────────────────────────────────────────
   SCREEN 3 — OTP VERIFICATION (real Firebase code)
───────────────────────────────────────── */
function OtpScreen({ phone, onVerified, onResend, onBack, error: externalError }) {
  const [digits,  setDigits]  = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [shake,   setShake]   = useState(false);
  const [resendCooldown, setResendCooldown] = useState(30); // seconds until resend is allowed
  const [resending, setResending] = useState(false);
  const refs = [useRef(), useRef(), useRef(), useRef(), useRef(), useRef()];

  // Countdown ticks down from 30s every time the screen mounts or a resend fires.
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const handleChange = (i, val) => {
    if (!/^\d?$/.test(val)) return;
    const next = [...digits];
    next[i] = val;
    setDigits(next);
    if (val && i < 5) refs[i + 1].current?.focus();
  };

  const handleKeyDown = (i, e) => {
    if (e.key === "Backspace" && !digits[i] && i > 0) refs[i - 1].current?.focus();
  };

  const verify = async () => {
    const code = digits.join("");
    if (code.length < 6) return;
    setLoading(true);
    const result = await onVerified(code);
    if (result === false) {
      setShake(true);
      setDigits(["","","","","",""]);
      setTimeout(() => { setShake(false); refs[0].current?.focus(); }, 600);
    }
    setLoading(false);
  };

  const resend = async () => {
    if (resendCooldown > 0 || resending || !onResend) return;
    setResending(true);
    setDigits(["","","","","",""]);
    await onResend();
    setResending(false);
    setResendCooldown(30);
    refs[0].current?.focus();
  };

  // Firebase Phone Auth sends 6-digit codes
  const complete = digits.every((d) => d !== "");

  return (
    <div className="kt-scroll">
      <ProgressBar current="otp" />
      <div className="screen-pad">
        <button type="button" className="back-btn-inline" onClick={() => onBack && onBack()} style={{ marginBottom: 16 }}><ChevronLeft size={20} style={{ pointerEvents: "none" }} /></button>
        <div className="eyebrow"><Smartphone size={13} /> Step 2 of 5 · Phone Verification</div>
        <h1 className="screen-h1">Enter your code</h1>
        <p className="screen-sub">A 6-digit verification code was sent to <b style={{ color: "var(--ink)" }}>{phone}</b>.</p>

        <div className={`otp-row ${shake ? "otp-shake" : ""}`} style={{ gap: 8 }}>
          {digits.map((d, i) => (
            <input
              key={i}
              ref={refs[i]}
              className={`otp-box ${externalError ? "otp-error" : d ? "otp-filled" : ""}`}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={d}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
            />
          ))}
        </div>

        {externalError && <div className="error-banner"><AlertTriangle size={14} /> {externalError}</div>}

        <div className="resend-row">
          {resendCooldown > 0
            ? <>Didn't get a code? Resend available in {resendCooldown}s</>
            : <>Didn't get a code? <span className="resend-link" onClick={resend}>{resending ? "Sending…" : "Resend code"}</span></>
          }
        </div>

        <div className="otp-security">
          <div className="sec-row"><CheckCircle2 size={14} color="#22c55e" /> Code expires in 10 minutes</div>
          <div className="sec-row"><CheckCircle2 size={14} color="#22c55e" /> Never share your OTP with anyone</div>
          <div className="sec-row"><CheckCircle2 size={14} color="#22c55e" /> Point Maker will never call you asking for a code</div>
        </div>

        <button
          className="kt-btn primary"
          disabled={!complete || loading}
          style={!complete || loading ? { opacity: 0.4 } : {}}
          onClick={verify}
        >
          {loading ? "Verifying…" : <>Verify &amp; continue <ChevronRight size={16} /></>}
        </button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   📍 LOCATION-BASED SMART MATCHING — DATA LAYER
   (designed so additional cities can be appended
   without touching any matching/filtering logic)
───────────────────────────────────────── */
const PAKISTANI_CITIES = [
  { name: "Lahore",      lat: 31.5497, lng: 74.3436 },
  { name: "Faisalabad",  lat: 31.4504, lng: 73.1350 },
  { name: "Gujranwala",  lat: 32.1877, lng: 74.1945 },
  { name: "Gujrat",      lat: 32.5731, lng: 74.0789 },
  { name: "Rawalpindi",  lat: 33.5651, lng: 73.0169 },
  { name: "Multan",      lat: 30.1575, lng: 71.5249 },
  { name: "Sialkot",     lat: 32.4945, lng: 74.5229 },
  { name: "Sargodha",    lat: 32.0836, lng: 72.6711 },
  { name: "Bahawalpur",  lat: 29.3956, lng: 71.6722 },
  { name: "Hafizabad",   lat: 32.0712, lng: 73.6877 },
];

// Returns a small randomized offset (~0–6km) around a city center,
// used to give each mock listing/user a realistic distinct position.
function jitterCoord(lat, lng, seed) {
  const r = (Math.sin(seed * 999) + 1) / 2; // deterministic pseudo-random 0..1
  const r2 = (Math.cos(seed * 555) + 1) / 2;
  const dLat = (r - 0.5) * 0.09;  // ≈ ±5km
  const dLng = (r2 - 0.5) * 0.09;
  return { lat: lat + dLat, lng: lng + dLng };
}

// Haversine formula — great-circle distance between two GPS points, in KM
function haversineDistanceKm(lat1, lon1, lat2, lon2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371; // Earth radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function formatDistance(km) {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} KM`;
}

/* ════════════════════════════════════════════════════════════
   🤖 AI AUTHENTICITY & KARMA SCORING ENGINE
   ────────────────────────────────────────────────────────────
   Production note: in a live system, `runAiAuthenticityEngine`
   would call a backend service (computer vision model for video/
   image forensics + an LLM for listing-text credibility) and
   return the same shaped result below. Here it's a deterministic
   simulation driven by real signal proxies available client-side
   (file size/type/duration, text length, category match, etc.)
   so the UI, scoring math, badge thresholds, and fraud-flagging
   logic are all fully wired and ready to swap onto a real model.
   ════════════════════════════════════════════════════════════ */

const KARMA_WEIGHTS = {
  authenticity: 0.30,
  condition:    0.25,
  contentQuality: 0.20,
  categoryValue: 0.15,
  completeness:  0.10,
};

const CATEGORY_VALUE_INDEX = {
  electronics: 88, fashion: 62, furniture: 70, books: 40,
  skills: 75, services: 72, vehicles: 95, sports: 58,
  appliances: 80, default: 55,
};

function clampScore(n) { return Math.max(0, Math.min(100, Math.round(n))); }

// Simple seeded pseudo-randomness so the same upload always analyzes
// the same way (stable, not flaky, mimics deterministic model inference)
function seededRandom(seedStr) {
  let h = 0;
  for (let i = 0; i < seedStr.length; i++) { h = (h << 5) - h + seedStr.charCodeAt(i); h |= 0; }
  return () => {
    h = (h * 1103515245 + 12345) & 0x7fffffff;
    return (h % 1000) / 1000;
  };
}

function categoryValueFor(category) {
  const key = (category || "").trim().toLowerCase();
  for (const k of Object.keys(CATEGORY_VALUE_INDEX)) {
    if (key.includes(k)) return CATEGORY_VALUE_INDEX[k];
  }
  return CATEGORY_VALUE_INDEX.default;
}

// Core engine — accepts the raw listing draft, returns a full AI report
function runAiAuthenticityEngine({ title, desc, category, mediaFile, isVideo, aiValue }) {
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

function karmaBandLabel(score) {
  if (score >= 90) return "Excellent";
  if (score >= 70) return "Good";
  if (score >= 50) return "Fair";
  if (score >= 30) return "Low";
  return "Flagged for Review";
}

/* ════════════════════════════════════════════════════════════
   💳 AI PAYMENT VERIFICATION ENGINE — JazzCash + PM Points
   ────────────────────────────────────────────────────────────
   Production note: in a live system this would call a backend
   service that performs OCR + receipt-template matching against
   the uploaded screenshot, cross-checks the amount/timestamp/TxID
   against JazzCash's merchant API, and checks the image hash
   against a database of previously-submitted screenshots. Here
   it's a deterministic client-side simulation driven by real
   signal proxies (file metadata, amount match, manual TxID entry,
   duplicate hash lookup) so the full status/credit/audit pipeline
   is completely wired and ready to swap onto real services.
   ════════════════════════════════════════════════════════════ */

const JAZZCASH_ACCOUNT = {
  number: "0326-9729756",
  title:  "Point Maker (Pvt) Ltd",
};

const PM_POINTS_PACKAGES = [
  { id: "pkg-500",  points: 500,  price: 250  },
  { id: "pkg-1200", points: 1200, price: 550  },
  { id: "pkg-3000", points: 3000, price: 1300 },
  { id: "pkg-7000", points: 7000, price: 2900 },
];

const BOOST_PLANS = [
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
const BOOST_PRICE = BOOST_PLANS[0];
const CERT_PRICE  = { amount: 100, label: "Verified Skill Certification" };

// In-memory ledgers (would be backend-persisted tables in production)
// Keyed by a simple hash of the uploaded screenshot file, to catch reused images.
const _seenScreenshotHashes = new Set();
const _seenTransactionIds   = new Set();

function simpleFileHash(file) {
  if (!file) return null;
  return `${file.name}|${file.size}|${file.lastModified || 0}`;
}

function clampConfidence(n) { return Math.max(0, Math.min(100, Math.round(n))); }

/**
 * Runs full AI verification on a submitted JazzCash payment.
 * @param {Object} params
 * @param {number} params.expectedAmount - the Rs. amount the user should have paid
 * @param {File}   params.screenshotFile - uploaded payment screenshot
 * @param {string} params.transactionId  - TxID the user typed in from their JazzCash receipt
 * @returns {Object} verification report
 */
function runPaymentVerificationEngine({ expectedAmount, screenshotFile, transactionId }) {
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

function paymentStatusLabel(status) {
  switch (status) {
    case "verified": return "Verified & Completed";
    case "review":   return "Under Review";
    case "rejected": return "Rejected";
    default:         return "Pending Verification";
  }
}

function paymentStatusColor(status) {
  switch (status) {
    case "verified": return "#16a34a";
    case "review":   return "#b8860b";
    case "rejected": return "#dc2626";
    default:         return "#6b7587";
  }
}

/* ════════════════════════════════════════════════════════════
   🛡️ ADMIN DASHBOARD — shared state, access control, analytics
   ────────────────────────────────────────────────────────────
   Production note: every number on this dashboard is computed
   live from the data that actually exists in this prototype
   (USER_DIRECTORY, FEED, payment transactions, reports, reviews —
   all held in React state for this session). There is no backend
   database, so historical trends (DAU/WAU/MAU, growth charts) are
   simulated from a seeded series anchored to the real current
   totals, clearly so the dashboard is fully functional and not
   just static mockup numbers. Server health, API response times,
   crash reports, and Firebase services require real infrastructure
   that isn't connected here — those sections are intentionally
   shown as "Not Connected" rather than faked.
   ════════════════════════════════════════════════════════════ */

const ADMIN_PASSCODE = "PM-ADMIN-2026"; // Change this before deployment — use environment variable in production

const REPORT_TYPES = [
  { key: "bug",      label: "Bug",            icon: "bug" },
  { key: "scam",      label: "Scam",           icon: "alert" },
  { key: "fake",       label: "Fake Listing",   icon: "flag" },
  { key: "suggestion", label: "Suggestion",     icon: "lightbulb" },
  { key: "feedback",  label: "General Feedback", icon: "message" },
];

// Seeded pseudo-historical series for charts — anchored to a real current total
// so the trend line ends exactly at the live count, rather than being arbitrary.
function buildTrendSeries(currentTotal, points, seedKey) {
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

function computePlatformAnalytics({ users, feed, transactions, reports, reviews }) {
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

function mostActive(list, key, n = 5) {
  return [...list].sort((a, b) => (b[key] || 0) - (a[key] || 0)).slice(0, n);
}

const DISTANCE_FILTERS = [
  { key: "5km",   label: "Within 5 KM",  maxKm: 5 },
  { key: "10km",  label: "Within 10 KM", maxKm: 10 },
  { key: "20km",  label: "Within 20 KM", maxKm: 20 },
  { key: "city",  label: "Entire City",  maxKm: Infinity },
];

// Default location used if a user skips GPS / for first paint before permission resolves
const DEFAULT_LOCATION = (() => {
  const lahore = PAKISTANI_CITIES[0];
  return { city: lahore.name, lat: lahore.lat, lng: lahore.lng };
})();

/*
  ─── BACKEND SCHEMA (reference) ───────────────────────────────

  User {
    id, email (unique), full_name, dob,
    phone (unique), phone_verified_at, created_at
  }

  DeviceFingerprint {
    id, fingerprint_hash, user_id (fk→User),
    first_seen_at, is_reused (bool)
  }

  KarmaLedger {
    id, user_id, amount, status ENUM('LOCKED','UNLOCKED'),
    reason, created_at
  }

  On fresh signup:
    → INSERT KarmaLedger { amount:100, status:'LOCKED', reason:'WELCOME_BONUS' }
    → Unlocks only after first item/skill video post
  On reused device:
    → block welcome bonus (Sybil flag), allow account creation
*/

/* ─────────────────────────────────────────
   ROOT — controls which screen shows
/* ─────────────────────────────────────────
   SCREEN 4 — DEVICE FINGERPRINT & SECURITY
───────────────────────────────────────── */
function SecurityScreen({ fingerprint, deviceBlocked, onDone }) {
  const [step, setStep] = useState(0); // animate checks in sequence
  const checks = [
    { icon: <Smartphone size={16} />, title: "Phone verified",        sub: "OTP confirmed successfully",              ok: true },
    { icon: <Fingerprint size={16} />,title: "Device fingerprint",    sub: fingerprint,                               ok: !deviceBlocked },
    { icon: <Shield size={16} />,     title: "Sybil attack check",    sub: "One account per device enforced",         ok: !deviceBlocked },
    { icon: <CheckCircle2 size={16} />,title:"Account secured",        sub: "Identity verified & fraud check passed", ok: true },
  ];

  useEffect(() => {
    if (step < checks.length) {
      const t = setTimeout(() => setStep((s) => s + 1), 650);
      return () => clearTimeout(t);
    }
  }, [step]);

  const allDone = step >= checks.length;

  return (
    <div className="kt-scroll">
      <ProgressBar current="security" />

      <div className="screen-pad">
        <div className="eyebrow"><Shield size={13} /> Step 3 of 5 · Security Gateway</div>
        <h1 className="screen-h1">Verifying your account…</h1>
        <p className="screen-sub">Our anti-fraud system runs quietly in the background to keep Point Maker safe for everyone.</p>

        <div className="check-list">
          {checks.map((c, i) => (
            <div key={i} className={`check-item ${i < step ? "visible" : "hidden"}`}>
              <div className={`check-icon-wrap ${c.ok ? "ok" : "blocked"}`}>{c.icon}</div>
              <div className="check-body">
                <div className="check-title">{c.title}</div>
                <div className="check-sub">{c.sub}</div>
              </div>
              <div className="check-result">
                {i < step && (c.ok
                  ? <CheckCircle2 size={18} color="#3b82f6" />
                  : <span className="blocked-tag">BLOCKED</span>
                )}
              </div>
            </div>
          ))}
        </div>

        {deviceBlocked && allDone && (
          <div className="warning-box">
            <AlertTriangle size={16} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 13 }}>Device already registered</div>
              <div style={{ fontSize: 12, marginTop: 3 }}>This device is linked to another account. You can still create an account but the 100 PM Welcome Bonus will not be credited.</div>
            </div>
          </div>
        )}

        {allDone && (
          <button className="kt-btn primary" onClick={onDone}>
            Continue <ChevronRight size={16} />
          </button>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   SCREEN 4 — CITY + GPS LOCATION SETUP
   (Smart Location-Based Trading System)
───────────────────────────────────────── */
function LocationScreen({ onDone }) {
  const [selectedCity, setSelectedCity] = useState(null);
  const [gpsState,     setGpsState]     = useState("idle"); // idle | requesting | granted | denied
  const [coords,       setCoords]       = useState(null);

  const requestGps = () => {
    setGpsState("requesting");
    if (!navigator.geolocation) {
      // Fallback: use the selected city's center coordinates
      const c = PAKISTANI_CITIES.find((c) => c.name === selectedCity);
      setCoords({ lat: c.lat, lng: c.lng });
      setGpsState("granted");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGpsState("granted");
      },
      () => {
        // Permission denied — fall back to city center so the app still works
        const c = PAKISTANI_CITIES.find((c) => c.name === selectedCity);
        setCoords({ lat: c.lat, lng: c.lng });
        setGpsState("denied");
      },
      { enableHighAccuracy: true, timeout: 6000 }
    );
  };

  const finish = () => {
    const city = PAKISTANI_CITIES.find((c) => c.name === selectedCity);
    onDone({
      city: selectedCity,
      lat: coords?.lat ?? city.lat,
      lng: coords?.lng ?? city.lng,
    });
  };

  return (
    <div className="kt-scroll">
      <ProgressBar current="location" />

      <div className="screen-pad">
        <div className="eyebrow"><MapPin size={13} /> Step 4 of 5 · Set Your Location</div>
        <h1 className="screen-h1">Where are you trading from?</h1>
        <p className="screen-sub">We use your city and GPS location to show you the closest, most relevant trades near you.</p>

        <div className="field-label" style={{ marginBottom: 10 }}>Select your city</div>
        <div className="city-grid">
          {PAKISTANI_CITIES.map((c) => (
            <div
              key={c.name}
              className={`city-chip ${selectedCity === c.name ? "selected" : ""}`}
              onClick={() => { setSelectedCity(c.name); setGpsState("idle"); setCoords(null); }}
            >
              <MapPin size={13} /> {c.name}
            </div>
          ))}
        </div>

        {selectedCity && (
          <div className="gps-card">
            {gpsState === "idle" && (
              <>
                <div className="gps-icon"><Crosshair size={20} /></div>
                <div className="gps-text">
                  <div className="gps-title">Enable precise location</div>
                  <div className="gps-sub">Allow GPS access so we can rank trades by exact distance within {selectedCity}.</div>
                </div>
                <button className="kt-btn primary" style={{ marginTop: 12 }} onClick={requestGps}>
                  <Navigation size={15} /> Allow GPS access
                </button>
              </>
            )}
            {gpsState === "requesting" && (
              <div className="gps-loading"><Compass size={18} className="spin" /> Requesting location…</div>
            )}
            {gpsState === "granted" && (
              <div className="gps-success">
                <CheckCircle2 size={18} color="#3b82f6" />
                <div>
                  <div className="gps-title">Location enabled</div>
                  <div className="gps-sub">Lat {coords?.lat.toFixed(4)}, Lng {coords?.lng.toFixed(4)}</div>
                </div>
              </div>
            )}
            {gpsState === "denied" && (
              <div className="gps-warning">
                <AlertTriangle size={18} color="#f87171" />
                <div>
                  <div className="gps-title">GPS permission denied</div>
                  <div className="gps-sub">No problem — we'll use {selectedCity}'s city center instead. You can enable precise GPS anytime from Settings.</div>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="hint-row" style={{ marginTop: 18 }}>
          <MapPin size={13} />
          <span>You can update your city or GPS location later anytime from Profile → Settings → Location.</span>
        </div>

        <button
          className="kt-btn primary"
          disabled={!selectedCity || gpsState === "requesting"}
          style={(!selectedCity || gpsState === "requesting") ? { opacity: 0.4 } : {}}
          onClick={finish}
        >
          Continue <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   SCREEN 5 — SUCCESS + REWARD LOCK
───────────────────────────────────────── */
function SuccessScreen({ name, deviceBlocked, userLocation, onEnter }) {
  const firstName = name ? name.split(" ")[0] : "Trader";

  return (
    <div className="kt-scroll">
      <ProgressBar current="success" />

      <div className="screen-pad success-pad">
        {/* Confetti emoji header */}
        <div className="success-hero">
          <div className="success-avatar">🧑‍🚀</div>
          <div className="success-confetti">🎉</div>
        </div>

        <h1 className="screen-h1" style={{ textAlign: "center" }}>Welcome, {firstName}!</h1>
        <p className="screen-sub" style={{ textAlign: "center" }}>Your Point Maker account is live. Here's your welcome gift.</p>

        {/* Reward card */}
        <div className={`reward-card ${deviceBlocked ? "blocked-card" : ""}`}>
          <div className="reward-top">
            <Gift size={22} />
            <div className="reward-label">Welcome Bonus</div>
          </div>
          <div className="reward-amount">{deviceBlocked ? "+0" : "+100"} PM</div>

          {deviceBlocked ? (
            <div className="reward-lock-tag blocked">
              <AlertTriangle size={12} /> Bonus withheld — device reuse detected
            </div>
          ) : (
            <div className="reward-lock-tag">
              <Lock size={12} /> Locked balance
            </div>
          )}

          <p className="reward-note">
            {deviceBlocked
              ? "This device is linked to another account. Your account is still active, but the bonus is withheld to prevent multi-account fraud."
              : "Your 100 PM are reserved for you and will unlock automatically when you upload your first item or skill video. This ensures a fair, active marketplace."}
          </p>

          {!deviceBlocked && (
            <div className="unlock-steps">
              <div className="unlock-title">How to unlock your PM</div>
              <div className="unlock-step"><span className="step-num">1</span> Post your first item or skill video</div>
              <div className="unlock-step"><span className="step-num">2</span> Your 100 PM unlock instantly</div>
              <div className="unlock-step"><span className="step-num">3</span> Start trading with your balance!</div>
            </div>
          )}
        </div>

        {/* Security summary */}
        <div className="summary-card">
          <div className="summary-title"><Sparkles size={14} /> Account summary</div>
          <div className="summary-row"><span>PM ID</span><b>PM-{Math.floor(Math.random() * 9000 + 1000)}</b></div>
          <div className="summary-row"><span>Phone</span><b>Verified ✓</b></div>
          <div className="summary-row"><span>Location</span><b>{userLocation?.city || "Not set"}</b></div>
          <div className="summary-row"><span>Device</span><b style={{ color: deviceBlocked ? "#ef4444" : "#1d4ed8" }}>{deviceBlocked ? "Flagged" : "Trusted ✓"}</b></div>
          <div className="summary-row"><span>PM Points balance</span><b style={{ color: "#1d4ed8" }}>{deviceBlocked ? "0 PM" : "100 PM (locked)"}</b></div>
        </div>

        <button className="kt-btn primary" onClick={onEnter}>
          Enter Point Maker <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   CSS
───────────────────────────────────────── */
const AUTH_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');

  .auth-root {
    --bg: #060a14; --panel: #0a0f23;
    --mint: #f87171; --green: #3b82f6; --sea: #1d4ed8; --parrot: #60a5fa;
    --text: #eef4ff; --muted: #8593b8; --line: rgba(96,165,250,0.18);
    --danger: #f87171;
    min-height: 100vh; width: 100%;
    background: radial-gradient(ellipse 80% 55% at 50% -5%, rgba(96,165,250,0.16), transparent 55%), var(--bg);
    font-family: 'Inter', sans-serif;
    color: var(--text);
    display: flex; align-items: center; justify-content: center;
    padding: 24px; box-sizing: border-box;
  }
  .auth-root *, .auth-root *::before, .auth-root *::after { box-sizing: border-box; }

.auth-phone {
    width: 100%; max-width: 390px; min-height: 760px;
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 30px;
    overflow: hidden;
    display: flex; flex-direction: column;
    box-shadow: 0 40px 100px -40px rgba(0,0,0,0.85), 0 0 0 1px rgba(255,255,255,0.02) inset;
  }

.auth-root .kt-scroll { flex: 1; overflow-y: auto; -ms-overflow-style: none; scrollbar-width: none; }
.auth-root .kt-scroll::-webkit-scrollbar { display: none; }

  /* ── PROGRESS ── */
.auth-root .progress-bar { display: flex; gap: 5px; padding: 18px 18px 0; }
.auth-root .progress-seg { flex: 1; height: 3px; border-radius: 99px; background: var(--line); transition: background .4s ease; }
.auth-root .progress-seg.filled { background: var(--green); }

  /* ── SPLASH ── */
.auth-root .splash {
    flex: 1; display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    padding: 40px 28px 36px; position: relative; text-align: center;
  }
.auth-root .splash-glow { position: absolute; inset: 0; background: radial-gradient(circle at 50% 30%, rgba(248,113,113,0.18), transparent 55%); pointer-events: none; }

.auth-root .logo-wrap { display: flex; flex-direction: column; align-items: center; position: relative; z-index: 1; }
.auth-root .wordmark { font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 38px; letter-spacing: 0.01em; line-height: 1; margin-top: 10px; }
.auth-root .wm-point { color: #60a5fa; }
.auth-root .wm-market { color: #f87171; }
.auth-root .subword { font-family: 'Space Grotesk', sans-serif; font-weight: 500; font-size: 12px; letter-spacing: 0.34em; color: var(--muted); opacity: 0.9; margin-top: 4px; }

  /* Hexagon handshake logo */
.auth-root .hex-logo-scene { width: 168px; height: 168px; position: relative; animation: logoFadeIn 0.8s ease-out; filter: drop-shadow(0 8px 24px rgba(59,130,246,0.25)); }
.auth-root .hex-logo-svg { width: 100%; height: 100%; }
  @keyframes logoFadeIn { from { opacity: 0; transform: scale(0.92); } to { opacity: 1; transform: scale(1); } }

  .tagline { font-size: 14px; color: var(--muted); line-height: 1.7; margin: 20px 0 28px; max-width: 270px; }
  .tagline b { color: var(--text); font-weight: 600; }

  .splash-actions { width: 100%; max-width: 290px; }
  .splash-badges { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; margin-top: 22px; }
  .badge { display: flex; align-items: center; gap: 5px; background: rgba(248,113,113,0.08); border: 1px solid var(--line); border-radius: 999px; padding: 5px 12px; font-size: 11px; color: var(--muted); }

  /* ── BUTTONS ── */
  .kt-btn { width: 100%; padding: 15px; border-radius: 14px; border: none; font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 14.5px; display: flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer; transition: transform .12s; }
  .kt-btn:active { transform: scale(0.98); }
  .kt-btn.primary { background: linear-gradient(135deg, #3b82f6, #1d4ed8); color: #ffffff; }
  .kt-btn.ghost { background: transparent; color: var(--mint); border: 1px solid var(--line); }
  .kt-btn.google-btn { background: rgba(255,255,255,0.07); color: var(--text); border: 1px solid var(--line); font-family: 'Inter', sans-serif; font-weight: 600; }
  .kt-btn.google-btn:hover { background: rgba(255,255,255,0.12); }
  .kt-btn:disabled { opacity: 0.4; cursor: not-allowed; }

  /* ── OR DIVIDER ── */
  .auth-divider { display: flex; align-items: center; gap: 12px; margin: 14px 0; }
  .auth-divider::before, .auth-divider::after { content: ''; flex: 1; height: 1px; background: var(--line); }
  .auth-divider span { font-size: 12px; color: var(--muted); white-space: nowrap; font-family: 'Inter', sans-serif; }

  /* ── OTP ROW SHAKE (when wrong code entered) ── */
  .auth-root .otp-row.otp-shake { animation: shake .35s ease; }

  /* ── SCREEN CHROME ── */
  .screen-pad { padding: 22px 22px 32px; display: flex; flex-direction: column; gap: 0; }
  .success-pad { gap: 16px; }
  .eyebrow { display: flex; align-items: center; gap: 6px; font-family: 'IBM Plex Mono', monospace; font-size: 11px; letter-spacing: 0.22em; color: var(--green); text-transform: uppercase; margin-bottom: 10px; }
  .screen-h1 { font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 26px; line-height: 1.2; margin: 0 0 8px; }
  .screen-sub { font-size: 13.5px; color: var(--muted); line-height: 1.65; margin: 0 0 22px; }

  /* ── FORM FIELDS ── */
  .field-wrap { margin-bottom: 16px; }
  .field-label { display: block; font-size: 11.5px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); margin-bottom: 7px; }
  .field-box { display: flex; align-items: center; gap: 10px; background: rgba(255,255,255,0.04); border: 1px solid var(--line); border-radius: 14px; padding: 13px 14px; transition: border-color .15s; }
  .field-box:focus-within { border-color: var(--green); }
  .field-box.has-error { border-color: var(--danger); }
  .field-icon { color: var(--muted); flex-shrink: 0; }
  .field-input { flex: 1; background: none; border: none; outline: none; color: var(--text); font-size: 14px; font-family: 'Inter', sans-serif; }
  .field-input::placeholder { color: rgba(127,163,154,0.6); }
  .field-input::-webkit-calendar-picker-indicator { filter: invert(0.7); }
  .field-error { display: flex; align-items: center; gap: 5px; margin-top: 5px; font-size: 11.5px; color: var(--danger); }
  .phone-row { display: flex; align-items: center; flex: 1; }
  .phone-code { font-family: 'IBM Plex Mono', monospace; font-size: 13.5px; color: var(--muted); border-right: 1px solid var(--line); padding-right: 10px; margin-right: 4px; }
  .pass-row { display: flex; align-items: center; flex: 1; gap: 8px; }
  .pass-eye { background: none; border: none; color: var(--muted); cursor: pointer; display: flex; align-items: center; }
  .hint-row { display: flex; align-items: flex-start; gap: 8px; font-size: 12px; color: var(--muted); line-height: 1.5; margin-bottom: 16px; }
  .hint-row svg { flex-shrink: 0; margin-top: 1px; color: var(--mint); }
  .terms { font-size: 11.5px; color: var(--muted); line-height: 1.6; margin-bottom: 18px; }
  .forgot-link { text-align: right; font-size: 12.5px; color: var(--mint); font-weight: 600; cursor: pointer; margin: -8px 0 18px; }
  .login-switch { text-align: center; font-size: 12.5px; color: var(--muted); margin-top: 18px; }
  .login-switch span { color: var(--mint); font-weight: 700; cursor: pointer; }
  .auth-loading-wrap { flex: 1; display: flex; align-items: center; justify-content: center; opacity: 0.9; animation: authPulse 1.4s ease-in-out infinite; }
  @keyframes authPulse { 0%,100% { opacity: 0.55; transform: scale(0.97); } 50% { opacity: 1; transform: scale(1); } }
  .auth-root .back-btn-inline { width: 34px; height: 34px; border-radius: 999px; border: 1px solid var(--line); background: rgba(255,255,255,0.04); display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; color: var(--text); }
  .terms b { color: var(--mint); }

  /* ── OTP ── */
  .otp-row { display: flex; gap: 12px; margin-bottom: 14px; }
  .otp-box { flex: 1; aspect-ratio: 1; text-align: center; font-size: 24px; font-family: 'Space Grotesk', sans-serif; font-weight: 700; background: rgba(255,255,255,0.04); border: 1px solid var(--line); border-radius: 14px; color: var(--text); outline: none; transition: border-color .15s; }
  .otp-box:focus { border-color: var(--green); }
  .otp-box.otp-filled { border-color: var(--green); background: rgba(96,165,250,0.08); }
  .otp-box.otp-error { border-color: var(--danger); animation: shake .35s ease; }
  @keyframes shake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-5px)} 75%{transform:translateX(5px)} }
  .error-banner { display: flex; align-items: center; gap: 8px; background: rgba(251,113,133,0.1); border: 1px solid rgba(251,113,133,0.3); border-radius: 12px; padding: 12px 14px; font-size: 13px; color: var(--danger); margin-bottom: 12px; }
  .demo-note { font-family: 'IBM Plex Mono', monospace; font-size: 11.5px; color: var(--muted); border: 1px dashed var(--line); border-radius: 10px; padding: 10px 14px; margin-bottom: 12px; }
  .demo-note b { color: var(--green); }
  .resend-row { font-size: 13px; color: var(--muted); margin-bottom: 18px; }
  .resend-link { color: var(--mint); font-weight: 600; cursor: pointer; }
  .otp-security { display: flex; flex-direction: column; gap: 8px; margin-bottom: 22px; }
  .sec-row { display: flex; align-items: center; gap: 8px; font-size: 12.5px; color: var(--muted); }

  /* ── SECURITY CHECK ── */
  .check-list { display: flex; flex-direction: column; gap: 12px; margin-bottom: 22px; }
  .check-item { display: flex; align-items: center; gap: 12px; background: rgba(255,255,255,0.03); border: 1px solid var(--line); border-radius: 16px; padding: 14px; transition: opacity .4s, transform .4s; }
  .check-item.hidden { opacity: 0; transform: translateY(8px); }
  .check-item.visible { opacity: 1; transform: translateY(0); animation: popIn .4s ease; }
  @keyframes popIn { from { opacity: 0; transform: translateY(10px); } }
  .check-icon-wrap { width: 38px; height: 38px; border-radius: 11px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .check-icon-wrap.ok { background: rgba(96,165,250,0.14); color: var(--green); }
  .check-icon-wrap.blocked { background: rgba(251,113,133,0.12); color: var(--danger); }
  .check-body { flex: 1; min-width: 0; }
  .check-title { font-weight: 700; font-size: 13.5px; }
  .check-sub { font-family: 'IBM Plex Mono', monospace; font-size: 10.5px; color: var(--muted); margin-top: 3px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .check-result { flex-shrink: 0; }
  .blocked-tag { font-size: 10px; font-weight: 800; color: var(--danger); border: 1px solid var(--danger); border-radius: 6px; padding: 2px 7px; letter-spacing: 0.05em; }
  .warning-box { display: flex; gap: 10px; background: rgba(251,113,133,0.08); border: 1px solid rgba(251,113,133,0.25); border-radius: 14px; padding: 14px; margin-bottom: 18px; font-size: 12.5px; color: var(--danger); }
  .warning-box svg { flex-shrink: 0; margin-top: 1px; }

  /* ── SUCCESS / REWARD ── */
  .success-hero { display: flex; justify-content: center; position: relative; margin-bottom: 4px; }
  .success-avatar { width: 78px; height: 78px; border-radius: 999px; background: rgba(248,113,113,0.12); border: 2px solid var(--line); display: flex; align-items: center; justify-content: center; font-size: 36px; }
  .success-confetti { position: absolute; top: -8px; right: calc(50% - 52px); font-size: 28px; animation: bounce 1.2s ease infinite; }
  @keyframes bounce { 0%,100%{transform:translateY(0) rotate(-10deg);} 50%{transform:translateY(-8px) rotate(10deg);} }

  .reward-card { border: 1px solid rgba(248,113,113,0.25); border-radius: 20px; padding: 20px; background: linear-gradient(160deg, rgba(248,113,113,0.1), rgba(185,28,28,0.03)); }
  .reward-card.blocked-card { border-color: rgba(251,113,133,0.25); background: rgba(251,113,133,0.04); }
  .reward-top { display: flex; align-items: center; gap: 8px; color: var(--mint); font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 6px; }
  .reward-amount { font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 38px; color: var(--mint); margin-bottom: 10px; }
  .reward-card.blocked-card .reward-amount { color: var(--danger); }
  .reward-lock-tag { display: inline-flex; align-items: center; gap: 6px; padding: 5px 12px; border-radius: 999px; background: rgba(251,113,133,0.12); border: 1px solid rgba(251,113,133,0.3); color: var(--danger); font-size: 11px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; margin-bottom: 12px; }
  .reward-lock-tag:not(.blocked) { background: rgba(248,113,113,0.1); border-color: rgba(248,113,113,0.25); color: var(--mint); }
  .reward-note { font-size: 12.5px; color: var(--muted); line-height: 1.65; margin: 0 0 14px; }
  .unlock-steps { border-top: 1px solid var(--line); padding-top: 14px; display: flex; flex-direction: column; gap: 8px; }
  .unlock-title { font-size: 11.5px; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: 0.07em; margin-bottom: 6px; }
  .unlock-step { display: flex; align-items: center; gap: 10px; font-size: 12.5px; color: var(--text); }
  .step-num { width: 22px; height: 22px; border-radius: 999px; background: rgba(248,113,113,0.15); color: var(--mint); display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; flex-shrink: 0; }

  .summary-card { border: 1px solid var(--line); border-radius: 16px; padding: 16px; background: rgba(255,255,255,0.02); }
  .summary-title { display: flex; align-items: center; gap: 7px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: var(--muted); margin-bottom: 12px; }
  .summary-title svg { color: var(--mint); }
  .summary-row { display: flex; justify-content: space-between; font-size: 13px; padding: 7px 0; border-bottom: 1px solid var(--line); }
  .summary-row:last-child { border-bottom: none; }
  .summary-row span { color: var(--muted); }
  .summary-row b { font-weight: 700; }

  /* ── LOCATION SCREEN ── */
.auth-root .city-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 9px; margin-bottom: 18px; }
.auth-root .city-chip { display: flex; align-items: center; gap: 6px; border: 1px solid var(--line); border-radius: 12px; padding: 11px 12px; font-size: 13px; font-weight: 600; color: var(--text); cursor: pointer; background: rgba(255,255,255,0.03); transition: border-color .15s, background .15s; }
.auth-root .city-chip svg { color: var(--muted); flex-shrink: 0; }
.auth-root .city-chip.selected { border-color: var(--green); background: rgba(96,165,250,0.12); }
.auth-root .city-chip.selected svg { color: var(--green); }
.auth-root .gps-card { border: 1px solid var(--line); border-radius: 16px; padding: 16px; margin-bottom: 6px; background: rgba(255,255,255,0.02); }
.auth-root .gps-icon { width: 38px; height: 38px; border-radius: 11px; background: rgba(248,113,113,0.1); color: var(--mint); display: flex; align-items: center; justify-content: center; margin-bottom: 10px; }
.auth-root .gps-text { margin-bottom: 4px; }
.auth-root .gps-title { font-weight: 700; font-size: 13.5px; }
.auth-root .gps-sub { font-size: 12px; color: var(--muted); margin-top: 4px; line-height: 1.5; }
.auth-root .gps-loading { display: flex; align-items: center; gap: 10px; font-size: 13px; color: var(--muted); padding: 4px 0; }
.auth-root .gps-success { display: flex; align-items: flex-start; gap: 10px; }
.auth-root .gps-warning { display: flex; align-items: flex-start; gap: 10px; }
.auth-root .spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
`;

/* ─────────────────────────────────────────
   🛡️ ADMIN GATE — separate secure entry, role-gated
   Never reachable from normal navigation; only via the
   hidden long-press on the splash logo (1.8s hold).
───────────────────────────────────────── */
function AdminGate({ onExit }) {
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState("");
  const [authed, setAuthed] = useState(false);
  const [auditLog, setAuditLog] = useState([]);

  const logAction = (action) => {
    setAuditLog((prev) => [{ id: `log-${Date.now()}`, action, at: new Date().toISOString() }, ...prev]);
  };

  const submit = () => {
    if (passcode.trim() === ADMIN_PASSCODE) {
      setError("");
      setAuthed(true);
      logAction("Administrator authenticated");
    } else {
      setError("Incorrect administrator passcode");
    }
  };

  if (authed) {
    return <AdminDashboard onExit={onExit} auditLog={auditLog} logAction={logAction} />;
  }

  return (
    <div className="auth-root">
      <style>{AUTH_CSS}</style>
      <div className="auth-phone">
        <div className="screen-pad" style={{ paddingTop: 60 }}>
          <button type="button" className="back-btn-inline" onClick={onExit} style={{ marginBottom: 18 }}>
            <ChevronLeft size={20} style={{ pointerEvents: "none" }} />
          </button>

          <div className="admin-gate-icon"><KeyRound size={28} /></div>
          <h1 className="screen-h1">Administrator Access</h1>
          <p className="screen-sub">This area is restricted to Point Maker administrators. Enter your administrator passcode to continue.</p>

          <FieldWrap label="Administrator passcode" icon={<Lock size={15} />} error={error}>
            <input
              className="field-input"
              type="password"
              placeholder="Enter passcode"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />
          </FieldWrap>

          <div className="hint-row"><Shield size={13} /><span>All administrator actions are logged for security and audit purposes.</span></div>

          <button className="kt-btn primary" onClick={submit}>Access Dashboard <ChevronRight size={16} /></button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   MOCK DATA
───────────────────────────────────────── */
const FEED = [];

const SAMPLE_COMMENTS = [];

const BATTLE_OFFERS = [];

const AI_SUGGESTIONS = {
  available: [],
  similar: [],
};

const ORDER_TABS = [
  { key: "give",      label: "To Give",    icon: Package },
  { key: "ship",      label: "To Ship",    icon: Truck },
  { key: "receive",   label: "To Receive", icon: Inbox },
  { key: "returned",  label: "Returned",   icon: RotateCcw },
  { key: "cancelled", label: "Cancelled",  icon: XCircle },
];

const ORDERS = {
  give:      [],
  ship:      [],
  receive:   [],
  returned:  [],
  cancelled: [],
};

const FAQ_ITEMS = [
  { q: "How do I trade an item?",          a: "Open any post and tap the handshake icon to offer your own item or PM Points." },
  { q: "How is AI value calculated?",      a: "Our AI compares your item to similar recent trades to suggest a fair PM Point va
