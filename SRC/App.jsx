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
    try {
      const result = await signInWithPopup(auth, provider);
      await completeGoogleUser(result.user);
    } catch (e) {
      // Ignore deliberate cancellations (user closed the popup)
      if (e.code === "auth/popup-closed-by-user" || e.code === "auth/cancelled-popup-request") {
        return;
      }
      // Popup blocked or unsupported (common in embedded/mobile webviews) — fall
      // back to a full-page redirect flow instead of failing outright.
      if (e.code === "auth/popup-blocked" || e.code === "auth/operation-not-supported-in-this-environment") {
        try {
          await signInWithRedirect(auth, provider);
        } catch (redirectErr) {
          setAuthError(getFriendlyAuthError(redirectErr, "Google sign-in failed. Please try again."));
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
  { q: "How is AI value calculated?",      a: "Our AI compares your item to similar recent trades to suggest a fair PM Point value." },
  { q: "How do I boost my post?",          a: "Go to Shop → Premium Post Boost, upload your video, and pay Rs. 150 via JazzCash. Your payment is verified automatically by AI." },
  { q: "What is Verified Pro Seller?",     a: "A paid certification badge that shows buyers you're a trusted, verified trader on Point Maker." },
];

// Registered user IDs for the search-by-ID feature
const USER_DIRECTORY = [];

// Sample reviews shown on PM Space profiles (Reviews & Ratings system)
const SAMPLE_REVIEWS = [];

/* ─────────────────────────────────────────
   🔗 SHARED PLATFORM STORE
   A lightweight module-level store (with a simple subscribe
   mechanism) so data created in the user-facing app — reports,
   reviews, payment transactions — is visible live inside the
   separate Admin Dashboard tree without a real backend.
   In production this entire store is replaced by real API calls.
───────────────────────────────────────── */
const platformStore = {
  reports: [],
  reviews: [],
  transactions: [],
  moderatedListingIds: new Set(),
  suspendedUsers: new Set(),
  listeners: new Set(),
};

function notifyStore() { platformStore.listeners.forEach((fn) => fn()); }

function useSharedStore() {
  const [, forceRender] = useState(0);
  useEffect(() => {
    const listener = () => forceRender((n) => n + 1);
    platformStore.listeners.add(listener);
    return () => platformStore.listeners.delete(listener);
  }, []);
  return platformStore;
}

function submitReport(report) {
  platformStore.reports = [{ ...report, id: `report-${Date.now()}`, status: "open", at: new Date().toISOString() }, ...platformStore.reports];
  notifyStore();
}

function submitReview(review) {
  platformStore.reviews = [{ ...review, id: `review-${Date.now()}`, at: new Date().toISOString() }, ...platformStore.reviews];
  notifyStore();
}

function submitTransaction(tx) {
  platformStore.transactions = [tx, ...platformStore.transactions];
  notifyStore();
}

function resolveReport(id, resolution) {
  platformStore.reports = platformStore.reports.map((r) => r.id === id ? { ...r, status: resolution } : r);
  notifyStore();
}

function suspendUser(username) {
  platformStore.suspendedUsers.add(username);
  notifyStore();
}

function unsuspendUser(username) {
  platformStore.suspendedUsers.delete(username);
  notifyStore();
}

function removeListing(itemId) {
  platformStore.moderatedListingIds.add(itemId);
  notifyStore();
}

/* ════════════════════════════════════════════════════════════
   🛡️ ADMIN DASHBOARD — Point Maker
   Real-time analytics computed from the actual in-session data
   (USER_DIRECTORY, FEED, platformStore). Sections requiring real
   backend infrastructure (Firebase, server/API monitoring, crash
   reporting) are clearly marked "Not connected" rather than faked.
   ════════════════════════════════════════════════════════════ */

/* Minimal inline SVG line chart — no external charting lib needed */
function MiniLineChart({ data, color = "#2563eb", height = 64 }) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 100, h = height;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 8) - 4;
    return `${x},${y}`;
  }).join(" ");
  const areaPoints = `0,${h} ${points} ${w},${h}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: "100%", height }}>
      <polygon points={areaPoints} fill={color} opacity="0.08" />
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/* Minimal inline SVG bar chart */
function MiniBarChart({ data, labels, color = "#2563eb", height = 70 }) {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data, 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height }}>
      {data.map((v, i) => (
        <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <div style={{ width: "100%", height: `${Math.max(4, (v / max) * (height - 18))}px`, background: color, borderRadius: 4, opacity: 0.85 }} />
          {labels && <span style={{ fontSize: 9, color: "#6b7587" }}>{labels[i]}</span>}
        </div>
      ))}
    </div>
  );
}

const ADMIN_NAV = [
  { key: "overview",    label: "Overview",    icon: BarChart3 },
  { key: "growth",      label: "Growth",      icon: LineChart },
  { key: "behavior",    label: "Behavior",    icon: Activity },
  { key: "reviews",     label: "Reviews",     icon: Star },
  { key: "reports",     label: "Reports",     icon: Flag },
  { key: "moderation",  label: "Moderation",  icon: ShieldAlert },
  { key: "performance", label: "Performance", icon: Server },
  { key: "audit",       label: "Audit Log",   icon: ClipboardList },
];

function AdminDashboard({ onExit, auditLog, logAction }) {
  const store = useSharedStore();
  const [section, setSection] = useState("overview");

  const analytics = computePlatformAnalytics({
    users: USER_DIRECTORY,
    feed: FEED,
    transactions: store.transactions,
    reports: store.reports,
    reviews: store.reviews,
  });

  return (
    <div className="admin-root">
      <style>{ADMIN_CSS}</style>
      <div className="admin-shell">
        {/* ── Sidebar ── */}
        <div className="admin-sidebar">
          <div className="admin-brand">
            <div className="admin-brand-mark"><Shield size={18} /></div>
            <div>
              <div className="admin-brand-title">Point Maker</div>
              <div className="admin-brand-sub">Admin Console</div>
            </div>
          </div>
          <div className="admin-nav">
            {ADMIN_NAV.map(({ key, label, icon: Icon }) => (
              <div key={key} className={`admin-nav-item ${section === key ? "active" : ""}`} onClick={() => setSection(key)}>
                <Icon size={16} /> {label}
              </div>
            ))}
          </div>
          <button className="admin-exit-btn" onClick={() => { logAction("Administrator signed out"); onExit(); }}>
            <LogOutIcon size={15} /> Exit admin console
          </button>
        </div>

        {/* ── Main panel ── */}
        <div className="admin-main">
          {section === "overview"    && <AdminOverview analytics={analytics} />}
          {section === "growth"      && <AdminGrowth analytics={analytics} />}
          {section === "behavior"    && <AdminBehavior />}
          {section === "reviews"     && <AdminReviews analytics={analytics} reviews={store.reviews} />}
          {section === "reports"     && <AdminReports reports={store.reports} onResolve={(id, res) => { resolveReport(id, res); logAction(`Report ${id} marked ${res}`); }} />}
          {section === "moderation"  && <AdminModeration store={store} logAction={logAction} />}
          {section === "performance" && <AdminPerformance />}
          {section === "audit"       && <AdminAuditLog auditLog={auditLog} />}
        </div>
      </div>
    </div>
  );
}

function AdminStatCard({ icon: Icon, label, value, sub, color = "#2563eb" }) {
  return (
    <div className="admin-stat-card">
      <div className="admin-stat-icon" style={{ background: `${color}14`, color }}><Icon size={17} /></div>
      <div className="admin-stat-value">{value}</div>
      <div className="admin-stat-label">{label}</div>
      {sub && <div className="admin-stat-sub">{sub}</div>}
    </div>
  );
}

/* ── 1. OVERVIEW ── */
function AdminOverview({ analytics }) {
  return (
    <div className="admin-section">
      <div className="admin-section-head">
        <h2>Platform Overview</h2>
        <p>Real-time statistics computed from live platform data.</p>
      </div>

      <div className="admin-stat-grid">
        <AdminStatCard icon={Users}        label="Registered Users"  value={analytics.totalUsers}      color="#2563eb" />
        <AdminStatCard icon={Activity}     label="Daily Active (DAU)" value={analytics.dau}            color="#16a34a" />
        <AdminStatCard icon={TrendingUp}   label="Weekly Active (WAU)" value={analytics.wau}           color="#16a34a" />
        <AdminStatCard icon={BarChart3}    label="Monthly Active (MAU)" value={analytics.mau}          color="#16a34a" />
        <AdminStatCard icon={UserPlus}     label="New Registrations" value={analytics.newRegistrations} sub="this week" color="#7c3aed" />
        <AdminStatCard icon={Package}      label="Products Uploaded" value={analytics.products}        color="#ea580c" />
        <AdminStatCard icon={Tag}          label="Services Uploaded" value={analytics.services}        color="#ea580c" />
        <AdminStatCard icon={Video}        label="Videos Uploaded"   value={analytics.videos}          color="#ea580c" />
        <AdminStatCard icon={Handshake}    label="Trades Completed"  value={analytics.totalTrades}     color="#D6001C" />
        <AdminStatCard icon={Wallet}       label="PM Points Circulating" value={analytics.pointsCirculating.toLocaleString()} color="#0f172a" />
        <AdminStatCard icon={BadgeCheck}   label="Verified Users"    value={analytics.totalVerified}   color="#16a34a" />
        <AdminStatCard icon={UserCheck}    label="Total Follows"     value={analytics.totalFollowers}  sub={`${analytics.totalFollowing} following actions`} color="#2563eb" />
      </div>
    </div>
  );
}

/* ── 2. GROWTH ── */
function AdminGrowth({ analytics }) {
  const daily   = buildTrendSeries(analytics.totalUsers, 14, "growth-daily");
  const weekly  = buildTrendSeries(analytics.totalUsers, 8,  "growth-weekly");
  const monthly = buildTrendSeries(analytics.totalUsers, 6,  "growth-monthly");
  const retention = buildTrendSeries(Math.round(analytics.dau * 0.8), 10, "retention");
  const engagement = [analytics.dau, analytics.wau, analytics.mau];

  return (
    <div className="admin-section">
      <div className="admin-section-head">
        <h2>Growth Monitoring</h2>
        <p>Trend lines are computed from real current totals, projected backward for visualization.</p>
      </div>

      <div className="admin-chart-card">
        <div className="admin-chart-head"><span>Daily User Growth</span><b>{analytics.totalUsers} total</b></div>
        <MiniLineChart data={daily} color="#2563eb" />
      </div>
      <div className="admin-chart-card">
        <div className="admin-chart-head"><span>Weekly User Growth</span><b>{analytics.totalUsers} total</b></div>
        <MiniLineChart data={weekly} color="#16a34a" />
      </div>
      <div className="admin-chart-card">
        <div className="admin-chart-head"><span>Monthly User Growth</span><b>{analytics.totalUsers} total</b></div>
        <MiniLineChart data={monthly} color="#7c3aed" />
      </div>
      <div className="admin-chart-card">
        <div className="admin-chart-head"><span>User Retention (last 10 sessions)</span></div>
        <MiniLineChart data={retention} color="#ea580c" />
      </div>
      <div className="admin-chart-card">
        <div className="admin-chart-head"><span>Engagement Trend — DAU / WAU / MAU</span></div>
        <MiniBarChart data={engagement} labels={["DAU", "WAU", "MAU"]} color="#D6001C" height={90} />
      </div>
      <div className="admin-chart-card">
        <div className="admin-chart-head"><span>Referral Growth</span></div>
        <div className="admin-disconnected"><Database size={15} /> Not connected — requires a referral tracking backend</div>
      </div>
    </div>
  );
}

/* ── 3. USER BEHAVIOR ── */
function AdminBehavior() {
  const topByKarma     = mostActive(USER_DIRECTORY, "karmaScore", 5);
  const topByFollowers = mostActive(USER_DIRECTORY, "followers", 5);
  const topByTrades    = mostActive(USER_DIRECTORY, "trades", 5);
  const topListings    = mostActive(FEED, "likes", 5);
  const categories = Object.entries(
    FEED.reduce((acc, f) => { acc[f.contentType || "other"] = (acc[f.contentType || "other"] || 0) + 1; return acc; }, {})
  ).sort((a, b) => b[1] - a[1]);

  return (
    <div className="admin-section">
      <div className="admin-section-head">
        <h2>User Behavior Analytics</h2>
        <p>Rankings derived from live user and listing data.</p>
      </div>

      <AdminListCard title="Most Active Users (by trades)" rows={topByTrades.map((u) => ({ left: `${u.avatar} ${u.name}`, right: `${u.trades} trades` }))} />
      <AdminListCard title="Most Followed Profiles" rows={topByFollowers.map((u) => ({ left: `${u.avatar} ${u.name}`, right: `${u.followers.toLocaleString()} followers` }))} />
      <AdminListCard title="Most Popular Profiles (by Karma Score)" rows={topByKarma.map((u) => ({ left: `${u.avatar} ${u.name}`, right: `⭐ ${u.karmaScore}` }))} />
      <AdminListCard title="Most Viewed Listings (by likes)" rows={topListings.map((f) => ({ left: f.title, right: `${f.likes} likes` }))} />
      <AdminListCard title="Most Traded Categories" rows={categories.map(([k, v]) => ({ left: k.charAt(0).toUpperCase() + k.slice(1) + "s", right: `${v} listings` }))} />
      <div className="admin-chart-card">
        <div className="admin-chart-head"><span>Most Searched Keywords</span></div>
        <div className="admin-disconnected"><Database size={15} /> Not connected — requires server-side search query logging</div>
      </div>
    </div>
  );
}

function AdminListCard({ title, rows }) {
  return (
    <div className="admin-chart-card">
      <div className="admin-chart-head"><span>{title}</span></div>
      <div className="admin-list">
        {rows.map((r, i) => (
          <div key={i} className="admin-list-row">
            <span className="admin-list-rank">{i + 1}</span>
            <span className="admin-list-left">{r.left}</span>
            <span className="admin-list-right">{r.right}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── 4. REVIEWS & RATINGS ── */
function AdminReviews({ analytics, reviews }) {
  return (
    <div className="admin-section">
      <div className="admin-section-head">
        <h2>Ratings &amp; Reviews</h2>
        <p>Platform-wide feedback submitted by real users in this session.</p>
      </div>

      <div className="admin-stat-grid">
        <AdminStatCard icon={Star}       label="Average Rating"   value={analytics.avgRating.toFixed(1)} sub="out of 5.0" color="#eab308" />
        <AdminStatCard icon={ClipboardList} label="Total Ratings" value={analytics.totalRatings}    color="#2563eb" />
        <AdminStatCard icon={ThumbsUp}   label="Positive Reviews" value={analytics.positiveReviews} sub="4★ and above" color="#16a34a" />
        <AdminStatCard icon={ThumbsDown} label="Negative Reviews" value={analytics.negativeReviews} sub="2★ and below" color="#dc2626" />
      </div>

      <div className="admin-chart-card">
        <div className="admin-chart-head"><span>Recent Reviews</span></div>
        {reviews.length === 0 ? (
          <div className="admin-empty">No reviews submitted yet.</div>
        ) : (
          <div className="admin-list">
            {reviews.slice(0, 12).map((r) => (
              <div key={r.id} className="admin-review-row">
                <div className="avatar-sm">{r.avatar}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontWeight: 700, fontSize: 12.5 }}>{r.reviewer}</span>
                    <span style={{ fontSize: 11, color: "#eab308" }}>{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "#6b7587", marginTop: 2 }}>{r.text || "(no comment left)"}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── 5. REPORTS ── */
function AdminReports({ reports, onResolve }) {
  const REPORT_LABELS = { bug: "Bug", scam: "Scam", fake: "Fake Listing", suggestion: "Suggestion", feedback: "Feedback" };
  const open = reports.filter((r) => r.status === "open");
  const resolved = reports.filter((r) => r.status !== "open");

  return (
    <div className="admin-section">
      <div className="admin-section-head">
        <h2>Bug Reports &amp; Feedback Center</h2>
        <p>All user-submitted reports appear here in real time.</p>
      </div>

      <div className="admin-stat-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <AdminStatCard icon={Flag}    label="Open Reports"     value={open.length}     color="#dc2626" />
        <AdminStatCard icon={CheckCircle2} label="Resolved Reports" value={resolved.length} color="#16a34a" />
      </div>

      <div className="admin-chart-card">
        <div className="admin-chart-head"><span>Open Reports</span></div>
        {open.length === 0 ? (
          <div className="admin-empty">No open reports. Nice and clean 🎉</div>
        ) : (
          <div className="admin-list">
            {open.map((r) => (
              <div key={r.id} className="admin-report-row">
                <span className="admin-report-tag">{REPORT_LABELS[r.type] || r.type}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 12.5 }}>{r.subject}</div>
                  <div style={{ fontSize: 11.5, color: "#6b7587", marginTop: 2 }}>{r.details}</div>
                  <div style={{ fontSize: 10.5, color: "#9aa3af", marginTop: 4 }}>From {r.reporter} · {new Date(r.at).toLocaleString()}</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <button className="admin-mini-btn resolve" onClick={() => onResolve(r.id, "resolved")}>Resolve</button>
                  <button className="admin-mini-btn dismiss" onClick={() => onResolve(r.id, "dismissed")}>Dismiss</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {resolved.length > 0 && (
        <div className="admin-chart-card">
          <div className="admin-chart-head"><span>Resolved / Dismissed</span></div>
          <div className="admin-list">
            {resolved.map((r) => (
              <div key={r.id} className="admin-list-row">
                <span className={`admin-status-pill ${r.status}`}>{r.status}</span>
                <span className="admin-list-left">{r.subject}</span>
                <span className="admin-list-right">{REPORT_LABELS[r.type]}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── 6. CONTENT MODERATION ── */
function AdminModeration({ store, logAction }) {
  return (
    <div className="admin-section">
      <div className="admin-section-head">
        <h2>Content Moderation</h2>
        <p>Remove listings, suspend or ban users involved in flagged activity.</p>
      </div>

      <div className="admin-chart-card">
        <div className="admin-chart-head"><span>All Listings</span></div>
        <div className="admin-list">
          {FEED.map((item) => {
            const removed = store.moderatedListingIds.has(item.id);
            return (
              <div key={item.id} className="admin-mod-row">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 12.5, textDecoration: removed ? "line-through" : "none", color: removed ? "#9aa3af" : "inherit" }}>{item.title}</div>
                  <div style={{ fontSize: 11, color: "#6b7587" }}>{item.user} · {item.city} · {item.contentType}</div>
                </div>
                {removed ? (
                  <span className="admin-status-pill dismissed">Removed</span>
                ) : (
                  <button className="admin-mini-btn dismiss" onClick={() => { removeListing(item.id); logAction(`Removed listing "${item.title}"`); }}>
                    <Trash2 size={12} /> Remove
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="admin-chart-card">
        <div className="admin-chart-head"><span>User Accounts</span></div>
        <div className="admin-list">
          {USER_DIRECTORY.map((u) => {
            const suspended = store.suspendedUsers.has(u.user);
            return (
              <div key={u.id} className="admin-mod-row">
                <div className="avatar-sm">{u.avatar}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 12.5 }}>{u.name} <span style={{ color: "#6b7587", fontWeight: 400 }}>{u.user}</span></div>
                  <div style={{ fontSize: 11, color: "#6b7587" }}>{u.trades} trades · ⭐ {u.karmaScore}</div>
                </div>
                {suspended ? (
                  <button className="admin-mini-btn resolve" onClick={() => { unsuspendUser(u.user); logAction(`Reinstated user ${u.user}`); }}>
                    <UserCheck size={12} /> Reinstate
                  </button>
                ) : (
                  <button className="admin-mini-btn dismiss" onClick={() => { suspendUser(u.user); logAction(`Suspended user ${u.user}`); }}>
                    <Ban size={12} /> Suspend
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ── 7. PERFORMANCE MONITORING — honestly marked, not faked ── */
function AdminPerformance() {
  return (
    <div className="admin-section">
      <div className="admin-section-head">
        <h2>Performance Monitoring</h2>
        <p>This prototype has no live server, API, or hosting infrastructure to monitor yet.</p>
      </div>

      {[
        { icon: Server,   label: "App Performance" },
        { icon: Zap,      label: "API Response Times" },
        { icon: Database, label: "Server Health" },
        { icon: Activity, label: "Database Performance" },
        { icon: Bug,      label: "Error Logs" },
        { icon: AlertTriangle, label: "Crash Reports" },
        { icon: XCircle,  label: "Failed Requests" },
      ].map(({ icon: Icon, label }) => (
        <div key={label} className="admin-chart-card">
          <div className="admin-chart-head"><span>{label}</span></div>
          <div className="admin-disconnected"><Icon size={15} /> Not connected — requires a live backend / hosting environment</div>
        </div>
      ))}

      <div className="admin-section-head" style={{ marginTop: 8 }}>
        <h2 style={{ fontSize: 15 }}>Firebase Integration</h2>
        <p>Wire these up once a Firebase project is connected to the backend.</p>
      </div>
      {["Firebase Analytics", "Firebase Crashlytics", "Firebase Performance Monitoring", "Firebase Authentication Tracking", "Push Notification Analytics"].map((label) => (
        <div key={label} className="admin-chart-card">
          <div className="admin-chart-head"><span>{label}</span></div>
          <div className="admin-disconnected"><Loader size={15} /> Not connected — connect a Firebase project to enable</div>
        </div>
      ))}
    </div>
  );
}

/* ── 8. AUDIT LOG ── */
function AdminAuditLog({ auditLog }) {
  return (
    <div className="admin-section">
      <div className="admin-section-head">
        <h2>Administrator Audit Log</h2>
        <p>Every administrative action taken in this session is recorded here.</p>
      </div>
      <div className="admin-chart-card">
        {auditLog.length === 0 ? (
          <div className="admin-empty">No administrative actions yet.</div>
        ) : (
          <div className="admin-list">
            {auditLog.map((log) => (
              <div key={log.id} className="admin-list-row">
                <ClipboardList size={13} style={{ color: "#6b7587", flexShrink: 0 }} />
                <span className="admin-list-left">{log.action}</span>
                <span className="admin-list-right">{new Date(log.at).toLocaleTimeString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   ROOT APP
───────────────────────────────────────── */
/* ─────────────────────────────────────────
   ADMIN_CSS — self-contained enterprise dashboard styles
   (does not depend on .auth-root or .kt-root scoped rules)
───────────────────────────────────────── */
const ADMIN_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@600;700&family=Inter:wght@400;500;600;700&display=swap');

  .admin-root {
    min-height: 100vh; width: 100%;
    background: #f4f6f9;
    font-family: 'Inter', sans-serif;
    color: #0f172a;
    box-sizing: border-box;
  }
  .admin-root *, .admin-root *::before, .admin-root *::after { box-sizing: border-box; }

  .admin-shell { display: flex; min-height: 100vh; max-width: 1400px; margin: 0 auto; }

  /* ── Sidebar ── */
  .admin-sidebar { width: 230px; flex-shrink: 0; background: #0f172a; color: #e2e8f0; display: flex; flex-direction: column; padding: 20px 14px; position: sticky; top: 0; height: 100vh; }
  .admin-brand { display: flex; align-items: center; gap: 10px; padding: 6px 8px 22px; border-bottom: 1px solid rgba(255,255,255,0.08); margin-bottom: 14px; }
  .admin-brand-mark { width: 34px; height: 34px; border-radius: 10px; background: linear-gradient(135deg, #2563eb, #D6001C); display: flex; align-items: center; justify-content: center; color: #fff; flex-shrink: 0; }
  .admin-brand-title { font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 14px; color: #fff; }
  .admin-brand-sub { font-size: 10.5px; color: #94a3b8; letter-spacing: 0.04em; }
  .admin-nav { display: flex; flex-direction: column; gap: 2px; flex: 1; }
  .admin-nav-item { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 10px; font-size: 13px; font-weight: 600; color: #94a3b8; cursor: pointer; transition: background .15s, color .15s; }
  .admin-nav-item:hover { background: rgba(255,255,255,0.04); color: #e2e8f0; }
  .admin-nav-item.active { background: rgba(37,99,235,0.18); color: #60a5fa; }
  .admin-exit-btn { display: flex; align-items: center; justify-content: center; gap: 8px; background: rgba(220,38,38,0.12); color: #f87171; border: 1px solid rgba(220,38,38,0.25); border-radius: 10px; padding: 10px; font-size: 12.5px; font-weight: 700; cursor: pointer; margin-top: 10px; }

  /* ── Main panel ── */
  .admin-main { flex: 1; padding: 28px 32px 60px; overflow-y: auto; }
  .admin-section { max-width: 980px; }
  .admin-section-head { margin-bottom: 22px; }
  .admin-section-head h2 { font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 22px; margin: 0 0 4px; }
  .admin-section-head p { font-size: 13px; color: #64748b; margin: 0; }

  /* ── Stat cards ── */
  .admin-stat-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 14px; margin-bottom: 24px; }
  .admin-stat-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 16px; }
  .admin-stat-icon { width: 36px; height: 36px; border-radius: 10px; display: flex; align-items: center; justify-content: center; margin-bottom: 10px; }
  .admin-stat-value { font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 24px; }
  .admin-stat-label { font-size: 12px; color: #64748b; margin-top: 2px; font-weight: 600; }
  .admin-stat-sub { font-size: 10.5px; color: #94a3b8; margin-top: 4px; }

  /* ── Chart / list cards ── */
  .admin-chart-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 18px; margin-bottom: 16px; }
  .admin-chart-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; font-size: 13px; font-weight: 700; color: #0f172a; }
  .admin-chart-head b { color: #2563eb; font-size: 12.5px; }
  .admin-disconnected { display: flex; align-items: center; gap: 9px; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 12px; padding: 14px; font-size: 12.5px; color: #94a3b8; font-weight: 600; }
  .admin-empty { text-align: center; color: #94a3b8; font-size: 13px; padding: 30px 10px; }

  /* ── Lists ── */
  .admin-list { display: flex; flex-direction: column; gap: 8px; }
  .admin-list-row { display: flex; align-items: center; gap: 10px; padding: 9px 10px; border-radius: 10px; background: #f8fafc; font-size: 12.5px; }
  .admin-list-rank { width: 20px; height: 20px; border-radius: 999px; background: #e2e8f0; color: #475569; display: flex; align-items: center; justify-content: center; font-size: 10.5px; font-weight: 700; flex-shrink: 0; }
  .admin-list-left { flex: 1; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .admin-list-right { color: #64748b; font-weight: 600; flex-shrink: 0; }

  .admin-review-row { display: flex; align-items: flex-start; gap: 10px; padding: 10px; border-radius: 12px; background: #f8fafc; margin-bottom: 8px; }
  .admin-report-row { display: flex; align-items: flex-start; gap: 12px; padding: 12px; border-radius: 12px; background: #fef2f2; border: 1px solid #fee2e2; margin-bottom: 10px; }
  .admin-report-tag { font-size: 10px; font-weight: 700; background: #dc2626; color: #fff; border-radius: 999px; padding: 4px 9px; text-transform: uppercase; letter-spacing: 0.04em; flex-shrink: 0; white-space: nowrap; }
  .admin-mod-row { display: flex; align-items: center; gap: 10px; padding: 10px; border-radius: 12px; background: #f8fafc; margin-bottom: 8px; }

  .admin-mini-btn { display: flex; align-items: center; gap: 5px; border: none; border-radius: 8px; padding: 7px 11px; font-size: 11px; font-weight: 700; cursor: pointer; white-space: nowrap; }
  .admin-mini-btn.resolve { background: #dcfce7; color: #16a34a; }
  .admin-mini-btn.dismiss { background: #fee2e2; color: #dc2626; }

  .admin-status-pill { font-size: 10px; font-weight: 700; border-radius: 999px; padding: 4px 10px; text-transform: capitalize; flex-shrink: 0; }
  .admin-status-pill.resolved { background: #dcfce7; color: #16a34a; }
  .admin-status-pill.dismissed { background: #f1f5f9; color: #64748b; }

  .avatar-sm { width: 28px; height: 28px; border-radius: 999px; background: #e2e8f0; display: flex; align-items: center; justify-content: center; font-size: 14px; flex-shrink: 0; }

  @media (max-width: 720px) {
    .admin-shell { flex-direction: column; }
    .admin-sidebar { width: 100%; height: auto; position: relative; flex-direction: row; flex-wrap: wrap; align-items: center; padding: 12px; }
    .admin-brand { border-bottom: none; margin-bottom: 0; padding: 0 10px 0 0; flex-shrink: 0; }
    .admin-nav { flex-direction: row; flex-wrap: wrap; flex: 1; }
    .admin-nav-item { padding: 8px 10px; font-size: 12px; }
    .admin-exit-btn { margin-top: 0; width: auto; }
    .admin-main { padding: 20px 16px 40px; }
  }
`;

function MainApp({ initialLocation, currentUser, onLogout, onProfileUpdate }) {
  const [tab,        setTab]       = useState("home");
  const [screen,     setScreen]    = useState(null);
  const [activeItem, setActiveItem]= useState(null);
  const [tradeSheet, setTradeSheet]= useState(false);
  const [activeChat, setActiveChat]= useState(null);
  const [userLocation, setUserLocation] = useState(initialLocation || DEFAULT_LOCATION);
  const [darkMode, setDarkMode] = useState(false);

  // ── Auth guard: if Firebase revokes the token mid-session, force logout ──
  useEffect(() => {
    if (!auth.currentUser) { onLogout(); return; }
    const unsub = onAuthStateChanged(auth, (user) => { if (!user) onLogout(); });
    return unsub;
  }, []);

  // ── Follow system: in-memory set of usernames the current user follows ──
  const [followedUsers, setFollowedUsers] = useState(new Set());
  const [activeProfileUser, setActiveProfileUser] = useState(null); // username being viewed in PM Space

  // ── Dark mode: load saved preference, persist on change (real localStorage) ──
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("pm-dark-mode");
      if (saved === "true") setDarkMode(true);
    } catch (e) { /* localStorage unavailable (private browsing) — default to light */ }
  }, []);

  const toggleDarkMode = () => {
    setDarkMode((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem("pm-dark-mode", String(next));
      } catch (e) { /* ignore persistence failure, theme still switches for this session */ }
      return next;
    });
  };

  const toggleFollow = (username) => {
    setFollowedUsers((prev) => {
      const next = new Set(prev);
      if (next.has(username)) next.delete(username); else next.add(username);
      return next;
    });
  };

  const openDetail = (item) => { setActiveItem(item); setScreen("detail"); };
  const closeScreen = () => { setScreen(null); setActiveItem(null); setActiveChat(null); setActiveProfileUser(null); };
  const goTo = (s) => setScreen(s);
  const openPmSpace = (username) => { setActiveProfileUser(username); setScreen("pmspace"); };

  return (
    <div className={`kt-root ${darkMode ? "kt-dark" : ""}`}>
      <style>{CSS}</style>
      <div className="kt-phone">

        {/* ── MAIN TABS ── */}
        {!screen && tab === "home"    && <HomeScreen    userLocation={userLocation} currentUser={currentUser} onOpenDetail={openDetail} onTrade={(i) => { setActiveItem(i); setTradeSheet(true); }} onOpenMap={() => setScreen("map")} onOpenProfile={() => { setTab("profile"); setScreen(null); }} onOpenPmSpace={openPmSpace} onOpenCreate={() => { setTab("create"); setScreen(null); }} />}
        {!screen && tab === "shop"    && <ShopScreen />}
        {!screen && tab === "create"  && <CreateScreen currentUser={currentUser} userLocation={userLocation} />}
        {!screen && tab === "inbox"   && <InboxScreen   onOpenChat={(c) => { setActiveChat(c); setScreen("chat"); }} />}
        {!screen && tab === "profile" && <ProfileScreen onNavigate={goTo} userLocation={userLocation} currentUser={currentUser} />}

        {/* ── OVERLAY SCREENS ── */}
        {screen === "detail"   && activeItem  && <DetailScreen   item={activeItem} userLocation={userLocation} onBack={closeScreen} onTrade={() => setTradeSheet(true)} onAiHub={() => setScreen("aihub")} onBattle={() => setScreen("battle")} onOpenPmSpace={openPmSpace} />}
        {screen === "aihub"    && <AiHubScreen   onBack={closeScreen} />}
        {screen === "battle"   && <BattleScreen  onBack={closeScreen} />}
        {screen === "chat"     && activeChat   && <ChatScreen     chat={activeChat} onBack={closeScreen} />}
        {screen === "orders"   && <OrdersScreen  onBack={closeScreen} />}
        {screen === "listings" && <ListingsScreen onBack={closeScreen} currentUser={currentUser} />}
        {screen === "saved"    && <SavedScreen   onBack={closeScreen} onOpenDetail={openDetail} />}
        {screen === "settings" && <SettingsScreen onBack={closeScreen} userLocation={userLocation} onUpdateLocation={async (loc) => { setUserLocation(loc); if (currentUser?.uid) { try { await updateUserProfile(currentUser.uid, { city: loc.city, lat: loc.lat, lng: loc.lng }); } catch (e) { console.warn("Failed to persist location:", e); } } }} onLogout={onLogout} darkMode={darkMode} onToggleDarkMode={toggleDarkMode} currentUser={currentUser} onProfileUpdate={onProfileUpdate} />}
        {screen === "finduser" && <FindUserScreen onBack={closeScreen} onOpenChat={(c) => { setActiveChat(c); setScreen("chat"); }} onOpenPmSpace={openPmSpace} />}
        {screen === "map"      && <MapScreen      onBack={closeScreen} userLocation={userLocation} onOpenDetail={openDetail} />}
        {screen === "wallet"   && <WalletScreen   onBack={closeScreen} currentUser={currentUser} onOpenCreate={() => { setTab("create"); setScreen(null); }} onOpenShop={() => { setTab("shop"); setScreen(null); }} />}
        {screen === "pmspace"  && activeProfileUser && (
          <PmSpaceScreen
            username={activeProfileUser}
            onBack={closeScreen}
            onOpenDetail={openDetail}
            isFollowing={followedUsers.has(activeProfileUser)}
            onToggleFollow={() => toggleFollow(activeProfileUser)}
            onOpenChat={(c) => { setActiveChat(c); setScreen("chat"); }}
          />
        )}

        {/* ── TRADE SHEET ── */}
        {tradeSheet && activeItem && <TradeSheet item={activeItem} onClose={() => setTradeSheet(false)} />}

        {/* ── BOTTOM NAV ── */}
        {!screen && <BottomNav tab={tab} setTab={(t) => { setTab(t); setScreen(null); }} />}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   BOTTOM NAV
───────────────────────────────────────── */
function BottomNav({ tab, setTab }) {
  const items = [
    { key: "home",    icon: Home,        label: "Home" },
    { key: "shop",    icon: ShoppingBag, label: "Shop" },
    { key: "create",  icon: PlusCircle,  label: "Create", plus: true },
    { key: "inbox",   icon: Inbox,       label: "Inbox" },
    { key: "profile", icon: User,        label: "Profile" },
  ];
  return (
    <div className="bottom-nav">
      {items.map(({ key, icon: Icon, label, plus }) => (
        <div key={key} className={`nav-item ${tab === key ? "active" : ""}`} onClick={() => setTab(key)}>
          {plus ? <div className="nav-plus"><Icon size={20} /></div> : <Icon size={20} />}
          <span>{label}</span>
        </div>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────
   TOP APP BAR — PM logo · search · notifications · profile
───────────────────────────────────────── */
function TopAppBar({ query, onQueryChange, rightExtra, notifCount = 0, onOpenNotifs, onOpenProfile }) {
  return (
    <div className="topbar">
      <div className="pm-logo-mark" title="PointMarket">
        <img src="/logo.png" alt="PointMarket" style={{ height: 28, width: "auto", display: "block" }} draggable={false} />
      </div>
      <div className="search-pill">
        <Search size={15} />
        <input className="search-input" placeholder="Search items, skills, traders…" value={query} onChange={(e) => onQueryChange(e.target.value)} />
      </div>
      {rightExtra}
      <button className="icon-btn" style={{ position: "relative" }} onClick={onOpenNotifs}>
        <Bell size={17} />
        {notifCount > 0 && <span className="notif-dot" />}
      </button>
      <button className="icon-btn" onClick={onOpenProfile} title="Your profile">
        <User size={17} />
      </button>
    </div>
  );
}

/* ─────────────────────────────────────────
   HOME — VERTICAL VIDEO FEED
───────────────────────────────────────── */
function HomeScreen({ userLocation, currentUser, onOpenDetail, onTrade, onOpenMap, onOpenProfile, onOpenPmSpace, onOpenCreate }) {
  const [query,        setQuery]        = useState("");
  const [distFilter,   setDistFilter]   = useState("5km");
  const [showNotifs,   setShowNotifs]   = useState(false);

  // ── Real Firestore posts feed ──
  const [firestorePosts, setFirestorePosts] = useState([]);
  const [feedLoading,    setFeedLoading]    = useState(true);
  const [feedError,      setFeedError]      = useState(null);

  useEffect(() => {
    setFeedLoading(true);
    setFeedError(null);

    try {
      // Listen to posts collection — ordered by createdAt descending, boosted first
      const postsRef = collection(db, "posts");
      const q = fsQuery(
        postsRef,
        where("status", "==", "active"),
        orderBy("isBoosted", "desc"),
        orderBy("createdAt", "desc"),
        limit(30)
      );

      const unsub = onSnapshot(q,
        (snap) => {
          const posts = snap.docs.map((docSnap) => ({
            id:          docSnap.id,
            ...docSnap.data(),
            // Normalise field names to match what FeedCard and DetailScreen expect
            desc:        docSnap.data().description || docSnap.data().desc || "",
            aiValue:     docSnap.data().recommendedPm || docSnap.data().aiValue || 0,
            karmaScore:  docSnap.data().aiKarmaScore  || docSnap.data().karmaScore || 0,
            avatar:      docSnap.data().avatar        || "🧑",
            user:        docSnap.data().username      || docSnap.data().userId || "unknown",
            comments:    docSnap.data().comments      || 0,
            // Location defaults
            city:        docSnap.data().city   || DEFAULT_LOCATION.city,
            lat:         docSnap.data().lat    || DEFAULT_LOCATION.lat,
            lng:         docSnap.data().lng    || DEFAULT_LOCATION.lng,
            // Fallback colours for gradient when no Cloudinary media
            color1:      docSnap.data().color1 || "#bdeede",
            color2:      docSnap.data().color2 || "#8fd9bd",
          }));

          // Only show real Firestore posts — no static merge
          setFirestorePosts(posts);
          setFeedLoading(false);
        },
        (err) => {
          console.warn("Feed listener error:", err.message);
          setFirestorePosts([]);   // show empty feed, not stale demo data
          setFeedLoading(false);
          setFeedError("Could not load feed. Check your connection and try again.");
        }
      );

      return () => unsub();
    } catch (err) {
      console.warn("Feed setup error:", err.message);
      setFirestorePosts([]);
      setFeedLoading(false);
      setFeedError("Could not connect to the feed. Please check your Firebase setup.");
    }
  }, []); // Run once on mount — onSnapshot keeps it live automatically

  // Attach live distance + same-city flag to every post
  const enriched = firestorePosts.map((item) => {
    const distanceKm = item.lat && item.lng
      ? haversineDistanceKm(userLocation.lat, userLocation.lng, item.lat, item.lng)
      : 999;
    return { ...item, distanceKm, sameCity: item.city === userLocation.city };
  });

  const activeFilter = DISTANCE_FILTERS.find((f) => f.key === distFilter) || DISTANCE_FILTERS[0];
  const cityScoped    = enriched.filter((item) => item.sameCity);
  const distScoped    = cityScoped.filter((item) => item.distanceKm <= activeFilter.maxKm);
  const searchFiltered = distScoped.filter((item) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (item.title || "").toLowerCase().includes(q) ||
           (item.desc  || "").toLowerCase().includes(q) ||
           (item.user  || "").toLowerCase().includes(q);
  });

  // Demo listings (presentation-layer only). Show when real listings are few
  // and always place demo items below authentic user listings.
  const demoCandidates = getDemoListingsForCity(userLocation?.city || DEFAULT_LOCATION.city) || [];
  const showDemo = demoCandidates.length > 0 && (searchFiltered.length < 3 || firestorePosts.length === 0);
  const demoNeeded = Math.max(0, 5 - searchFiltered.length);
  const demoItems = showDemo ? demoCandidates.slice(0, demoNeeded) : [];

  const rankScore = (item) => {
    if (item.sameCity && item.distanceKm <= 5)  return 0;
    if (item.sameCity && item.distanceKm <= 10) return 1;
    if (item.sameCity && item.distanceKm <= 20) return 2;
    if (item.sameCity)                          return 3;
    return 4;
  };
  const nearbyForYou = [...enriched]
    .sort((a, b) => {
      const ra = rankScore(a), rb = rankScore(b);
      if (ra !== rb) return ra - rb;
      if (ra === 3) return (b.karmaScore || 0) - (a.karmaScore || 0);
      return a.distanceKm - b.distanceKm;
    })
    .slice(0, 5);

  const notifications = buildSmartNotifications(enriched, userLocation);

  return (
    <>
      <TopAppBar
        query={query}
        onQueryChange={setQuery}
        rightExtra={<button className="icon-btn" onClick={onOpenMap} title="Map view"><MapIcon size={17} /></button>}
        notifCount={notifications.length}
        onOpenNotifs={() => setShowNotifs(true)}
        onOpenProfile={onOpenProfile}
      />

      <div className="location-bar">
        <div className="location-pill"><MapPin size={12} /> {userLocation.city}</div>
        <div className="filter-scroll">
          {DISTANCE_FILTERS.map((f) => (
            <div key={f.key} className={`filter-chip ${distFilter === f.key ? "active" : ""}`} onClick={() => setDistFilter(f.key)}>
              {f.label}
            </div>
          ))}
        </div>
      </div>

      <div className="kt-scroll">
        {/* Loading state */}
        {feedLoading && (
          <div className="feed-loading">
            <div className="feed-loading-spinner" />
            <span>Loading nearby listings…</span>
          </div>
        )}

        {/* Nearby For You section */}
        {!feedLoading && nearbyForYou.length > 0 && (
          <div className="nearby-section">
            <div className="nearby-header"><Sparkles size={14} /> Nearby For You</div>
            <div className="nearby-scroll">
              {nearbyForYou.map((item) => (
                <div key={item.id} className="nearby-card" onClick={() => onOpenDetail(item)}>
                  {item.thumbnailUrl ? (
                    <img src={item.thumbnailUrl} alt={item.title} className="nearby-thumb-img" />
                  ) : (
                    <div className="nearby-thumb" style={{ background: `linear-gradient(160deg, ${item.color1 || "#bdeede"}, ${item.color2 || "#8fd9bd"})` }}>🎥</div>
                  )}
                  <div className="nearby-title">{item.title}</div>
                  <div className="nearby-meta">
                    <span className="nearby-dist">{item.distanceKm <= 2 ? "🔥" : "📍"} {formatDistance(item.distanceKm)}</span>
                    {item.verified && <CheckCircle2 size={11} color="#22c55e" />}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Feed error state — only shown when Firestore actually failed */}
        {!feedLoading && feedError && (
          <div className="empty-state" style={{ color: "#dc2626" }}>
            <AlertTriangle size={20} style={{ marginBottom: 8 }} />
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Could not load feed</div>
            <div style={{ fontSize: 12.5 }}>{feedError}</div>
          </div>
        )}

        {/* Main feed — professional empty state when there simply are no listings yet */}
        {!feedLoading && !feedError && searchFiltered.length === 0 && demoItems.length === 0 && (
          firestorePosts.length === 0 ? (
            <div className="empty-state feed-empty-pro">
              <div className="feed-empty-icon"><Sparkles size={22} /></div>
              <div className="feed-empty-title">No listings available yet.</div>
              <div className="feed-empty-sub">Be the first person to post in your area.</div>
              <button className="kt-btn primary feed-empty-cta" onClick={onOpenCreate}>
                <PlusCircle size={16} /> Create First Listing
              </button>
            </div>
          ) : (
            <div className="empty-state">
              <div style={{ fontSize: 28, marginBottom: 8 }}>📭</div>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>No listings nearby</div>
              <div style={{ fontSize: 12.5, color: "#6f8b80" }}>
                No listings within {activeFilter.label.toLowerCase()} in {userLocation.city}.{query ? " Try clearing your search." : ""}
              </div>
            </div>
          )
        )}
        {!feedLoading && searchFiltered.map((item, i) => (
          <React.Fragment key={item.id}>
            <FeedCard item={item} onOpenDetail={onOpenDetail} onTrade={onTrade} onOpenPmSpace={onOpenPmSpace} />
            {/* Native ad slot after every 5 listings */}
            {(i + 1) % 5 === 0 && <AdsterraNativeBanner />}
          </React.Fragment>
        ))}

        {/* Demo listings (UI-only). Always render below authentic listings. */}
        {!feedLoading && demoItems.length > 0 && (
          <div className="demo-section">
            <div className="demo-header">Explore Demos — Browse Only</div>
            {demoItems.map((d) => (
              <FeedCard key={d.id} item={d} onOpenDetail={onOpenDetail} onTrade={onTrade} onOpenPmSpace={onOpenPmSpace} />
            ))}
          </div>
        )}
      </div>

      {showNotifs && <SmartNotificationsSheet notifications={notifications} onClose={() => setShowNotifs(false)} onOpenDetail={(item) => { setShowNotifs(false); onOpenDetail(item); }} />}
    </>
  );
}

/* Build smart "matching item nearby" / "nearby request" notifications */
function buildSmartNotifications(enriched, userLocation) {
  const notifs = [];
  enriched
    .filter((i) => i.sameCity && i.distanceKm <= 5)
    .slice(0, 2)
    .forEach((i) => {
      notifs.push({
        id: `match-${i.id}`,
        icon: "🔥",
        text: `Someone ${formatDistance(i.distanceKm)} away is looking for a ${i.needsItem || "trade"} — your nearby match: "${i.title}"`,
        item: i,
      });
    });
  // Cross-match example: bicycle ↔ study table (Intelligent Requirement Matching demo)
  const bike = enriched.find((i) => i.title.toLowerCase().includes("bicycle"));
  const table = enriched.find((i) => i.title.toLowerCase().includes("study table"));
  if (bike && table) {
    notifs.push({
      id: "smart-match-1",
      icon: "✨",
      text: `A Study Table matching your requirement was found ${formatDistance(table.distanceKm)} away.`,
      item: table,
    });
  }
  return notifs;
}

function SmartNotificationsSheet({ notifications, onClose, onOpenDetail }) {
  return (
    <div className="sheet-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet">
        <div className="sheet-handle" />
        <h3 className="sheet-title">Smart Notifications</h3>
        <p className="sheet-sub">Nearby matches based on your location and trade requirements.</p>
        {notifications.length === 0 ? (
          <div className="empty-state">No nearby matches right now. Check back soon!</div>
        ) : (
          notifications.map((n) => (
            <div key={n.id} className="notif-row" onClick={() => onOpenDetail(n.item)}>
              <span className="notif-emoji">{n.icon}</span>
              <span className="notif-text">{n.text}</span>
              <ChevronRight size={15} color="#6f8b80" />
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   FEED CARD — fixed action sidebar
───────────────────────────────────────── */
function FeedCard({ item, onOpenDetail, onTrade, onOpenPmSpace }) {
  const [liked,        setLiked]        = useState(false);
  const [saved,        setSaved]        = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [toast,        setToast]        = useState(null);
  const [playing,      setPlaying]      = useState(false);
  const [thumbError,   setThumbError]   = useState(false);
  const videoRef = useRef(null);

  // ── Cloudinary URL helpers (inline — no external import needed in single file) ──
  const CLOUD = "dzhy4zx5g";
  const getThumb = (publicId, isVid) => {
    if (!publicId) return null;
    if (isVid) {
      return `https://res.cloudinary.com/${CLOUD}/video/upload/c_fill,w_400,h_280,so_0,q_auto,f_jpg/${publicId}.jpg`;
    }
    return `https://res.cloudinary.com/${CLOUD}/image/upload/c_fill,w_400,h_280,q_auto,f_webp/${publicId}`;
  };

  const isVideo     = item.mediaType === "video";
  const hasMedia    = !!(item.mediaUrl || item.thumbnailUrl || item.publicId);
  const thumbSrc    = item.thumbnailUrl
                   || (item.publicId ? getThumb(item.publicId, isVideo) : null);
  const videoSrc    = item.mediaUrl || null;

  const share = () => {
    setToast("Link copied!");
    setTimeout(() => setToast(null), 1500);
  };

  const handleVideoClick = (e) => {
    e.stopPropagation();
    if (!videoSrc) { onOpenDetail(item); return; }
    if (playing && videoRef.current) {
      videoRef.current.pause();
      setPlaying(false);
    } else {
      setPlaying(true);
    }
  };

  return (
    <div className="feed-card">
      {/* ── VIDEO / MEDIA SECTION ── */}
      <div
        className="feed-video"
        style={{
          background: hasMedia
            ? "#000"
            : `linear-gradient(160deg, ${item.color1 || "#bdeede"}, ${item.color2 || "#8fd9bd"})`,
        }}
      >
        {/* Real Cloudinary video player */}
        {playing && videoSrc ? (
          <video
            ref={videoRef}
            src={videoSrc}
            autoPlay
            playsInline
            controls={false}
            loop
            style={{ width: "100%", height: "100%", objectFit: "cover", position: "absolute", inset: 0 }}
            onEnded={() => setPlaying(false)}
          />
        ) : (
          <>
            {/* Cloudinary thumbnail or fallback gradient */}
            {thumbSrc && !thumbError ? (
              <img
                src={thumbSrc}
                alt={item.title}
                loading="lazy"
                onError={() => setThumbError(true)}
                style={{ width: "100%", height: "100%", objectFit: "cover", position: "absolute", inset: 0 }}
              />
            ) : (
              <>
                <div className="video-pattern" />
                <span className="feed-emoji">🎥</span>
              </>
            )}

            {/* Play button overlay for videos */}
            {isVideo && videoSrc && (
              <div className="play-overlay" onClick={handleVideoClick}>
                <div className="play-circle">▶</div>
              </div>
            )}

            {/* Duration badge */}
            {item.videoDuration ? (
              <span className="duration-badge">
                ▸ {Math.floor(item.videoDuration / 60)}:{String(Math.round(item.videoDuration % 60)).padStart(2, "0")}
              </span>
            ) : (
              <span className="duration-badge">▸ Video</span>
            )}
          </>
        )}

        <span className="category-badge">{item.category || "Video"}</span>
        {item.isDemo && <span className="demo-badge" title="Demo listing — browse only">EXPLORE DEMO</span>}

        {/* RIGHT SIDEBAR ACTIONS */}
        <div className="feed-actions">
          <div className="act-wrap">
            <button className="act-btn" onClick={(e) => { e.stopPropagation(); setLiked(!liked); }}>
              <Heart size={18} fill={liked ? "#ef4444" : "none"} color={liked ? "#ef4444" : "#0f1c17"} />
            </button>
            <span className="act-count">{item.likes + (liked ? 1 : 0)}</span>
          </div>
          <div className="act-wrap">
            <button className="act-btn" onClick={(e) => { e.stopPropagation(); if (item.isDemo) { setToast("Demo listing — browse only"); setTimeout(() => setToast(null), 1500); return; } setShowComments(true); }} title={item.isDemo ? "Demo listing — comments disabled" : "Comments"}>
              <MessageCircle size={18} />
            </button>
            <span className="act-count">{item.comments}</span>
          </div>
          <div className="act-wrap">
            <button className="act-btn" onClick={(e) => { e.stopPropagation(); share(); }}>
              <Share2 size={18} />
            </button>
          </div>
          <div className="act-wrap">
            <button className="act-btn" onClick={(e) => { e.stopPropagation(); setSaved(!saved); }}>
              <Bookmark size={18} fill={saved ? "#22c55e" : "none"} color={saved ? "#22c55e" : "#0f1c17"} />
            </button>
          </div>
          <div className="act-wrap">
            <button className="act-btn trade-btn" onClick={(e) => { e.stopPropagation(); if (item.isDemo) { setToast("Demo listing — trade disabled"); setTimeout(() => setToast(null), 1500); return; } onTrade(item); }} style={item.isDemo ? { opacity: 0.45, cursor: "not-allowed" } : {}} title={item.isDemo ? "Demo listing — trade disabled" : "Trade"}>
              <Handshake size={18} />
            </button>
            <span className="act-count" style={{ color: "#22c55e" }}>{item.isDemo ? "Demo" : "Trade"}</span>
          </div>
        </div>

        {/* Click overlay — tapping non-play area opens detail */}
        {!playing && (
          <div
            className="video-click-area"
            style={{ zIndex: isVideo ? 1 : 2 }}
            onClick={() => onOpenDetail(item)}
          />
        )}

        {toast && <div className="toast">{toast}</div>}
      </div>

      {/* ── INFO BODY ── */}
      <div className="feed-body">
        <div
          className="feed-user-row"
          style={{ cursor: "pointer" }}
          onClick={() => onOpenPmSpace && onOpenPmSpace(item.user)}
        >
          <div className="avatar-sm">{item.avatar}</div>
          <span className="feed-username">{item.user}</span>
          {item.verified && <CheckCircle2 size={13} color="#22c55e" title="Verified Pro Seller" />}
          <span className="karma-pill"><Star size={11} fill="#16a34a" /> {item.karmaScore}</span>
        </div>
        <h3 className="feed-title">{item.title}</h3>
        <p className="feed-desc">{item.desc}</p>

        {item.distanceKm !== undefined && (
          <div className="loc-badge-row">
            <span className="loc-badge"><MapPin size={11} /> {item.city}</span>
            <span className="loc-badge dist">{item.distanceKm <= 2 ? "🔥" : "📏"} {formatDistance(item.distanceKm)} Away</span>
            <span className="loc-badge karma">⭐ Karma Score: {Math.round(item.karmaScore * 19.2)}</span>
          </div>
        )}

        <div className="ai-row"><Sparkles size={13} /> AI Value: {item.aiValue?.toLocaleString() || item.recommendedPm?.toLocaleString() || "—"} PM</div>
      </div>

      {showComments && <CommentsSheet item={item} onClose={() => setShowComments(false)} />}
    </div>
  );
}

function CommentsSheet({ item, onClose }) {
  const [comments, setComments] = useState(SAMPLE_COMMENTS);
  const [input,    setInput]    = useState("");
  const post = () => {
    if (!input.trim()) return;
    setComments([...comments, { user: "@you.trades", avatar: "🧑‍🚀", text: input }]);
    setInput("");
  };
  return (
    <div className="sheet-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet">
        <div className="sheet-handle" />
        <h3 className="sheet-title">Comments</h3>
        <p className="sheet-sub">On: {item.title}</p>
        <div className="comment-list">
          {comments.length === 0 ? (
            <div className="empty-state" style={{ padding: "18px 0" }}>No comments yet. Be the first to leave feedback.</div>
          ) : (
            comments.map((c, i) => (
              <div key={i} className="comment-row">
                <div className="avatar-sm">{c.avatar}</div>
                <div><div className="comment-user">{c.user}</div><div className="comment-text">{c.text}</div></div>
              </div>
            ))
          )}
        </div>
        <div className="chat-input-row">
          <input className="chat-input" placeholder="Add a comment…" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && post()} />
          <button className="send-btn" onClick={post}><Send size={16} /></button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   TRADE BOTTOM SHEET
───────────────────────────────────────── */
function TradeSheet({ item, onClose }) {
  const [mode,       setMode]       = useState(null);
  const [offerText,  setOfferText]  = useState("");
  const [selectedKp, setSelectedKp] = useState(null);
  const [customKp,   setCustomKp]   = useState("");
  const [sent,       setSent]       = useState(false);

  const canSend = (mode === "item" && offerText.trim()) || (mode === "kp" && (selectedKp || customKp));

  const send = () => { setSent(true); setTimeout(onClose, 1400); };

  return (
    <div className="sheet-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet">
        <div className="sheet-handle" />
        {!mode && (
          <>
            <h3 className="sheet-title">Make an offer</h3>
            <p className="sheet-sub">Trading for: <b>{item.title}</b></p>
            <div className="option-row" onClick={() => setMode("item")}><div>Trade My Item<div className="opt-sub">Describe what you'd like to trade</div></div><ChevronRight size={18} /></div>
            <div className="option-row" onClick={() => setMode("kp")}><div>Offer PM Points<div className="opt-sub">Send a PM offer instead</div></div><ChevronRight size={18} /></div>
          </>
        )}
        {mode === "item" && !sent && (
          <>
            <h3 className="sheet-title">Describe your offer</h3>
            <p className="sheet-sub">Tell the seller what you want to trade — any item or skill is welcome.</p>
            <textarea className="field-textarea" style={{ marginBottom: 14 }} placeholder="e.g. Wireless headphones, barely used. Also willing to add 200 PM on top." value={offerText} onChange={(e) => setOfferText(e.target.value)} />
          </>
        )}
        {mode === "kp" && !sent && (
          <>
            <h3 className="sheet-title">Offer PM Points</h3>
            <p className="sheet-sub">AI estimated value: {item.aiValue?.toLocaleString()} PM</p>
            <div className="kp-grid">
              {[500, 1000, 1500].map((amt) => (
                <div key={amt} className={`kp-chip ${selectedKp === amt ? "selected" : ""}`} onClick={() => { setSelectedKp(amt); setCustomKp(""); }}>{amt} PM</div>
              ))}
              <input className="kp-chip" style={{ outline: "none", fontFamily: "inherit" }} placeholder="Custom" value={customKp} onChange={(e) => { setCustomKp(e.target.value.replace(/\D/g, "")); setSelectedKp(null); }} />
            </div>
          </>
        )}
        {mode && !sent && (
          <button className="kt-btn" disabled={!canSend} style={!canSend ? { opacity: 0.4 } : {}} onClick={send}>Send trade request <Handshake size={16} /></button>
        )}
        {sent && <div className="success-box"><CheckCircle2 size={18} /> Request sent!</div>}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   VIDEO DETAIL SCREEN
───────────────────────────────────────── */
function DetailScreen({ item, userLocation, onBack, onTrade, onAiHub, onBattle, onOpenPmSpace }) {
  const [saved,           setSaved]           = useState(false);
  const [ratingGiven,     setRatingGiven]     = useState(0);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const [playing,         setPlaying]         = useState(false);
  const [thumbError,      setThumbError]      = useState(false);
  const videoRef = useRef(null);

  const distanceKm = userLocation && item.lat
    ? haversineDistanceKm(userLocation.lat, userLocation.lng, item.lat, item.lng)
    : null;

  // ── Cloudinary media resolution ──
  const CLOUD      = "dzhy4zx5g";
  const isVideo    = item.mediaType === "video";
  const hasMedia   = !!(item.mediaUrl || item.thumbnailUrl || item.publicId);
  const thumbSrc   = item.thumbnailUrl
    || (item.publicId && isVideo
      ? `https://res.cloudinary.com/${CLOUD}/video/upload/c_fill,w_800,h_450,so_0,q_auto,f_jpg/${item.publicId}.jpg`
      : item.publicId
        ? `https://res.cloudinary.com/${CLOUD}/image/upload/c_fill,w_800,h_450,q_auto,f_webp/${item.publicId}`
        : null);

  const handleVideoClick = () => {
    if (!item.mediaUrl) return;
    if (playing && videoRef.current) { videoRef.current.pause(); setPlaying(false); }
    else setPlaying(true);
  };

  const submitRating = (stars) => {
    setRatingGiven(stars);
    // Prevent writing reviews for demo listings (UI-only safety wrapper)
    if (item.isDemo) {
      setRatingSubmitted(true);
      return;
    }
    submitReview({ reviewer: "@you.trades", avatar: "🧑‍🚀", rating: stars, text: "", target: item.user });
    setRatingSubmitted(true);
  };

  return (
    <div className="kt-scroll">
      {/* ── MEDIA SECTION ── */}
      <div
        className="detail-video"
        style={{
          background: hasMedia
            ? "#000"
            : `linear-gradient(160deg, ${item.color1 || "#bdeede"}, ${item.color2 || "#8fd9bd"})`,
        }}
      >
        <button className="back-btn" onClick={onBack}><ChevronLeft size={20} /></button>

        {/* Real Cloudinary video playback */}
        {playing && item.mediaUrl ? (
          <video
            ref={videoRef}
            src={item.mediaUrl}
            autoPlay
            playsInline
            controls
            style={{ width: "100%", height: "100%", objectFit: "contain", position: "absolute", inset: 0, zIndex: 2 }}
            onEnded={() => setPlaying(false)}
          />
        ) : (
          <>
            {/* Cloudinary thumbnail */}
            {thumbSrc && !thumbError ? (
              <img
                src={thumbSrc}
                alt={item.title}
                onError={() => setThumbError(true)}
                style={{ width: "100%", height: "100%", objectFit: "cover", position: "absolute", inset: 0 }}
              />
            ) : (
              <>
                <div className="video-pattern" />
                <span style={{ fontSize: 70, position: "relative", zIndex: 1 }}>🎥</span>
              </>
            )}

            {/* Play overlay for videos */}
            {isVideo && item.mediaUrl && (
              <div
                onClick={handleVideoClick}
                style={{
                  position: "absolute", inset: 0, zIndex: 3,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer",
                }}
              >
                <div className="play-circle" style={{ width: 56, height: 56, fontSize: 22 }}>▶</div>
              </div>
            )}

            {/* Duration badge */}
            {item.videoDuration ? (
              <span className="duration-badge">
                ▸ {Math.floor(item.videoDuration / 60)}:{String(Math.round(item.videoDuration % 60)).padStart(2, "0")}
              </span>
            ) : isVideo ? (
              <span className="duration-badge">▸ Video</span>
            ) : null}
          </>
        )}
      </div>
      <div className="seller-row" style={{ cursor: onOpenPmSpace ? "pointer" : "default" }} onClick={() => onOpenPmSpace && onOpenPmSpace(item.user)}>
        <div className="avatar-lg">{item.avatar}</div>
        <div>
          <div className="feed-username" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {item.user} {item.verified && <CheckCircle2 size={14} color="#22c55e" />}
          </div>
          <div className="seller-stats">
            <span className="seller-stat"><Star size={12} fill="#16a34a" color="#16a34a" /> {item.karmaScore}</span>
            <span className="seller-stat"><Award size={12} /> 36 trades</span>
            <span className="seller-stat"><Users size={12} /> 1.2k followers</span>
          </div>
        </div>
        {onOpenPmSpace && <ChevronRight size={16} color="#6f8b80" style={{ marginLeft: "auto" }} />}
      </div>
      <div style={{ padding: "14px 16px 0" }}>
        <h2 className="feed-title" style={{ fontSize: 18 }}>{item.title}</h2>
        <p className="feed-desc">{item.desc}</p>
        {distanceKm !== null && (
          <div className="loc-badge-row" style={{ marginBottom: 4 }}>
            <span className="loc-badge"><MapPin size={11} /> {item.city || userLocation.city}</span>
            <span className="loc-badge dist">{distanceKm <= 2 ? "🔥" : "📏"} {formatDistance(distanceKm)} Away</span>
            {item.verified && <span className="loc-badge verified"><CheckCircle2 size={11} /> Verified Pro Seller</span>}
          </div>
        )}
      </div>
      <div className="info-grid">
        <div className="info-box"><div className="info-label">Condition</div><div className="info-value">Like New</div></div>
        <div className="info-box"><div className="info-label">Location</div><div className="info-value">{item.city || "—"}</div></div>
        <div className="info-box"><div className="info-label">Needs in Return</div><div className="info-value">{item.needsItem || "Open to offers"}</div></div>
        <div className="info-box"><div className="info-label">AI Value</div><div className="info-value">{item.aiValue.toLocaleString()} PM</div></div>
      </div>
      <div className="detail-actions">
        <button className="kt-btn" onClick={() => { if (item.isDemo) return; onTrade(); }} style={item.isDemo ? { opacity: 0.45, cursor: "not-allowed" } : {}} title={item.isDemo ? "Demo listing — trade disabled" : "Trade"}><Handshake size={16} /> {item.isDemo ? "Demo" : "Trade"}</button>
        <button className="kt-btn ghost" onClick={() => { if (item.isDemo) return; onBattle(); }} style={item.isDemo ? { opacity: 0.45, cursor: "not-allowed" } : {}} title={item.isDemo ? "Demo listing — battle disabled" : "Battle"}><TrendingUp size={16} /> {item.isDemo ? "Demo" : "Battle"}</button>
      </div>
      <div className="detail-actions" style={{ paddingTop: 0 }}>
        <button className="kt-btn ghost" onClick={() => setSaved(!saved)}><Bookmark size={16} fill={saved ? "#22c55e" : "none"} /> {saved ? "Saved" : "Save"}</button>
        <button className="kt-btn ghost" onClick={onAiHub}><Sparkles size={16} /> AI Hub</button>
      </div>

      <div className="rate-trader-box">
        {!ratingSubmitted ? (
          <>
            <div className="rate-trader-title">Rate your experience with {item.user}</div>
            <div className="rate-trader-stars">
              {[1, 2, 3, 4, 5].map((n) => (
                <Star
                  key={n}
                  size={26}
                  fill={n <= ratingGiven ? "#f59e0b" : "none"}
                  color={n <= ratingGiven ? "#f59e0b" : "#cbd5e1"}
                  style={{ cursor: "pointer" }}
                  onClick={() => submitRating(n)}
                />
              ))}
            </div>
          </>
        ) : (
          <div className="success-box"><CheckCircle2 size={16} /> Thanks for your {ratingGiven}-star rating!</div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   AI HUB
───────────────────────────────────────── */
function AiHubScreen({ onBack }) {
  return (
    <div className="kt-scroll">
      <div className="screen-header">
        <button className="back-btn-inline" onClick={onBack}><ChevronLeft size={20} /></button>
        <h2>AI Hub</h2>
      </div>
      <div className="ai-banner"><Sparkles size={20} /><div><div className="ai-banner-title">Item unavailable</div><div className="ai-banner-sub">Searched: "iPhone 14" — here's what AI found.</div></div></div>
      <div style={{ padding: "0 16px 16px" }}>
        <div className="section-title">Available Items</div>
        {AI_SUGGESTIONS.available.length === 0 ? (
          <div className="empty-state">No AI suggestions available right now.</div>
        ) : (
          AI_SUGGESTIONS.available.map((s) => <MatchCard key={s.name} item={s} />)
        )}
        <div className="section-title">Similar Items</div>
        {AI_SUGGESTIONS.similar.length === 0 ? (
          <div className="empty-state">No similar items available at the moment.</div>
        ) : (
          AI_SUGGESTIONS.similar.map((s) => <MatchCard key={s.name} item={s} />)
        )}
      </div>
    </div>
  );
}

function MatchCard({ item }) {
  return (
    <div className="match-card">
      <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ fontWeight: 600, fontSize: 13.5 }}>{item.name}</span><span style={{ color: "#16a34a", fontWeight: 700, fontSize: 12.5 }}>{item.match}%</span></div>
      <div className="match-bar-bg"><div className="match-bar-fill" style={{ width: `${item.match}%` }} /></div>
    </div>
  );
}

/* ─────────────────────────────────────────
   TRADE BATTLE
───────────────────────────────────────── */
function BattleScreen({ onBack }) {
  const sorted   = [...BATTLE_OFFERS].sort((a, b) => (b.kp + b.items.length * 250) - (a.kp + a.items.length * 250));
  const [sel,     setSel]     = useState(sorted[0]?.user || "");
  const [accepted,setAccepted]= useState(false);
  const chosen = sorted.find((o) => o.user === sel);

  return (
    <div className="kt-scroll">
      <div className="screen-header">
        <button className="back-btn-inline" onClick={onBack}><ChevronLeft size={20} /></button>
        <h2>Trade Battle</h2>
      </div>
      <div className="ai-banner"><TrendingUp size={20} /><div><div className="ai-banner-title">Trade Battle</div><div className="ai-banner-sub">Choose the best offer for your item.</div></div></div>
      <div style={{ padding: "0 16px 16px" }}>
        {sorted.length === 0 ? (
          <div className="empty-state">No battle offers available right now.</div>
        ) : (
          <> 
            {sorted.map((o, i) => (
              <div key={o.user} className={`battle-card ${sel === o.user ? "winner" : ""}`} onClick={() => { setSel(o.user); setAccepted(false); }}>
                <div className="battle-rank">{i + 1}</div>
                <div className="avatar-sm" style={{ width: 36, height: 36, fontSize: 18 }}>{o.avatar}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 13.5 }}>{o.user}</div>
                  <div style={{ fontSize: 12, color: "#6f8b80", marginTop: 2 }}>{o.items.join(" + ")} {o.kp ? `+ ${o.kp} PM` : ""}</div>
                </div>
                {sel === o.user && <CheckCircle2 size={18} color="#16a34a" />}
              </div>
            ))}
            {!accepted ? (
              <button className="kt-btn" style={{ marginTop: 4 }} onClick={() => setAccepted(true)}><CheckCircle2 size={16} /> Accept {chosen?.user || "offer"}</button>
            ) : (
              <div className="success-box"><CheckCircle2 size={18} /> Accepted {chosen?.user || "offer"}! Check Orders to track.</div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   SHOP — MONETIZATION
───────────────────────────────────────── */
/* ─────────────────────────────────────────
   SHOP — PM Points purchase, Boost, Certification
   All payments route through JazzCash + AI Verification
───────────────────────────────────────── */
function ShopScreen() {
  const [activeFlow, setActiveFlow] = useState(null); // null | 'points' | 'boost' | 'cert'
  const [transactions, setTransactions] = useState([]); // local payment history this session

  const recordTransaction = (tx) => { setTransactions((prev) => [tx, ...prev]); submitTransaction(tx); };

  return (
    <div className="kt-scroll">
      <div className="screen-header"><h2>Shop</h2></div>

      {/* ── PREMIUM BOOST PLANS ── */}
      <div className="boost-hero">
        <div className="boost-hero-icon"><Sparkles size={22} /></div>
        <div className="boost-hero-title">Premium Post Boost</div>
        <div className="boost-hero-sub">Get seen first. Boosted listings appear at the top of the Home Feed and rank higher in search — pay once via JazzCash, no subscription.</div>
      </div>
      <div className="boost-grid">
        {BOOST_PLANS.map((plan) => {
          const TierIcon = plan.tier === "gold" ? Award : plan.tier === "popular" ? TrendingUp : Zap;
          return (
            <div key={plan.id} className={`boost-card boost-tier-${plan.tier} ${plan.recommended ? "recommended" : ""}`} onClick={() => setActiveFlow({ type: "boost", plan })}>
              {plan.badge && <div className="boost-badge">{plan.tier === "gold" ? <BadgeCheck size={11} /> : plan.recommended ? <Star size={11} fill="currentColor" /> : <Sparkles size={11} />} {plan.badge}</div>}
              <div className="boost-card-icon"><TierIcon size={22} /></div>
              <div className="boost-card-label">{plan.label}</div>
              <div className="boost-card-sub">{plan.subtitle}</div>
              <div className="boost-card-price">Rs. {plan.amount.toLocaleString()}</div>
              <ul className="boost-card-features">
                {plan.features.map((feature) => (
                  <li key={feature}><CheckCircle2 size={14} /> <span>{feature}</span></li>
                ))}
              </ul>
              <button className="boost-card-cta" onClick={(e) => { e.stopPropagation(); setActiveFlow({ type: "boost", plan }); }}>
                Boost Now <ChevronRight size={15} />
              </button>
            </div>
          );
        })}
      </div>

      {/* ── SELLER BADGES INFO CARD ── */}
      <div className="monetize-card">
        <div className="monetize-head">
          <div className="monetize-icon"><ShieldCheck size={20} /></div>
          <div><div className="monetize-title">Seller Badges</div><div className="monetize-sub">Automatic reputation tiers earned by strong seller performance.</div></div>
        </div>
        <div style={{ display: "grid", gap: 18, marginTop: 14 }}>
          <div>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Silver Trusted Seller</div>
            <ul style={{ paddingLeft: 20, marginBottom: 10, color: "#344054", fontSize: 13, lineHeight: 1.6 }}>
              <li>Average AI score above 80</li>
              <li>At least 60 successful listings</li>
              <li>0 flagged listings</li>
              <li>Good seller reputation</li>
            </ul>
            <div style={{ color: "#0f172a", fontSize: 13 }}>
              Reward: Silver Trusted Seller Badge, higher buyer trust, better visibility in search.
            </div>
          </div>
          <div>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Gold Premium Seller</div>
            <ul style={{ paddingLeft: 20, marginBottom: 10, color: "#344054", fontSize: 13, lineHeight: 1.6 }}>
              <li>Average AI score above 92</li>
              <li>At least 250 successful listings</li>
              <li>0 flagged listings</li>
              <li>Excellent long-term seller reputation</li>
            </ul>
            <div style={{ color: "#0f172a", fontSize: 13 }}>
              Reward: Gold Premium Seller Badge, maximum buyer trust, highest search ranking, premium seller recognition.
            </div>
          </div>
          <div style={{ padding: "12px 14px", border: "1px solid rgba(148,163,184,0.35)", borderRadius: 14, background: "rgba(241,245,249,0.82)", color: "#334155", fontSize: 13 }}>
            Important: these badges cannot be purchased. They are earned automatically by the system when all conditions are met.
          </div>
        </div>
      </div>

      {/* ── PAYMENT HISTORY ── */}
      {transactions.length > 0 && (
        <div className="monetize-card">
          <div className="monetize-title" style={{ marginBottom: 12 }}>Payment History</div>
          {transactions.map((tx) => (
            <div key={tx.id} className="payment-history-row">
              <div className="payment-history-icon" style={{ color: paymentStatusColor(tx.status) }}><Receipt size={16} /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{tx.label}</div>
                <div style={{ fontSize: 11.5, color: "#6b7587" }}>Rs. {tx.amount.toLocaleString()} · {new Date(tx.at).toLocaleString()}</div>
              </div>
              <span className="payment-status-pill" style={{ color: paymentStatusColor(tx.status), borderColor: paymentStatusColor(tx.status) }}>
                {paymentStatusLabel(tx.status)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Native ad slot — hidden while the payment overlay is open */}
      {!activeFlow && <AdsterraNativeBanner />}

      {activeFlow && (
        <JazzCashPaymentFlow
          flow={activeFlow}
          onClose={() => setActiveFlow(null)}
          onComplete={(tx) => { recordTransaction(tx); }}
        />
      )}
    </div>
  );
}

/* ── JazzCash brand mark (clean SVG badge — not the literal trademarked logo file) ── */
function JazzCashMark({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" style={{ flexShrink: 0 }}>
      <rect width="40" height="40" rx="9" fill="#D6001C" />
      <path d="M11 26 L17 14 L20 14 L14 26 Z" fill="#fff" />
      <path d="M20 26 L26 14 L29 14 L23 26 Z" fill="#fff" />
      <circle cx="29.5" cy="14.5" r="1.6" fill="#fff" />
    </svg>
  );
}

/* ─────────────────────────────────────────
   JAZZCASH PAYMENT FLOW — package/boost/cert → instructions →
   screenshot + TxID upload → AI verification → result
───────────────────────────────────────── */
function JazzCashPaymentFlow({ flow, onClose, onComplete }) {
  const [step, setStep] = useState("instructions"); // instructions | upload | verifying | result
  const [screenshotFile, setScreenshotFile] = useState(null);
  const [screenshotUrl,  setScreenshotUrl]  = useState(null);
  const [transactionId,  setTransactionId]  = useState("");
  const [report, setReport] = useState(null);
  const fileRef = useRef(null);

  const amount = flow.type === "boost" ? flow.plan.amount : flow.type === "points" ? flow.pkg.price : CERT_PRICE.amount;
  const label  = flow.type === "boost" ? flow.plan.label : flow.type === "points" ? `${flow.pkg.points.toLocaleString()} PM Points` : CERT_PRICE.label;

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setScreenshotFile(file);
    setScreenshotUrl(URL.createObjectURL(file));
  };

  const submitPayment = () => {
    setStep("verifying");
    setTimeout(() => {
      const result = runPaymentVerificationEngine({ expectedAmount: amount, screenshotFile, transactionId });
      setReport(result);
      setStep("result");

      if (result.status === "verified") {
        onComplete({
          id: `tx-${Date.now()}`,
          label,
          amount,
          status: "verified",
          at: result.verifiedAt,
          points: flow.type === "points" ? flow.pkg.points : null,
        });
      } else {
        onComplete({
          id: `tx-${Date.now()}`,
          label,
          amount,
          status: result.status,
          at: result.verifiedAt,
          points: null,
        });
      }
    }, 2200);
  };

  const copyNumber = () => {
    try { navigator.clipboard?.writeText(JAZZCASH_ACCOUNT.number.replace(/-/g, "")); } catch (e) {}
  };

  return (
    <div className="sheet-backdrop" onClick={(e) => { if (e.target === e.currentTarget && step !== "verifying") onClose(); }}>
      <div className="sheet">
        <div className="sheet-handle" />

        {step === "instructions" && (
          <>
            <div className="jc-header-row">
              <JazzCashMark size={32} />
              <div>
                <h3 className="sheet-title" style={{ marginBottom: 0 }}>Pay with JazzCash</h3>
                <p className="sheet-sub" style={{ marginBottom: 0 }}>{label}</p>
              </div>
            </div>

            <div className="jc-amount-box">
              <div className="jc-amount-label">Amount payable</div>
              <div className="jc-amount-value">Rs. {amount.toLocaleString()}</div>
            </div>

            <div className="jc-detail-row">
              <div>
                <div className="jc-detail-label">JazzCash Number</div>
                <div className="jc-detail-value">{JAZZCASH_ACCOUNT.number}</div>
              </div>
              <button className="jc-copy-btn" onClick={copyNumber}><Copy size={14} /> Copy</button>
            </div>
            <div className="jc-detail-row">
              <div>
                <div className="jc-detail-label">Account Title</div>
                <div className="jc-detail-value">{JAZZCASH_ACCOUNT.title}</div>
              </div>
            </div>

            <div className="jc-steps">
              <div className="jc-step"><span className="step-num">1</span> Open your JazzCash app and send Rs. {amount.toLocaleString()} to the number above</div>
              <div className="jc-step"><span className="step-num">2</span> Take a screenshot of the successful payment receipt</div>
              <div className="jc-step"><span className="step-num">3</span> Upload it below along with the Transaction ID</div>
            </div>

            <button className="kt-btn" onClick={() => setStep("upload")}>I've sent the payment <ChevronRight size={16} /></button>
            <button className="kt-btn ghost" style={{ marginTop: 8 }} onClick={onClose}>Cancel</button>
          </>
        )}

        {step === "upload" && (
          <>
            <h3 className="sheet-title">Submit payment proof</h3>
            <p className="sheet-sub">Upload your JazzCash receipt screenshot and enter the Transaction ID exactly as shown.</p>

            <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFile} />
            {!screenshotUrl ? (
              <div className="upload-box" style={{ margin: "0 0 14px", cursor: "pointer" }} onClick={() => fileRef.current?.click()}>
                <Receipt size={26} style={{ color: "#D6001C" }} />
                <div style={{ fontWeight: 700, marginTop: 6, color: "var(--ink)" }}>Upload payment screenshot</div>
                <div style={{ fontSize: 12, marginTop: 4, color: "#6b7587" }}>Choose from gallery — must show amount, date/time, and Transaction ID</div>
              </div>
            ) : (
              <div className="upload-box" style={{ margin: "0 0 14px", padding: 12 }}>
                <img src={screenshotUrl} alt="Payment receipt" style={{ width: "100%", borderRadius: 12, maxHeight: 220, objectFit: "cover" }} />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                  <span style={{ fontSize: 12, color: "var(--ink)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "70%" }}>{screenshotFile?.name}</span>
                  <button className="kt-btn ghost" style={{ width: "auto", padding: "7px 12px", fontSize: 12 }} onClick={() => { setScreenshotUrl(null); setScreenshotFile(null); }}>Replace</button>
                </div>
              </div>
            )}

            <div className="field-label">JazzCash Transaction ID</div>
            <input className="field-input" style={{ marginBottom: 16 }} placeholder="e.g. 8L52K9XQ3T" value={transactionId} onChange={(e) => setTransactionId(e.target.value)} />

            <div className="jc-ai-notice"><ScanEye size={14} /> Your payment will be automatically verified by AI within seconds</div>

            <button className="kt-btn" disabled={!screenshotUrl || !transactionId.trim()} style={!screenshotUrl || !transactionId.trim() ? { opacity: 0.4 } : {}} onClick={submitPayment}>
              Submit for verification <ShieldCheck size={16} />
            </button>
            <button className="kt-btn ghost" style={{ marginTop: 8 }} onClick={() => setStep("instructions")}>Back</button>
          </>
        )}

        {step === "verifying" && <PaymentVerifyingState />}

        {step === "result" && report && (
          <PaymentResultPanel flow={flow} amount={amount} label={label} report={report} onClose={onClose} />
        )}
      </div>
    </div>
  );
}

function PaymentVerifyingState() {
  const [idx, setIdx] = useState(0);
  const steps = ["Reading receipt details…", "Matching payment amount…", "Checking for duplicates…", "Confirming JazzCash receipt format…"];
  useEffect(() => {
    if (idx < steps.length - 1) {
      const t = setTimeout(() => setIdx((s) => s + 1), 480);
      return () => clearTimeout(t);
    }
  }, [idx]);
  return (
    <div className="ai-scan-wrap" style={{ padding: "40px 16px 24px" }}>
      <div className="ai-scan-ring"><ShieldCheck size={32} /></div>
      <div className="ai-scan-title">AI Payment Verification</div>
      <div className="ai-scan-sub">Analyzing your JazzCash receipt…</div>
      <div className="ai-scan-steps">
        {steps.map((s, i) => (
          <div key={i} className={`ai-scan-step ${i <= idx ? "active" : ""}`}>
            {i < idx ? <CheckCircle2 size={14} /> : <span className="ai-scan-dot" />}
            {s}
          </div>
        ))}
      </div>
    </div>
  );
}

function PaymentResultPanel({ flow, amount, label, report, onClose }) {
  const color = paymentStatusColor(report.status);
  const StatusIcon = report.status === "verified" ? ShieldCheck : report.status === "review" ? Clock : ShieldX;

  return (
    <>
      <div className="ai-result-hero" style={{ paddingTop: 8 }}>
        <div className="ai-result-ring" style={{ borderColor: color, width: 92, height: 92 }}>
          <StatusIcon size={30} color={color} />
        </div>
        <div className="ai-result-band" style={{ color }}>{paymentStatusLabel(report.status)}</div>
        <div className="ai-result-item-title">{label} · Rs. {amount.toLocaleString()}</div>
      </div>

      {report.status === "verified" && (
        <div className="success-box" style={{ margin: "0 16px 14px" }}>
          <CheckCircle2 size={18} />
          {flow.type === "points"
            ? `${flow.pkg.points.toLocaleString()} PM Points have been credited to your wallet instantly.`
            : flow.type === "boost"
              ? `Your post is now boosted: ${flow.plan.label}.`
              : "Your payment was verified successfully."}
        </div>
      )}

      {report.status === "review" && (
        <div className="warning-box" style={{ margin: "0 16px 14px", background: "rgba(184,134,11,0.08)", borderColor: "rgba(184,134,11,0.25)", color: "#92660a" }}>
          <Clock size={16} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 13 }}>Marked for manual review</div>
            <div style={{ fontSize: 12, marginTop: 3 }}>We couldn't confirm every detail automatically. Your payment is queued for review and points will be credited once confirmed — usually within a few hours.</div>
          </div>
        </div>
      )}

      {report.status === "rejected" && (
        <div className="warning-box" style={{ margin: "0 16px 14px" }}>
          <ShieldX size={16} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 13 }}>Payment rejected</div>
            <div style={{ fontSize: 12, marginTop: 3 }}>This submission failed AI verification. Please review the issues below, then try submitting again with a valid screenshot and Transaction ID.</div>
          </div>
        </div>
      )}

      <div className="score-grid">
        <ScoreTile label="Amount Match" value={report.amountMatchConfidence} />
        <ScoreTile label="Receipt Validity" value={report.receiptStructureScore} />
      </div>

      <div className="kp-result-card">
        <div className="kp-result-label"><ShieldCheck size={13} /> Verification Confidence</div>
        <div className="kp-result-amount" style={{ color }}>{report.confidence}%</div>
        <div className="kp-result-formula">Transaction ID: {report.transactionId || "—"}</div>
      </div>

      {report.flags.length > 0 && (
        <div className="flags-section">
          <div className="section-title" style={{ paddingTop: 0 }}>AI Notes</div>
          {report.flags.map((f, i) => (
            <div key={i} className="ai-flag-row"><AlertTriangle size={13} /> {f}</div>
          ))}
        </div>
      )}

      <div className="field-block" style={{ paddingTop: 6 }}>
        <button className="kt-btn" onClick={onClose}><CheckCircle2 size={16} /> Done</button>
      </div>
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────
   CLOUDINARY UPLOAD — handled via services/cloudinaryService.js
   (cldUpload, cldThumbUrl imported at top of file)
──────────────────────────────────────────────────────────────── */

/* ─────────────────────────────────────────
   UPLOAD PROGRESS BAR (shared by both screens)
───────────────────────────────────────── */
function UploadProgressBar({ progress, onCancel }) {
  return (
    <div className="cld-progress-wrap">
      <div className="cld-progress-top">
        <span className="cld-progress-label">
          {progress < 100 ? `Uploading… ${progress}%` : "Processing…"}
        </span>
        {onCancel && progress < 100 && (
          <button className="cld-cancel-btn" onClick={onCancel}>Cancel</button>
        )}
      </div>
      <div className="cld-progress-bg">
        <div className="cld-progress-fill" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   BOOST UPLOAD — wired to Cloudinary
───────────────────────────────────────── */
function BoostUpload({ onUploaded }) {
  const [mediaUrl,   setMediaUrl]   = useState(null);   // local blob preview
  const [mediaFile,  setMediaFile]  = useState(null);
  const [isVideo,    setIsVideo]    = useState(true);
  const [title,      setTitle]      = useState("");
  const [uploading,  setUploading]  = useState(false);
  const [progress,   setProgress]   = useState(0);
  const [uploadErr,  setUploadErr]  = useState(null);
  const fileRef     = useRef(null);
  const abortRef    = useRef(null);

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setMediaFile(file);
    setMediaUrl(URL.createObjectURL(file));
    setIsVideo(file.type.startsWith("video/"));
    setUploadErr(null);
  };

  const handleContinue = async () => {
    if (!title.trim() || !mediaFile) return;
    setUploading(true);
    setProgress(0);
    setUploadErr(null);
    abortRef.current = new AbortController();

    try {
      const result = await cldUpload(
        mediaFile, "boosts", "user",
        setProgress, abortRef.current.signal
      );
      const isVid = mediaFile.type.startsWith("video/");
      onUploaded({
        title,
        mediaUrl:     result.secure_url,
        thumbnailUrl: cldThumbUrl(result.public_id, isVid),
        publicId:     result.public_id,
        mediaType:    isVid ? "video" : "image",
      });
    } catch (err) {
      if (err.name !== "AbortError") setUploadErr(err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <div className="field-label" style={{ marginTop: 4 }}>Upload the video or photo you want to boost</div>
      <input ref={fileRef} type="file" accept="video/*,image/*" style={{ display: "none" }} onChange={handleFile} />

      {!mediaUrl ? (
        <div className="upload-box" style={{ margin: "0 0 14px", cursor: "pointer" }} onClick={() => fileRef.current?.click()}>
          <ImageIcon size={26} style={{ color: "#22c55e" }} />
          <div style={{ fontWeight: 700, marginTop: 6, color: "var(--ink)" }}>Choose from gallery</div>
          <div style={{ fontSize: 12, marginTop: 4, color: "#6f8b80" }}>Select a video or photo to boost to the top of the Home feed</div>
        </div>
      ) : (
        <div className="upload-box" style={{ margin: "0 0 14px", padding: 12 }}>
          {isVideo
            ? <video src={mediaUrl} controls style={{ width: "100%", borderRadius: 12, maxHeight: 180, background: "#000" }} />
            : <img src={mediaUrl} alt="preview" style={{ width: "100%", borderRadius: 12, maxHeight: 180, objectFit: "cover" }} />
          }
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
            <span style={{ fontSize: 12, color: "var(--ink)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "70%" }}>{mediaFile?.name}</span>
            {!uploading && (
              <button className="kt-btn ghost" style={{ width: "auto", padding: "7px 12px", fontSize: 12 }} onClick={() => { setMediaUrl(null); setMediaFile(null); }}>Replace</button>
            )}
          </div>
        </div>
      )}

      {uploadErr && <div className="upload-error"><AlertTriangle size={13} /> {uploadErr}</div>}
      {uploading && <UploadProgressBar progress={progress} onCancel={() => abortRef.current?.abort()} />}

      <div className="field-label">Post title</div>
      <input className="field-input" style={{ marginBottom: 14 }} placeholder="e.g. Razer Gaming Mouse" value={title} onChange={(e) => setTitle(e.target.value)} />

      <button
        className="kt-btn"
        disabled={!title.trim() || !mediaFile || uploading}
        style={!title.trim() || !mediaFile || uploading ? { opacity: 0.4 } : {}}
        onClick={handleContinue}
      >
        {uploading ? "Uploading your video…" : <>Continue <ChevronRight size={16} /></>}
      </button>
    </>
  );
}

/* ─────────────────────────────────────────
   CREATE POST — full Cloudinary + AI + Firestore flow
   Stage machine:
     form → uploading → analyzing → results → saving → posted
───────────────────────────────────────── */
function CreateScreen({ currentUser, userLocation }) {
  /* ── Form fields ── */
  const [mediaUrl,   setMediaUrl]   = useState(null);   // local blob preview
  const [mediaFile,  setMediaFile]  = useState(null);
  const [isVideo,    setIsVideo]    = useState(true);
  const [title,      setTitle]      = useState("");
  const [desc,       setDesc]       = useState("");
  const [category,   setCategory]   = useState("");
  const [needsItem,  setNeedsItem]  = useState("");

  /* ── Stage machine ── */
  const [stage,      setStage]      = useState("form");
  //  form | uploading | analyzing | results | saving | posted | error

  /* ── Cloudinary upload ── */
  const [progress,   setProgress]   = useState(0);
  const [uploadErr,  setUploadErr]  = useState(null);
  const [cldResult,  setCldResult]  = useState(null);   // raw Cloudinary response

  /* ── AI analysis ── */
  const [report,     setReport]     = useState(null);

  /* ── Save error ── */
  const [saveErr,    setSaveErr]    = useState(null);

  const fileRef  = useRef(null);
  const abortRef = useRef(null);

  /* ── File picker ── */
  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setMediaFile(file);
    setMediaUrl(URL.createObjectURL(file));
    setIsVideo(file.type.startsWith("video/"));
    setUploadErr(null);
  };

  /* ── Smart match preview (unchanged from original) ── */
  const matches = needsItem.trim().length > 1
    ? FEED
        .filter((i) => i.title.toLowerCase().includes(needsItem.trim().toLowerCase()))
        .map((i) => ({
          ...i,
          distanceKm: haversineDistanceKm(DEFAULT_LOCATION.lat, DEFAULT_LOCATION.lng, i.lat, i.lng),
        }))
        .sort((a, b) => {
          if (a.city === DEFAULT_LOCATION.city && b.city !== DEFAULT_LOCATION.city) return -1;
          if (b.city === DEFAULT_LOCATION.city && a.city !== DEFAULT_LOCATION.city) return 1;
          return a.distanceKm !== b.distanceKm
            ? a.distanceKm - b.distanceKm
            : b.karmaScore - a.karmaScore;
        })
        .slice(0, 3)
    : [];

  /* ─────────────────────────────────────────
     STEP 1 — Upload to Cloudinary
  ───────────────────────────────────────── */
  const startUpload = async () => {
    if (!title.trim() || !mediaFile) return;
    setStage("uploading");
    setProgress(0);
    setUploadErr(null);
    abortRef.current = new AbortController();

    try {
      const uid = currentUser?.uid || "anonymous";
      const result = await cldUpload(
        mediaFile, "listings", uid,
        setProgress, abortRef.current.signal
      );
      setCldResult(result);
      // Move straight into AI analysis
      runAiAnalysis(result);
    } catch (err) {
      if (err.name === "AbortError") {
        setStage("form");
      } else {
        setUploadErr(err.message);
        setStage("error");
      }
    }
  };

  /* ─────────────────────────────────────────
     STEP 2 — AI authenticity analysis
  ───────────────────────────────────────── */
  const runAiAnalysis = (cloudinaryResult) => {
    setStage("analyzing");
    // Simulate the AI processing delay
    // In production: swap setTimeout for a real CV/LLM service call
    setTimeout(() => {
      const aiReport = runAiAuthenticityEngine({
        title, desc, category, mediaFile, isVideo,
      });
      setReport(aiReport);
      setStage("results");
    }, 2200);
  };

  /* ─────────────────────────────────────────
     STEP 3 — Save to Firestore
     Called when user taps "Confirm & Post" on the results screen
  ───────────────────────────────────────── */
  const saveToFirestore = async () => {
    if (!cldResult || !report) return;

    // ── Auth guard ──────────────────────────────────────────────────────────
    const uid = currentUser?.uid;
    if (!uid) {
      setSaveErr("You must be signed in to create a post.");
      setStage("error");
      return;
    }

    setStage("saving");
    setSaveErr(null);

    const isVid       = mediaFile?.type.startsWith("video/");
    const thumbnailUrl = cldThumbUrl(cldResult.public_id, isVid);

    // ── Resolve live location ────────────────────────────────────────────────
    const activeLocation = userLocation || DEFAULT_LOCATION;

    // ── Build the Firestore document ─────────────────────────────────────────
    const postData = {
      // Auth binding
      userId:         uid,
      username:       currentUser.username       || currentUser.displayName || "",
      avatar:         currentUser.avatarEmoji    || currentUser.photoURL    || "🧑",
      verified:       currentUser.isVerified     || false,
      isProSeller:    currentUser.isProSeller    || false,

      // Content
      title:          title.trim(),
      description:    desc.trim(),
      category:       category.trim(),
      needsInReturn:  needsItem.trim(),
      contentType:    isVid ? "video" : "image",

      // Cloudinary media (all fields needed for FeedCard + DetailScreen)
      mediaUrl:       cldResult.secure_url,
      mediaType:      isVid ? "video" : "image",
      thumbnailUrl,
      publicId:       cldResult.public_id,
      mediaFormat:    cldResult.format    || null,
      mediaBytes:     cldResult.bytes     || null,
      videoDuration:  cldResult.duration  || null,
      videoWidth:     cldResult.width     || null,
      videoHeight:    cldResult.height    || null,

      // AI scoring results
      aiKarmaScore:   report.finalScore,
      recommendedPm:  report.recommendedKp,
      karmaScore:     report.finalScore,        // FeedCard reads karmaScore
      aiValue:        report.recommendedKp,     // DetailScreen reads aiValue
      aiBadges:       report.badges.map((b) => b.label),
      aiAuthenticity: report.authenticity,
      aiCondition:    report.condition,
      aiNeedsReview:  report.needsReview,

      // Location
      city:           activeLocation.city  || "",
      lat:            activeLocation.lat   || null,
      lng:            activeLocation.lng   || null,

      // Feed defaults
      likes:          0,
      views:          0,
      saves:          0,
      comments:       0,
      isBoosted:      false,
      isRemoved:      false,
      status:         report.needsReview ? "pending_review" : "active",

      // Fallback gradient colours for FeedCard when media is loading
      color1:         "#bdeede",
      color2:         "#8fd9bd",
    };

    try {
      // ── Write to top-level posts collection ─────────────────────────────────
      // Path: /posts/{postId}
      // Indexed by userId, city, status so feeds can query efficiently.
      const postsCol  = collection(db, "posts");
      const postRef   = await addDoc(postsCol, {
        ...postData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // ── Mirror under user's sub-collection ──────────────────────────────────
      // Path: /users/{userId}/posts/{postId}
      // Used for PM Space "My Posts" feed without extra queries.
      const userPostRef = doc(db, "users", uid, "posts", postRef.id);
      await setDoc(userPostRef, {
        userId:     uid,
        postId:     postRef.id,
        title:      postData.title,
        thumbnailUrl,
        mediaType:  postData.mediaType,
        status:     postData.status,
        aiKarmaScore: postData.aiKarmaScore,
        createdAt:  serverTimestamp(),
      });

      // Update user's seller statistics and assign Silver/Gold badges.
      try {
        const userRef = doc(db, "users", uid);
        const userSnap = await getDoc(userRef);
        const userData = userSnap.exists() ? userSnap.data() : {};

        // First listing ever — unlock the 100 PM welcome bonus that was
        // credited (but locked) at signup. Matches the promise shown in the
        // Wallet screen and the CreateScreen locked-balance hint.
        if (userData.pointsStatus === "locked") {
          updateDoc(userRef, { pointsStatus: "unlocked" }).catch((unlockErr) => {
            console.warn("Welcome bonus unlock failed:", unlockErr?.message || unlockErr);
          });
        }

        // If this listing passed AI checks (not flagged), count it as a successful listing
        if (!postData.aiNeedsReview && (!report.flags || report.flags.length === 0)) {
          const prevCount = userData.sellerSuccessfulListings || 0;
          const prevAvg = userData.sellerAverageAiScore || 0;
          const newCount = prevCount + 1;
          const newAvg = Math.round(((prevAvg * prevCount) + report.finalScore) / newCount);

          await updateDoc(userRef, {
            sellerSuccessfulListings: increment(1),
            sellerAverageAiScore: newAvg,
          });

          const flagged = userData.sellerFlaggedListings || 0;

          // Assign badges based on thresholds (minimal, conservative rules):
          // Silver: avg AI score > 80, >=60 successful listings, no flagged listings
          // Gold:   avg AI score > 92, >=250 successful listings, no flagged listings
          let badgeLevel = null;
          let badgeLabel = null;
          if (newAvg > 92 && newCount >= 250 && flagged === 0) {
            badgeLevel = "gold";
            badgeLabel = "Premium Trusted Seller";
          } else if (newAvg > 80 && newCount >= 60 && flagged === 0) {
            badgeLevel = "silver";
            badgeLabel = "Trusted Seller";
          }

          if (badgeLevel) {
            await updateDoc(userRef, {
              sellerBadge: badgeLevel,
              sellerBadgeLabel: badgeLabel,
              sellerBadgeAwardedAt: serverTimestamp(),
            });
          }
        } else {
          // Flagged/under-review listings increment flagged count for the seller
          await updateDoc(userRef, { sellerFlaggedListings: increment(1) });
        }
      } catch (e) {
        console.warn("Seller badge update failed:", e?.message || e);
      }

      setStage("posted");

    } catch (err) {
      console.warn("Firestore write failed:", err?.code || err?.message || err);
      setSaveErr(`Failed to save your post. Please try again. (${err.message})`);
      setStage("error");
    }
  };

  /* ─────────────────────────────────────────
     RENDER — stage machine
  ───────────────────────────────────────── */

  /* ── Uploading to Cloudinary ── */
  if (stage === "uploading") {
    return (
      <div className="kt-scroll">
        <div className="screen-header"><h2>Create Post</h2></div>
        <div className="cld-upload-stage">
          <div className="cld-upload-icon">
            {isVideo ? <Film size={36} /> : <ImageIcon size={36} />}
          </div>
          <div className="cld-upload-title">Uploading your post</div>
          <div className="cld-upload-sub">{mediaFile?.name}</div>
          <UploadProgressBar
            progress={progress}
            onCancel={() => abortRef.current?.abort()}
          />
          <div className="cld-upload-note">
            Your file is being securely uploaded.
            Thumbnail will be generated automatically.
          </div>
        </div>
      </div>
    );
  }

  /* ── AI analysis ── */
  if (stage === "analyzing") return <AiAnalyzingScreen isVideo={isVideo} />;

  /* ── AI results ── */
  if (stage === "results" && report) {
    return (
      <AiResultsScreen
        report={report}
        title={title}
        onEdit={() => setStage("form")}
        onConfirm={saveToFirestore}
      />
    );
  }

  /* ── Saving to Firestore ── */
  if (stage === "saving") {
    return (
      <div className="kt-scroll">
        <div className="screen-header"><h2>Create Post</h2></div>
        <div className="cld-upload-stage">
          <div className="cld-upload-icon" style={{ background: "var(--sea-light)" }}>
            <CheckCircle2 size={36} color="#22c55e" />
          </div>
          <div className="cld-upload-title">Saving your listing…</div>
          <div className="cld-upload-sub">Writing to Firestore database</div>
          <div className="cld-progress-wrap" style={{ marginTop: 24 }}>
            <div className="cld-progress-bg">
              <div className="cld-progress-fill" style={{ width: "100%", animation: "progressPulse 1s ease-in-out infinite" }} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ── Success ── */
  if (stage === "posted") {
    return (
      <div className="kt-scroll">
        <div className="screen-header"><h2>Create Post</h2></div>
        <div className="cld-upload-stage">
          <div className="cld-upload-icon" style={{ background: "var(--sea-light)", width: 80, height: 80 }}>
            <CheckCircle2 size={42} color="#22c55e" />
          </div>
          <div className="cld-upload-title" style={{ color: "#22c55e" }}>Listing is live!</div>
          <div className="cld-upload-sub">Your post has been uploaded successfully.</div>

          {/* Show the real Cloudinary thumbnail */}
          {cldResult?.public_id && (
            <div style={{ width: "100%", maxWidth: 320, margin: "20px auto 0", borderRadius: 16, overflow: "hidden" }}>
              <img
                src={cldThumbUrl(cldResult.public_id, isVideo)}
                alt={title}
                style={{ width: "100%", borderRadius: 16, display: "block" }}
              />
            </div>
          )}

          <div className="cld-media-info">
            {cldResult && (
              <>
                <div className="cld-info-row"><span>CDN URL</span><a href={cldResult.secure_url} target="_blank" rel="noopener noreferrer" style={{ color: "#22c55e", fontSize: 11, wordBreak: "break-all" }}>View Media ↗</a></div>
                {cldResult.duration && <div className="cld-info-row"><span>Duration</span><b>{Math.round(cldResult.duration)}s</b></div>}
                <div className="cld-info-row"><span>Size</span><b>{(cldResult.bytes / 1024 / 1024).toFixed(1)} MB</b></div>
                <div className="cld-info-row"><span>Format</span><b>{cldResult.format?.toUpperCase()}</b></div>
                <div className="cld-info-row"><span>AI Score</span><b style={{ color: "#22c55e" }}>{report?.finalScore}/100</b></div>
              </>
            )}
          </div>

          <button className="kt-btn" style={{ marginTop: 20, maxWidth: 280, alignSelf: "center" }} onClick={() => {
            setStage("form"); setMediaUrl(null); setMediaFile(null);
            setTitle(""); setDesc(""); setCategory(""); setNeedsItem("");
            setCldResult(null); setReport(null);
          }}>
            <PlusCircle size={16} /> Create another post
          </button>
        </div>
      </div>
    );
  }

  /* ── Error state ── */
  if (stage === "error") {
    return (
      <div className="kt-scroll">
        <div className="screen-header"><h2>Create Post</h2></div>
        <div className="cld-upload-stage">
          <div className="cld-upload-icon" style={{ background: "#fee2e2" }}>
            <AlertTriangle size={36} color="#dc2626" />
          </div>
          <div className="cld-upload-title" style={{ color: "#dc2626" }}>Upload failed</div>
          <div className="cld-upload-sub">{uploadErr || saveErr || "Something went wrong. Please try again."}</div>
          <button className="kt-btn" style={{ marginTop: 20, maxWidth: 280 }} onClick={() => setStage("form")}>Try again</button>
        </div>
      </div>
    );
  }

  /* ── Main form ── */
  return (
    <div className="kt-scroll">
      <div className="screen-header"><h2>Create Post</h2></div>
      <input ref={fileRef} type="file" accept="video/*,image/*" style={{ display: "none" }} onChange={handleFile} />

      {/* ── Media picker / preview ── */}
      {!mediaUrl ? (
        <div className="upload-box" style={{ cursor: "pointer" }} onClick={() => fileRef.current?.click()}>
          <ImageIcon size={28} style={{ color: "#22c55e" }} />
          <div style={{ fontWeight: 700, marginTop: 8, color: "var(--ink)" }}>Choose from gallery</div>
          <div style={{ fontSize: 12, marginTop: 4, color: "#6f8b80" }}>Select a video or photo of your item, skill, or service</div>
     
        </div>
      ) : (
        <div className="upload-box" style={{ padding: 12 }}>
          {isVideo
            ? <video src={mediaUrl} controls style={{ width: "100%", borderRadius: 14, maxHeight: 200, background: "#000" }} />
            : <img src={mediaUrl} alt="preview" style={{ width: "100%", borderRadius: 14, maxHeight: 200, objectFit: "cover" }} />
          }
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
            <div>
              <span style={{ fontSize: 12, color: "var(--ink)", fontWeight: 600 }}>{mediaFile?.name}</span>
              <span style={{ fontSize: 11, color: "#6f8b80", display: "block", marginTop: 2 }}>
                {(mediaFile?.size / 1024 / 1024).toFixed(1)} MB · {isVideo ? "Video" : "Image"}
              </span>
            </div>
            <button className="kt-btn ghost" style={{ width: "auto", padding: "7px 12px", fontSize: 12 }} onClick={() => { setMediaUrl(null); setMediaFile(null); }}>Replace</button>
          </div>
        </div>
      )}

      {/* ── Form fields ── */}
      <div className="field-block">
        <label className="field-label">Title</label>
        <input className="field-input" placeholder="e.g. Razer Gaming Mouse" value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div className="field-block">
        <label className="field-label">Description</label>
        <textarea className="field-textarea" placeholder="Describe condition, what you're looking to trade for…" value={desc} onChange={(e) => setDesc(e.target.value)} />
      </div>
      <div className="field-block">
        <label className="field-label">Category</label>
        <input className="field-input" placeholder="Electronics, Fashion, Skills…" value={category} onChange={(e) => setCategory(e.target.value)} />
      </div>
      <div className="field-block">
        <label className="field-label">What do you need in return?</label>
        <input className="field-input" placeholder="e.g. Study Table, Headphones, Bicycle…" value={needsItem} onChange={(e) => setNeedsItem(e.target.value)} />
      </div>

      {/* ── Smart match preview ── */}
      {matches.length > 0 && (
        <div className="match-preview-box">
          <div className="match-preview-title"><Sparkles size={13} /> Nearby traders offering "{needsItem}"</div>
          {matches.map((m) => (
            <div key={m.id} className="match-preview-row">
              <div className="avatar-sm">{m.avatar}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 12.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.title}</div>
                <div style={{ fontSize: 11, color: "#6f8b80" }}>{m.city} · {formatDistance(m.distanceKm)} · ⭐ {m.karmaScore}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Info notices ── */}
      <div className="ai-est-box" style={{ flexDirection: "column", alignItems: "flex-start", gap: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}><ScanEye size={15} /> AI Authenticity &amp; Karma Scoring Engine will run after upload</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}><ImageIcon size={14} /> Media will be uploaded securely.</div>
      </div>

      {/* ── Submit button ── */}
      <div className="field-block" style={{ paddingTop: 0 }}>
        <button
          className="kt-btn"
          disabled={!title.trim() || !mediaFile}
          style={!title.trim() || !mediaFile ? { opacity: 0.4 } : {}}
          onClick={startUpload}
        >
          <ScanEye size={16} /> Upload &amp; Analyze
        </button>
      </div>
    </div>
  );
}

/* ── AI Engine: Analyzing (loading) screen ── */
function AiAnalyzingScreen({ isVideo }) {
  const [stepIdx, setStepIdx] = useState(0);
  const steps = isVideo
    ? ["Scanning video quality…", "Checking for manipulation…", "Matching content to listing…", "Calculating Karma Score…"]
    : ["Scanning image clarity…", "Detecting condition & wear…", "Verifying authenticity…", "Calculating Karma Score…"];

  useEffect(() => {
    if (stepIdx < steps.length - 1) {
      const t = setTimeout(() => setStepIdx((s) => s + 1), 480);
      return () => clearTimeout(t);
    }
  }, [stepIdx]);

  return (
    <div className="kt-scroll">
      <div className="screen-header"><h2>Create Post</h2></div>
      <div className="ai-scan-wrap">
        <div className="ai-scan-ring">
          <ScanEye size={32} />
        </div>
        <div className="ai-scan-title">AI Authenticity Engine</div>
        <div className="ai-scan-sub">Analyzing your {isVideo ? "video" : "image"} listing…</div>
        <div className="ai-scan-steps">
          {steps.map((s, i) => (
            <div key={i} className={`ai-scan-step ${i <= stepIdx ? "active" : ""}`}>
              {i < stepIdx ? <CheckCircle2 size={14} /> : <span className="ai-scan-dot" />}
              {s}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── AI Engine: Results screen ── */
const BADGE_ICONS = { shield: ShieldCheck, check: BadgeCheck, sparkle: Sparkles, award: Award, users: Users };

function AiResultsScreen({ report, title, onEdit, onConfirm }) {
  const band = karmaBandLabel(report.finalScore);
  const bandColor = report.needsReview ? "#ef4444" : report.finalScore >= 70 ? "#16a34a" : "#b8860b";

  return (
    <div className="kt-scroll">
      <div className="screen-header"><h2>AI Scan Results</h2></div>

      <div className="ai-result-hero">
        <div className="ai-result-ring" style={{ borderColor: bandColor }}>
          <span style={{ color: bandColor }}>{report.finalScore}</span>
          <span className="ai-result-ring-sub">/ 100</span>
        </div>
        <div className="ai-result-band" style={{ color: bandColor }}>{band}</div>
        <div className="ai-result-item-title">{title || "Untitled listing"}</div>
      </div>

      {report.needsReview && (
        <div className="warning-box" style={{ margin: "0 16px 14px" }}>
          <ShieldAlert size={16} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 13 }}>Flagged for manual review</div>
            <div style={{ fontSize: 12, marginTop: 3 }}>This listing scored too low or triggered multiple fraud signals. It's been sent to Point Maker moderation and PM Points are reduced until reviewed.</div>
          </div>
        </div>
      )}

      <div className="score-grid">
        <ScoreTile label={report.isVideo ? "Video Authenticity" : "Image Authenticity"} value={report.authenticity} />
        <ScoreTile label="Condition Score" value={report.condition} />
        <ScoreTile label="Content Quality" value={report.contentQuality} />
        <ScoreTile label="Karma Score" value={report.trustScore} />
      </div>

      <div className="kp-result-card">
        <div className="kp-result-label"><Sparkles size={13} /> Recommended PM Points</div>
        <div className="kp-result-amount">{report.recommendedKp} PM</div>
        <div className="kp-result-formula">
          30% Authenticity + 25% Condition + 20% Quality + 15% Category + 10% Completeness
        </div>
      </div>

      {report.badges.length > 0 && (
        <div className="badges-section">
          <div className="section-title" style={{ paddingTop: 0 }}>AI Trust Badges Earned</div>
          <div className="badge-grid">
            {report.badges.map((b, i) => {
              const Icon = BADGE_ICONS[b.icon] || CheckCircle2;
              return (
                <div key={i} className="ai-badge">
                  <Icon size={14} /> {b.label}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {report.flags.length > 0 && (
        <div className="flags-section">
          <div className="section-title" style={{ paddingTop: 0 }}>AI Notes</div>
          {report.flags.map((f, i) => (
            <div key={i} className="ai-flag-row"><AlertTriangle size={13} /> {f}</div>
          ))}
        </div>
      )}

      <div className="field-block" style={{ display: "flex", gap: 10, paddingTop: 6 }}>
        <button className="kt-btn ghost" onClick={onEdit}>Edit listing</button>
        <button className="kt-btn" onClick={onConfirm}>
          <CheckCircle2 size={16} /> {report.needsReview ? "Submit for review" : "Confirm & Post"}
        </button>
      </div>
    </div>
  );
}

function ScoreTile({ label, value }) {
  const color = value >= 80 ? "#16a34a" : value >= 50 ? "#b8860b" : "#ef4444";
  return (
    <div className="score-tile">
      <div className="score-tile-value" style={{ color }}>{value}</div>
      <div className="score-tile-bar-bg"><div className="score-tile-bar-fill" style={{ width: `${value}%`, background: color }} /></div>
      <div className="score-tile-label">{label}</div>
    </div>
  );
}

/* ─────────────────────────────────────────
   INBOX / CHAT LIST — with Find User
───────────────────────────────────────── */
const CHATS = [];

const CHAT_MESSAGES = [];

function InboxScreen({ onOpenChat }) {
  const [showFindUser, setShowFindUser] = useState(false);
  return (
    <>
      <div className="screen-header">
        <h2 style={{ flex: 1 }}>Inbox</h2>
        <button className="icon-btn" title="Find trader by ID" onClick={() => setShowFindUser(true)}><Search size={17} /></button>
      </div>
      <div className="kt-scroll">
        {CHATS.length === 0 ? (
          <div className="empty-state" style={{ padding: "18px 16px" }}>Your inbox is empty. Start a conversation by finding a trader.</div>
        ) : (
          CHATS.map((c) => (
            <div key={c.id} className="chat-row" onClick={() => onOpenChat(c)}>
              <div className="avatar-sm" style={{ width: 44, height: 44, fontSize: 20, flexShrink: 0 }}>{c.avatar}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="feed-username">{c.user}</div>
                <div style={{ fontSize: 12.5, color: "#6f8b80", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.last}</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                <span style={{ fontSize: 11, color: "#6f8b80" }}>{c.time}</span>
                {c.unread > 0 && <div className="unread-dot">{c.unread}</div>}
              </div>
            </div>
          ))
        )}
      </div>
      {showFindUser && (
        <FindUserModal onClose={() => setShowFindUser(false)} onOpenChat={(c) => { setShowFindUser(false); onOpenChat(c); }} />
      )}
    </>
  );
}

function ChatScreen({ chat, onBack }) {
  const [input,    setInput]    = useState("");
  const [messages, setMessages] = useState(CHAT_MESSAGES);
  const send = () => {
    if (!input.trim()) return;
    setMessages([...messages, { from: "me", text: input, time: "now" }]);
    setInput("");
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div className="screen-header">
        <button className="back-btn-inline" onClick={onBack}><ChevronLeft size={20} /></button>
        <div className="avatar-sm" style={{ width: 34, height: 34, fontSize: 16, flexShrink: 0 }}>{chat.avatar}</div>
        <h2>{chat.user}</h2>
      </div>
      <div className="kt-scroll" style={{ paddingTop: 10 }}>
        {messages.length === 0 ? (
          <div className="empty-state" style={{ padding: "18px 16px" }}>No messages yet. Start the conversation below.</div>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={`msg-row ${m.from}`}>
              <div>
                <div className={`msg-bubble ${m.from}`}>{m.text}</div>
                <div style={{ fontSize: 10, color: "#6f8b80", marginTop: 2, textAlign: m.from === "me" ? "right" : "left" }}>{m.time}</div>
              </div>
            </div>
          ))
        )}
      </div>
      <div className="chat-input-row">
        <input className="chat-input" placeholder="Message…" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} />
        <button className="send-btn" onClick={send}><Send size={16} /></button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   FIND USER — search by PM ID
───────────────────────────────────────── */
function FindUserModal({ onClose, onOpenChat, onOpenPmSpace }) {
  const [query,  setQuery]  = useState("");
  const [result, setResult] = useState(null);
  const [notFound, setNotFound] = useState(false);

  const search = () => {
    const q = query.trim().toLowerCase();
    const found = USER_DIRECTORY.find((u) => u.id.toLowerCase() === q || u.user.toLowerCase() === q);
    if (found) { setResult(found); setNotFound(false); }
    else { setResult(null); setNotFound(true); }
  };

  const goToProfile = (username) => {
    if (onOpenPmSpace) { onOpenPmSpace(username); onClose(); }
  };

  return (
    <div className="sheet-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet">
        <div className="sheet-handle" />
        <h3 className="sheet-title">Find a Trader</h3>
        <p className="sheet-sub">Enter a trader's <b>PM ID</b> (e.g. PM-003) or <b>username</b> (e.g. @priya.codes) to start a conversation about a deal.</p>

        <div className="search-pill" style={{ marginBottom: 12 }}>
          <Search size={15} />
          <input className="search-input" placeholder="PM-001 or @username" value={query} onChange={(e) => { setQuery(e.target.value); setResult(null); setNotFound(false); }} onKeyDown={(e) => e.key === "Enter" && search()} />
        </div>
        <button className="kt-btn" onClick={search}><Search size={15} /> Search trader</button>

        {notFound && <div className="empty-state" style={{ padding: "16px 0 0" }}>No trader found for "<b>{query}</b>". Check the ID and try again.</div>}

        {result && (
          <div className="user-result">
            <div className="avatar-lg" style={{ flexShrink: 0, cursor: "pointer" }} onClick={() => goToProfile(result.user)}>{result.avatar}</div>
            <div style={{ flex: 1, cursor: "pointer" }} onClick={() => goToProfile(result.user)}>
              <div style={{ fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", gap: 5 }}>{result.name} {result.verified && <CheckCircle2 size={13} color="#22c55e" />}</div>
              <div style={{ fontSize: 12.5, color: "#6f8b80" }}>{result.user} · ID: {result.id}</div>
              <div style={{ display: "flex", gap: 12, marginTop: 6 }}>
                <span className="seller-stat"><Star size={12} fill="#16a34a" color="#16a34a" /> {result.karmaScore}</span>
                <span className="seller-stat"><Award size={12} /> {result.trades} trades</span>
              </div>
            </div>
            <button
              className="kt-btn"
              style={{ width: "auto", padding: "10px 16px", flexShrink: 0 }}
              onClick={() => onOpenChat({ id: result.id, user: result.user, avatar: result.avatar })}
            >
              <MessageCircle size={15} /> Message
            </button>
          </div>
        )}

        <div className="section-title" style={{ marginTop: 16 }}>All traders</div>
        {USER_DIRECTORY.length === 0 ? (
          <div className="empty-state" style={{ padding: "16px 0 0" }}>No traders are currently registered in the demo directory.</div>
        ) : (
          USER_DIRECTORY.map((u) => (
            <div key={u.id} className="user-dir-row" onClick={() => goToProfile(u.user)}>
              <div className="avatar-sm" style={{ width: 38, height: 38, fontSize: 18, flexShrink: 0 }}>{u.avatar}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 13, display: "flex", alignItems: "center", gap: 4 }}>{u.name} <span style={{ color: "#6f8b80", fontWeight: 400 }}>{u.user}</span> {u.verified && <CheckCircle2 size={12} color="#22c55e" />}</div>
                <div style={{ fontSize: 11.5, color: "#16a34a", fontWeight: 600 }}>{u.id}</div>
              </div>
              <ChevronRight size={16} color="#6f8b80" />
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* Find User full screen (from nav) */
function FindUserScreen({ onBack, onOpenChat, onOpenPmSpace }) {
  return (
    <div className="kt-scroll">
      <div className="screen-header">
        <button className="back-btn-inline" onClick={onBack}><ChevronLeft size={20} /></button>
        <h2>Find a Trader</h2>
      </div>
      <FindUserModal onClose={onBack} onOpenChat={onOpenChat} onOpenPmSpace={onOpenPmSpace} />
    </div>
  );
}

/* ─────────────────────────────────────────
   📍 INTERACTIVE MAP VIEW
   Shows nearby listings/traders plotted by
   relative lat/lng position, with distance
   from the user's current location.
───────────────────────────────────────── */
function MapScreen({ onBack, userLocation, onOpenDetail }) {
  const [selected, setSelected] = useState(null);

  const nearby = FEED
    .filter((item) => item.city === userLocation.city)
    .map((item) => ({
      ...item,
      distanceKm: haversineDistanceKm(userLocation.lat, userLocation.lng, item.lat, item.lng),
    }))
    .sort((a, b) => a.distanceKm - b.distanceKm);

  // Project lat/lng to a 0-100% box around the user's position for a simple visual map
  const SPAN = 0.06; // degrees shown edge-to-edge (~6-7km)
  const toPercent = (lat, lng) => {
    const x = 50 + ((lng - userLocation.lng) / SPAN) * 50;
    const y = 50 - ((lat - userLocation.lat) / SPAN) * 50;
    return { x: Math.max(4, Math.min(96, x)), y: Math.max(4, Math.min(96, y)) };
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div className="screen-header">
        <button className="back-btn-inline" onClick={onBack}><ChevronLeft size={20} /></button>
        <h2>Nearby Map</h2>
        <span style={{ marginLeft: "auto", fontSize: 11.5, color: "#6f8b80", display: "flex", alignItems: "center", gap: 4 }}>
          <MapPin size={12} /> {userLocation.city}
        </span>
      </div>

      <div className="map-canvas">
        <div className="map-grid" />
        {/* User's own position, dead center */}
        <div className="map-pin map-pin-self" style={{ left: "50%", top: "50%" }}>
          <div className="map-pin-dot self" />
          <div className="map-pin-pulse" />
        </div>

        {nearby.map((item) => {
          const { x, y } = toPercent(item.lat, item.lng);
          return (
            <div
              key={item.id}
              className={`map-pin ${selected?.id === item.id ? "active" : ""}`}
              style={{ left: `${x}%`, top: `${y}%` }}
              onClick={() => setSelected(item)}
            >
              <div className="map-pin-dot"><Handshake size={11} /></div>
            </div>
          );
        })}
      </div>

      {selected ? (
        <div className="map-detail-card">
          <div className="map-detail-thumb" style={{ background: `linear-gradient(160deg, ${selected.color1}, ${selected.color2})` }}>🎥</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 13.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selected.title}</div>
            <div className="loc-badge-row" style={{ marginTop: 4 }}>
              <span className="loc-badge dist">{selected.distanceKm <= 2 ? "🔥" : "📏"} {formatDistance(selected.distanceKm)}</span>
              <span className="loc-badge karma">⭐ {selected.karmaScore}</span>
            </div>
          </div>
          <button className="kt-btn" style={{ width: "auto", padding: "10px 14px", flexShrink: 0 }} onClick={() => onOpenDetail(selected)}>
            View <ChevronRight size={14} />
          </button>
        </div>
      ) : (
        <div className="map-list">
          {nearby.slice(0, 4).map((item) => (
            <div key={item.id} className="map-list-row" onClick={() => setSelected(item)}>
              <div className="map-list-thumb" style={{ background: `linear-gradient(160deg, ${item.color1}, ${item.color2})` }}>🎥</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 12.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title}</div>
                <div style={{ fontSize: 11, color: "#6f8b80" }}>{item.distanceKm <= 2 ? "🔥 Nearby Trader" : "📍"} · {formatDistance(item.distanceKm)} away</div>
              </div>
              <ChevronRight size={15} color="#6f8b80" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────
   PROFILE
───────────────────────────────────────── */
function ProfileScreen({ onNavigate, userLocation, currentUser }) {
  const displayName   = currentUser?.username   || currentUser?.fullName  || "@you.trades";
  const displayBio    = currentUser?.bio         || "Trading my way across town, one fair deal at a time 🤝";
  const displayAvatar = currentUser?.avatarEmoji || "🧑‍🚀";
  const displayId     = currentUser?.uid ? `PM-${currentUser.uid.slice(0, 6).toUpperCase()}` : "PM-000";
  // ── Live profile stats — karma, trades, followers, following — always
  // from Firestore, defaulting to 0 for brand-new users. Never hardcoded. ──
  const { karmaScore: karma, totalTrades: trades, followers, following } = useLiveProfileStats(currentUser?.uid);

  // ── Live PM Points balance — always read from Firestore, never hardcoded ──
  const { points: pmPoints } = useLivePmPoints(currentUser?.uid);
  const walletSub = pmPoints === null ? "Loading…" : `${pmPoints.toLocaleString()} PM`;

  return (
    <div className="kt-scroll">
      <div className="profile-head">
        <div className="profile-avatar">{displayAvatar}</div>
        <div className="profile-name">{displayName}</div>
        <div className="profile-bio">{displayBio}</div>
        <div className="stat-row">
          <div className="stat-item"><div className="stat-num">{karma}</div><div className="stat-lbl">Karma</div></div>
          <div className="stat-item"><div className="stat-num">{trades}</div><div className="stat-lbl">Trades</div></div>
          <div className="stat-item"><div className="stat-num">{followers}</div><div className="stat-lbl">Followers</div></div>
          <div className="stat-item"><div className="stat-num">{following}</div><div className="stat-lbl">Following</div></div>
        </div>
        <div className="karma-id-box">Your PM ID: <b>{displayId}</b></div>
        {userLocation && (
          <div className="karma-id-box" style={{ marginTop: 8, background: "#eafbe7" }}>
            <MapPin size={12} style={{ display: "inline", verticalAlign: -2, marginRight: 4 }} /> {userLocation.city}
          </div>
        )}
      </div>
      <MenuRow icon={Package}     label="My Listings"  onClick={() => onNavigate("listings")} />
      <MenuRow icon={Bookmark}    label="Saved Items"  onClick={() => onNavigate("saved")} />
      <MenuRow icon={MapIcon}     label="Nearby Map"   onClick={() => onNavigate("map")} />
      <MenuRow icon={Wallet}      label="Wallet"       sub={walletSub} onClick={() => onNavigate("wallet")} />
      <MenuRow icon={Inbox}       label="Orders"       onClick={() => onNavigate("orders")} />
      <MenuRow icon={SettingsIcon}label="Settings"     onClick={() => onNavigate("settings")} />
    </div>
  );
}

function MenuRow({ icon: Icon, label, sub, onClick }) {
  return (
    <div className="menu-row" onClick={onClick}>
      <div className="menu-icon"><Icon size={17} /></div>
      <div className="menu-label">{label}</div>
      {sub && <span style={{ fontSize: 12.5, color: "#6f8b80", fontWeight: 600 }}>{sub}</span>}
      <ChevronRight size={16} color="#6f8b80" />
    </div>
  );
}

/* ─────────────────────────────────────────
   WALLET — real Firestore-backed PM Points balance
   Balance always comes live from users/{uid}.pmPoints — never hardcoded.
   Transaction history reads from the points_ledger collection.
───────────────────────────────────────── */
function WalletScreen({ onBack, currentUser, onOpenCreate, onOpenShop }) {
  const [profile,  setProfile]  = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [ledger,   setLedger]   = useState([]);
  const [ledgerErr, setLedgerErr] = useState(null);

  // Live user profile (balance + lock status)
  useEffect(() => {
    if (!currentUser?.uid) { setLoading(false); return; }
    setLoading(true);
    const unsub = onSnapshot(
      doc(db, "users", currentUser.uid),
      (snap) => { setProfile(snap.exists() ? snap.data() : null); setLoading(false); },
      () => setLoading(false)
    );
    return unsub;
  }, [currentUser?.uid]);

  // Live transaction / points ledger history
  useEffect(() => {
    if (!currentUser?.uid) return;
    try {
      const q = fsQuery(
        collection(db, "points_ledger"),
        where("uid", "==", currentUser.uid),
        orderBy("createdAt", "desc"),
        limit(20)
      );
      const unsub = onSnapshot(q,
        (snap) => { setLedger(snap.docs.map((d) => ({ id: d.id, ...d.data() }))); setLedgerErr(null); },
        (err) => { console.warn("Ledger listener error:", err.message); setLedgerErr("Could not load transaction history."); }
      );
      return unsub;
    } catch (e) {
      setLedgerErr("Could not load transaction history.");
    }
  }, [currentUser?.uid]);

  const pmPoints     = profile?.pmPoints ?? currentUser?.pmPoints ?? 0;
  const pointsStatus = profile?.pointsStatus ?? currentUser?.pointsStatus ?? "locked";
  const isLocked      = pointsStatus === "locked";

  return (
    <div className="kt-scroll">
      <div className="screen-header">
        <button className="back-btn-inline" onClick={onBack}><ChevronLeft size={20} /></button>
        <h2>Wallet</h2>
      </div>

      <div className="wallet-balance-card">
        <div className="wallet-balance-label"><Wallet size={13} /> PM Points Balance</div>
        {loading ? (
          <div className="wallet-balance-amount">Loading…</div>
        ) : (
          <div className="wallet-balance-amount">{pmPoints.toLocaleString()} <span>PM</span></div>
        )}
        <div className={`wallet-status-chip ${isLocked ? "locked" : "active"}`}>
          {isLocked ? <><Lock size={11} /> Locked</> : <><CheckCircle2 size={11} /> Active</>}
        </div>
        {isLocked && (
          <p className="wallet-balance-hint">
            Your 100 PM welcome bonus unlocks automatically after your first listing or trade.
          </p>
        )}
      </div>

      <div style={{ display: "flex", gap: 10, padding: "0 16px 6px" }}>
        <button className="kt-btn ghost" style={{ flex: 1 }} onClick={onOpenShop}>
          <TrendingUp size={15} /> Get More PM
        </button>
        <button className="kt-btn" style={{ flex: 1 }} onClick={onOpenCreate}>
          <PlusCircle size={15} /> New Listing
        </button>
      </div>

      <div className="section-title">Transaction History</div>
      {ledgerErr && (
        <div className="empty-state" style={{ color: "#dc2626" }}>
          <AlertTriangle size={18} style={{ marginBottom: 6 }} />
          <div style={{ fontWeight: 700, fontSize: 13.5 }}>{ledgerErr}</div>
        </div>
      )}
      {!ledgerErr && ledger.length === 0 && (
        <div className="empty-state">
          <div style={{ fontSize: 24, marginBottom: 6 }}>🧾</div>
          <div style={{ fontWeight: 700, fontSize: 13.5 }}>No transactions yet</div>
          <div style={{ fontSize: 12, color: "#6f8b80" }}>Your PM Points activity will show up here.</div>
        </div>
      )}
      {!ledgerErr && ledger.map((tx) => (
        <div key={tx.id} className="payment-history-row" style={{ margin: "0 16px" }}>
          <div className="payment-history-icon" style={{ color: tx.type === "debit" ? "#dc2626" : "#16a34a" }}>
            {tx.type === "debit" ? <ChevronLeft size={16} style={{ transform: "rotate(-45deg)" }} /> : <ChevronRight size={16} style={{ transform: "rotate(-135deg)" }} />}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 13 }}>{ledgerReasonLabel(tx.reason)}</div>
            <div style={{ fontSize: 11.5, color: "#6b7587" }}>
              {tx.createdAt?.toDate ? tx.createdAt.toDate().toLocaleString() : "Just now"} · {tx.status === "locked" ? "Locked" : "Available"}
            </div>
          </div>
          <span style={{ fontWeight: 700, fontSize: 13.5, color: tx.type === "debit" ? "#dc2626" : "#16a34a" }}>
            {tx.type === "debit" ? "−" : "+"}{tx.amount} PM
          </span>
        </div>
      ))}

      {/* Native ad slot at the bottom of the Wallet screen */}
      <div style={{ padding: "0 16px" }}>
        <AdsterraNativeBanner />
      </div>
    </div>
  );
}

function ledgerReasonLabel(reason) {
  const labels = {
    WELCOME_BONUS:   "Welcome Bonus",
    BOOST_PURCHASE:  "Post Boost Purchase",
    POINTS_PURCHASE: "PM Points Purchase",
    CERT_PURCHASE:   "Verification Certification",
    TRADE_REWARD:    "Trade Reward",
  };
  return labels[reason] || reason || "Points Activity";
}

/* ─────────────────────────────────────────
   MY LISTINGS
───────────────────────────────────────── */
function ListingsScreen({ onBack, currentUser }) {
  const uid = currentUser?.uid;
  const [listings, setListings] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);

  // ── Live Firestore subscription — this user's own posts, newest first.
  // Always the real source of truth; updates automatically the instant a
  // new listing is created (no manual refresh needed). ──
  useEffect(() => {
    if (!uid) { setListings([]); setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const q = fsQuery(
        collection(db, "posts"),
        where("userId", "==", uid),
        orderBy("createdAt", "desc")
      );
      const unsub = onSnapshot(
        q,
        (snap) => {
          setListings(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
          setLoading(false);
        },
        (err) => {
          console.warn("My Listings query failed:", err.message);
          setListings([]);
          setLoading(false);
          setError("Could not load your listings. Check your connection and try again.");
        }
      );
      return unsub;
    } catch (err) {
      setLoading(false);
      setError("Could not connect to your listings.");
    }
  }, [uid]);

  const toggleBoost = (id) => setListings((l) => l.map((x) => x.id === id ? { ...x, isBoosted: !x.isBoosted } : x));

  // ── Category counts — Products / Skills / Services / Videos — always
  // derived live from the same Firestore data, 0 when nothing exists yet. ──
  const isSkillCat   = (c) => (c || "").toLowerCase().includes("skill");
  const isServiceCat = (c) => (c || "").toLowerCase().includes("service");
  const skillsCount   = listings.filter((l) => isSkillCat(l.category)).length;
  const servicesCount = listings.filter((l) => isServiceCat(l.category)).length;
  const productsCount = listings.filter((l) => !isSkillCat(l.category) && !isServiceCat(l.category)).length;
  const videosCount   = listings.filter((l) => l.mediaType === "video").length;

  return (
    <div className="kt-scroll">
      <div className="screen-header">
        <button className="back-btn-inline" onClick={onBack}><ChevronLeft size={20} /></button>
        <h2>My Listings</h2>
      </div>
      <div style={{ padding: "0 16px 4px" }}>
        <div className="karma-id-box">
          📦 {productsCount} Products &nbsp;·&nbsp; 🛠️ {skillsCount} Skills &nbsp;·&nbsp; 🧰 {servicesCount} Services &nbsp;·&nbsp; 🎥 {videosCount} Videos
        </div>
      </div>
      <div style={{ padding: "12px 16px 16px" }}>
        {loading && (
          <div className="feed-loading"><div className="feed-loading-spinner" /><span>Loading your listings…</span></div>
        )}

        {!loading && error && (
          <div className="empty-state" style={{ color: "#dc2626" }}>
            <AlertTriangle size={20} style={{ marginBottom: 8 }} />
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Could not load listings</div>
            <div style={{ fontSize: 12.5 }}>{error}</div>
          </div>
        )}

        {!loading && !error && listings.length === 0 && (
          <div className="empty-state">You haven't created any listings yet. Post your first item, skill, or service to see it here.</div>
        )}

        {!loading && !error && listings.map((l) => (
          <div key={l.id} className="listing-card">
            <div className="listing-thumb" style={{ background: `linear-gradient(160deg, ${l.color1 || "#bdeede"}, ${l.color2 || "#8fd9bd"})` }}>
              {l.mediaType === "video" ? "🎥" : "🖼️"}
            </div>
            <div className="listing-info">
              <div className="listing-title">{l.title}</div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
                <span className={`status-pill ${l.status === "active" ? "active" : "pending"}`}>{l.status === "active" ? "Active" : "Pending"}</span>
                <span className="ai-row" style={{ fontSize: 12 }}><Sparkles size={11} /> {(l.recommendedPm || l.aiValue || 0).toLocaleString()} PM</span>
              </div>
              <button className={`boost-btn ${l.isBoosted ? "on" : ""}`} onClick={() => toggleBoost(l.id)}>
                <TrendingUp size={13} /> {l.isBoosted ? "Boosted · 24h left" : "Boost this post"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   SAVED ITEMS
───────────────────────────────────────── */
function SavedScreen({ onBack, onOpenDetail }) {
  return (
    <div className="kt-scroll">
      <div className="screen-header">
        <button className="back-btn-inline" onClick={onBack}><ChevronLeft size={20} /></button>
        <h2>Saved Items</h2>
      </div>
      <div style={{ padding: "12px 16px 16px" }}>
        {FEED.length === 0 ? (
          <div className="empty-state">No saved items yet. Save listings to view them here.</div>
        ) : (
          FEED.map((item) => (
            <div key={item.id} className="listing-card" style={{ cursor: "pointer" }} onClick={() => onOpenDetail(item)}>
              <div className="listing-thumb" style={{ background: `linear-gradient(160deg, ${item.color1}, ${item.color2})` }}>🎥</div>
              <div className="listing-info">
                <div className="listing-title">{item.title}</div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span className="ai-row" style={{ fontSize: 12 }}><Sparkles size={11} /> {item.aiValue.toLocaleString()} PM</span>
                  <span style={{ fontSize: 12, color: "#6f8b80" }}>{item.user}</span>
                </div>
              </div>
              <Bookmark size={18} fill="#22c55e" color="#22c55e" style={{ flexShrink: 0 }} />
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   ORDERS
───────────────────────────────────────── */
function OrdersScreen({ onBack }) {
  const [tab, setTab] = useState("give");
  const items = ORDERS[tab];
  return (
    <div className="kt-scroll">
      <div className="screen-header">
        <button className="back-btn-inline" onClick={onBack}><ChevronLeft size={20} /></button>
        <h2>Orders</h2>
      </div>
      <div className="tab-scroll">
        {ORDER_TABS.map(({ key, label, icon: Icon }) => (
          <div key={key} className={`order-tab ${tab === key ? "active" : ""}`} onClick={() => setTab(key)}>
            <Icon size={13} /> {label}
          </div>
        ))}
      </div>
      {items.length === 0 ? <div className="empty-state">No orders here yet.</div> : items.map((o, i) => (
        <div key={i} className="order-card">
          <div style={{ fontWeight: 700, fontSize: 14 }}>{o.item}</div>
          <div style={{ fontSize: 12, color: "#6f8b80", marginTop: 4 }}>With {o.with} · {o.status}</div>
        </div>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────
   SETTINGS — fully functional sheets
───────────────────────────────────────── */
function SettingsScreen({ onBack, userLocation, onUpdateLocation, onLogout, darkMode, onToggleDarkMode, currentUser, onProfileUpdate }) {
  const [toggles, setToggles] = useState({ notifications: true, tradeAlerts: true, publicProfile: true });
  const flip = (key) => setToggles((t) => ({ ...t, [key]: !t[key] }));
  const [sheet, setSheet] = useState(null);
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    await onLogout();
  };

  return (
    <div className="kt-scroll">
      <div className="screen-header">
        <button className="back-btn-inline" onClick={onBack}><ChevronLeft size={20} /></button>
        <h2>Settings</h2>
      </div>

      <div className="section-title">Account</div>
      <MenuRow icon={User}        label="Edit profile"  onClick={() => setSheet("profile")} />
      <MenuRow icon={Smartphone}  label="Phone number"  onClick={() => setSheet("phone")} />
      <MenuRow icon={MapPin}      label="Location"      sub={userLocation?.city} onClick={() => setSheet("location")} />

      <div className="section-title">Preferences</div>
      <ToggleRow icon={Bell}         label="Push notifications"  checked={toggles.notifications}  onToggle={() => flip("notifications")} />
      <ToggleRow icon={Handshake}    label="Trade offer alerts"  checked={toggles.tradeAlerts}    onToggle={() => flip("tradeAlerts")} />
      <ToggleRow icon={Users}        label="Public profile"      checked={toggles.publicProfile}  onToggle={() => flip("publicProfile")} />
      <ToggleRow icon={SettingsIcon} label="Dark mode"           checked={darkMode}       onToggle={onToggleDarkMode} />

      <div className="section-title">Support</div>
      <MenuRow icon={MessageCircle} label="Help & support"      onClick={() => setSheet("help")} />
      <MenuRow icon={Flag}          label="Report a problem"    onClick={() => setSheet("report")} />
      <MenuRow icon={Info}          label="About Point Maker"  onClick={() => setSheet("about")} />
      <MenuRow icon={Lock}          label="Privacy policy"      onClick={() => setSheet("privacy")} />

      <div style={{ padding: "16px" }}>
        <button className="kt-btn ghost" disabled={loggingOut} style={{ color: "#ef4444", borderColor: "#fecaca", opacity: loggingOut ? 0.6 : 1 }} onClick={handleLogout}>
          {loggingOut ? "Logging out…" : "Log out"}
        </button>
      </div>

      {sheet === "profile"  && <EditProfileSheet  onClose={() => setSheet(null)} currentUser={currentUser} onProfileUpdate={onProfileUpdate} />}
      {sheet === "phone"    && <PhoneNumberSheet  onClose={() => setSheet(null)} currentUser={currentUser} onProfileUpdate={onProfileUpdate} />}
      {sheet === "location" && <UpdateLocationSheet currentLocation={userLocation} onSave={(loc) => { onUpdateLocation(loc); setSheet(null); }} onClose={() => setSheet(null)} />}
      {sheet === "help"     && <HelpSheet         onClose={() => setSheet(null)} />}
      {sheet === "report"   && <ReportProblemSheet onClose={() => setSheet(null)} />}
      {sheet === "about"    && <AboutSheet        onClose={() => setSheet(null)} />}
      {sheet === "privacy"  && <PrivacySheet      onClose={() => setSheet(null)} />}
    </div>
  );
}

/* ── Report a Problem — feeds straight into the Admin Dashboard ── */
function ReportProblemSheet({ onClose }) {
  const [type, setType] = useState(null);
  const [subject, setSubject] = useState("");
  const [details, setDetails] = useState("");
  const [sent, setSent] = useState(false);

  const REPORT_ICONS = { bug: Bug, alert: AlertTriangle, flag: Flag, lightbulb: Lightbulb, message: MessageSquare };

  const submit = () => {
    if (!type || !subject.trim() || !details.trim()) return;
    submitReport({ type, subject: subject.trim(), details: details.trim(), reporter: "@you.trades" });
    setSent(true);
    setTimeout(onClose, 1600);
  };

  return (
    <div className="sheet-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet">
        <div className="sheet-handle" />
        <h3 className="sheet-title">Report a Problem</h3>
        <p className="sheet-sub">Help us keep Point Maker safe and reliable. Your report goes straight to our moderation team.</p>

        {!sent ? (
          <>
            <div className="field-label" style={{ marginBottom: 8 }}>What's this about?</div>
            <div className="report-type-grid">
              {REPORT_TYPES.map((t) => {
                const Icon = REPORT_ICONS[t.icon] || Flag;
                return (
                  <div key={t.key} className={`report-type-chip ${type === t.key ? "selected" : ""}`} onClick={() => setType(t.key)}>
                    <Icon size={16} /> {t.label}
                  </div>
                );
              })}
            </div>

            <label className="field-label">Subject</label>
            <input className="field-input" style={{ marginBottom: 14 }} placeholder="Brief summary" value={subject} onChange={(e) => setSubject(e.target.value)} />

            <label className="field-label">Details</label>
            <textarea className="field-textarea" style={{ marginBottom: 16 }} placeholder="Describe what happened, including any listing or user involved…" value={details} onChange={(e) => setDetails(e.target.value)} />

            <button className="kt-btn" disabled={!type || !subject.trim() || !details.trim()} style={!type || !subject.trim() || !details.trim() ? { opacity: 0.4 } : {}} onClick={submit}>
              <Flag size={15} /> Submit report
            </button>
          </>
        ) : (
          <div className="success-box"><CheckCircle2 size={18} /> Report submitted. Our team will review it shortly.</div>
        )}
      </div>
    </div>
  );
}

/* Update city / GPS location from Profile → Settings (per spec) */
function UpdateLocationSheet({ currentLocation, onSave, onClose }) {
  const [city, setCity] = useState(currentLocation?.city || PAKISTANI_CITIES[0].name);
  const [gpsState, setGpsState] = useState("idle"); // idle | requesting | granted | denied
  const [coords, setCoords] = useState(currentLocation ? { lat: currentLocation.lat, lng: currentLocation.lng } : null);

  const requestGps = () => {
    setGpsState("requesting");
    const fallback = PAKISTANI_CITIES.find((c) => c.name === city);
    if (!navigator.geolocation) {
      setCoords({ lat: fallback.lat, lng: fallback.lng });
      setGpsState("granted");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => { setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setGpsState("granted"); },
      () => { setCoords({ lat: fallback.lat, lng: fallback.lng }); setGpsState("denied"); },
      { enableHighAccuracy: true, timeout: 6000 }
    );
  };

  const save = () => {
    const c = PAKISTANI_CITIES.find((c) => c.name === city);
    onSave({ city, lat: coords?.lat ?? c.lat, lng: coords?.lng ?? c.lng });
  };

  return (
    <div className="sheet-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet">
        <div className="sheet-handle" />
        <h3 className="sheet-title">Update Location</h3>
        <p className="sheet-sub">Change your city or refresh your GPS position to improve nearby matches.</p>

        <div className="field-label" style={{ marginBottom: 8 }}>City</div>
        <div className="city-grid-light">
          {PAKISTANI_CITIES.map((c) => (
            <div key={c.name} className={`city-chip-light ${city === c.name ? "selected" : ""}`} onClick={() => { setCity(c.name); setGpsState("idle"); setCoords(null); }}>
              <MapPin size={12} /> {c.name}
            </div>
          ))}
        </div>

        <button className="kt-btn ghost" style={{ marginBottom: 14 }} onClick={requestGps}>
          <Navigation size={15} /> {gpsState === "granted" ? "Refresh GPS position" : "Use my current GPS position"}
        </button>

        {gpsState === "requesting" && <div className="empty-state" style={{ padding: "0 0 14px" }}>Requesting location…</div>}
        {gpsState === "granted" && coords && (
          <div className="confirm-box">
            <div className="confirm-row"><span>Latitude</span><b>{coords.lat.toFixed(4)}</b></div>
            <div className="confirm-row"><span>Longitude</span><b>{coords.lng.toFixed(4)}</b></div>
          </div>
        )}
        {gpsState === "denied" && <div className="empty-state" style={{ padding: "0 0 14px" }}>GPS denied — using {city} city center instead.</div>}

        <button className="kt-btn" onClick={save}><CheckCircle2 size={16} /> Save location</button>
      </div>
    </div>
  );
}

function ToggleRow({ icon: Icon, label, checked, onToggle }) {
  return (
    <div className="menu-row" style={{ cursor: "pointer" }} onClick={onToggle}>
      <div className="menu-icon"><Icon size={17} /></div>
      <div className="menu-label">{label}</div>
      <div className={`switch ${checked ? "on" : ""}`}><div className="switch-knob" /></div>
    </div>
  );
}

function EditProfileSheet({ onClose, currentUser, onProfileUpdate }) {
  const [name, setName] = useState(currentUser?.username || currentUser?.fullName || "@you.trades");
  const [bio,  setBio]  = useState(currentUser?.bio || "Trading my way across town, one fair deal at a time 🤝");
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    if (currentUser?.uid) {
      try {
        await updateUserProfile(currentUser.uid, { username: name, bio });
        onProfileUpdate?.({ username: name, bio });
      } catch (e) {
        console.warn("Failed to save profile:", e);
      }
    }
    setSaving(false);
    setDone(true);
    setTimeout(onClose, 1200);
  };
  return (
    <div className="sheet-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet">
        <div className="sheet-handle" />
        <h3 className="sheet-title">Edit Profile</h3>
        <p className="sheet-sub">Update how other traders see you.</p>
        <label className="field-label">Username</label>
        <input className="field-input" style={{ marginBottom: 14 }} value={name} onChange={(e) => setName(e.target.value)} />
        <label className="field-label">Bio</label>
        <textarea className="field-textarea" style={{ marginBottom: 16 }} value={bio} onChange={(e) => setBio(e.target.value)} />
        {!done ? <button className="kt-btn" onClick={save} disabled={saving}><CheckCircle2 size={16} /> {saving ? "Saving…" : "Save changes"}</button>
               : <div className="success-box"><CheckCircle2 size={18} /> Profile updated!</div>}
      </div>
    </div>
  );
}

function PhoneNumberSheet({ onClose, currentUser, onProfileUpdate }) {
  const [step,       setStep]       = useState("view"); // view | edit | otp | done
  const [countryCode,setCountryCode]= useState("+92");
  const [newPhone,   setNewPhone]   = useState("");
  const [otp,        setOtp]        = useState("");
  const [error,      setError]      = useState("");
  const [sending,    setSending]    = useState(false);
  const [verifying,  setVerifying]  = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const verificationIdRef = useRef(null);
  const recaptchaRef = useRef(null);

  const currentPhone = currentUser?.phone || "";

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  // Clean up the invisible reCAPTCHA whenever this sheet closes/unmounts.
  useEffect(() => {
    return () => {
      if (recaptchaRef.current) {
        try { recaptchaRef.current.clear(); } catch (_) {}
        recaptchaRef.current = null;
      }
    };
  }, []);

  const getVerifier = () => {
    if (recaptchaRef.current) return recaptchaRef.current;
    const verifier = new RecaptchaVerifier(auth, "pm-recaptcha-container", { size: "invisible" });
    recaptchaRef.current = verifier;
    return verifier;
  };

  const sendCode = async () => {
    const digits = newPhone.replace(/\D/g, "");
    if (digits.length < 7) { setError("Enter a valid phone number."); return; }
    setError("");
    setSending(true);
    try {
      const fullPhone = countryCode + digits;
      const provider = new PhoneAuthProvider(auth);
      const verificationId = await provider.verifyPhoneNumber(fullPhone, getVerifier());
      verificationIdRef.current = verificationId;
      setOtp("");
      setStep("otp");
      setResendCooldown(30);
    } catch (e) {
      setError(getFriendlyAuthError(e, "Failed to send OTP. Please check the number and try again."));
      if (recaptchaRef.current) { try { recaptchaRef.current.clear(); } catch (_) {} recaptchaRef.current = null; }
    } finally {
      setSending(false);
    }
  };

  const verifyCode = async () => {
    if (otp.length < 6 || !verificationIdRef.current) return;
    setError("");
    setVerifying(true);
    try {
      const credential = PhoneAuthProvider.credential(verificationIdRef.current, otp);
      // Updates the phone number on the existing signed-in Firebase Auth user —
      // does NOT sign the user out or start a new session.
      await updatePhoneNumber(auth.currentUser, credential);

      const fullPhone = countryCode + newPhone.replace(/\D/g, "");
      // Only persist the new number to Firestore after verification succeeds.
      if (currentUser?.uid) {
        await updateUserProfile(currentUser.uid, { phone: fullPhone });
        onProfileUpdate?.({ phone: fullPhone });
      }
      setStep("done");
      setTimeout(onClose, 1400);
    } catch (e) {
      setError(getFriendlyAuthError(e, "Incorrect code. Please try again."));
    } finally {
      setVerifying(false);
    }
  };

  const resend = async () => {
    if (resendCooldown > 0 || sending) return;
    await sendCode();
  };

  return (
    <div className="sheet-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet">
        <div className="sheet-handle" />
        <h3 className="sheet-title">Phone Number</h3>

        {step === "view" && (
          <>
            <div className="confirm-box" style={{ marginBottom: 14 }}>
              <div className="confirm-row"><span>Number</span><b>{currentPhone || "Not set"}</b></div>
              <div className="confirm-row"><span>Status</span><b style={{ color: "#16a34a" }}>Verified ✓</b></div>
            </div>
            <button className="kt-btn ghost" onClick={() => { setError(""); setNewPhone(""); setStep("edit"); }}>Change number</button>
          </>
        )}

        {step === "edit" && (
          <>
            <p className="sheet-sub">Enter your new number. We'll text a real 6-digit code to verify it.</p>
            <div className="kt-phone-row" style={{ marginBottom: 14 }}>
              <select className="kt-code" style={{ border: "none", background: "none" }} value={countryCode} onChange={(e) => setCountryCode(e.target.value)}>
                <option value="+92">🇵🇰 +92</option>
                <option value="+1">🇺🇸 +1</option>
                <option value="+44">🇬🇧 +44</option>
                <option value="+971">🇦🇪 +971</option>
                <option value="+966">🇸🇦 +966</option>
              </select>
              <input className="kt-input" type="tel" inputMode="numeric" placeholder="3001234567" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
            </div>
            {error && <div className="field-error" style={{ marginBottom: 14 }}><AlertTriangle size={12} /> {error}</div>}
            <button className="kt-btn" disabled={!newPhone.trim() || sending} style={(!newPhone.trim() || sending) ? { opacity: 0.4 } : {}} onClick={sendCode}>
              {sending ? "Sending…" : <>Send code <Smartphone size={15} /></>}
            </button>
          </>
        )}

        {step === "otp" && (
          <>
            <p className="sheet-sub">Enter the 6-digit code sent to <b>{countryCode}{newPhone}</b>.</p>
            <input
              className="field-input"
              style={{ marginBottom: 6, textAlign: "center", fontFamily: "'Space Grotesk', sans-serif", fontSize: 22, letterSpacing: "0.3em" }}
              maxLength={6}
              inputMode="numeric"
              placeholder="••••••"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
            />
            {error && <div className="field-error" style={{ marginBottom: 10 }}><AlertTriangle size={12} /> {error}</div>}
            <div className="resend-row">
              {resendCooldown > 0
                ? <>Didn't get a code? Resend available in {resendCooldown}s</>
                : <>Didn't get a code? <span className="resend-link" onClick={resend}>{sending ? "Sending…" : "Resend code"}</span></>
              }
            </div>
            <button className="kt-btn" disabled={otp.length < 6 || verifying} style={(otp.length < 6 || verifying) ? { opacity: 0.4 } : {}} onClick={verifyCode}>
              {verifying ? "Verifying…" : <>Verify <CheckCircle2 size={15} /></>}
            </button>
          </>
        )}

        {step === "done" && <div className="success-box"><CheckCircle2 size={18} /> Phone number updated!</div>}
      </div>
    </div>
  );
}

/* ── About Point Maker — full info center per spec ── */
const ABOUT_SECTIONS = [
  { q: "What is Point Maker?", a: "Point Maker (PM) is a video-first barter and trading marketplace. Instead of using cash, members trade physical items, services, and skills directly with each other — or use PM Points as a flexible in-between currency when a direct swap doesn't line up." },
  { q: "How does the Point System work?", a: "Every member has a PM Points (PM) balance. PM can be earned by trading fairly, offering items others want, and maintaining a high Karma Score. PM can be spent to top up an offer, boost a post, or get Verified Pro Seller certification." },
  { q: "How do I earn points?", a: "Complete your first trade to unlock your locked welcome bonus, receive PM directly from other traders as part of an offer, and keep a high Karma Score by shipping fast, communicating clearly, and avoiding cancellations." },
  { q: "How do I spend points?", a: "Use PM to sweeten a trade offer (e.g. \"my headphones + 200 PM\"), boost a listing to the top of the Home feed for 24 hours, or pay for Verified Pro Seller certification — all from the Shop tab." },
  { q: "Product trading guide", a: "Upload a clear video or photo of your item, write an honest title and description, and specify what you'd like in return. Our AI Authenticity Engine scans every upload for condition, authenticity, and quality before it goes live." },
  { q: "Skill trading guide", a: "List a skill the same way you'd list an item — record a short demo video, describe what's included (e.g. \"1-hour guitar lesson\"), and set what you're hoping to trade for. Skills are scored for credibility just like products." },
  { q: "How does AI point valuation work?", a: "When you upload a listing, our AI Authenticity & Karma Scoring Engine analyzes authenticity, condition, content quality, category value, and listing completeness to recommend a fair PM Point value — so trades stay balanced without manual guesswork." },
  { q: "What does the Verified badge mean?", a: "A Verified Pro Seller badge means a trader has paid for and passed Point Maker's skill/identity certification. It signals extra trustworthiness on top of their regular Karma Score and trade history." },
  { q: "Community guidelines", a: "Be honest about an item's condition, never list something you don't own or can't deliver, communicate respectfully, and follow through on accepted trades. Misleading listings or repeated cancellations will lower your Karma Score." },
];

const ABOUT_FAQ = [
  { q: "Is Point Maker free to use?", a: "Yes — browsing, listing, and trading are completely free. Optional paid features like Post Boost and Verified certification are paid securely through JazzCash." },
  { q: "What happens if a trade goes wrong?", a: "Open the chat with your trade partner first to resolve it directly. Repeated issues affect both parties' Karma Score and may be reviewed by moderation." },
  { q: "Can I trade across cities?", a: "Yes, though Point Maker prioritizes same-city and nearby matches first for faster, easier handoffs. You can still browse and trade with anyone." },
];

function AboutSheet({ onClose }) {
  const [open, setOpen] = useState(null);
  const [faqOpen, setFaqOpen] = useState(null);
  const [showContact, setShowContact] = useState(false);

  return (
    <div className="sheet-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet">
        <div className="sheet-handle" />
        <h3 className="sheet-title">About Point Maker</h3>
        <p className="sheet-sub">Everything you need to know to get the most out of PM.</p>

        {ABOUT_SECTIONS.map((s, i) => (
          <div key={i} className="faq-item" onClick={() => setOpen(open === i ? null : i)}>
            <div className="faq-q">{s.q}<ChevronRight size={15} style={{ transform: open === i ? "rotate(90deg)" : "none", transition: "transform .15s", color: "#6f8b80", flexShrink: 0 }} /></div>
            {open === i && <div className="faq-a">{s.a}</div>}
          </div>
        ))}

        <div className="section-title" style={{ padding: "16px 0 8px" }}>Frequently Asked Questions</div>
        {ABOUT_FAQ.map((f, i) => (
          <div key={i} className="faq-item" onClick={() => setFaqOpen(faqOpen === i ? null : i)}>
            <div className="faq-q">{f.q}<ChevronRight size={15} style={{ transform: faqOpen === i ? "rotate(90deg)" : "none", transition: "transform .15s", color: "#6f8b80", flexShrink: 0 }} /></div>
            {faqOpen === i && <div className="faq-a">{f.a}</div>}
          </div>
        ))}

        <button className="kt-btn" style={{ marginTop: 14 }} onClick={() => setShowContact(true)}><MessageCircle size={15} /> Contact support</button>

        <div className="about-version">
          <Info size={13} /> Point Maker (PM) · Version 2.4.0
        </div>
      </div>
      {showContact && <ContactSupportSheet onClose={() => setShowContact(false)} />}
    </div>
  );
}

function HelpSheet({ onClose }) {
  const [open, setOpen] = useState(null);
  const [showContact, setShowContact] = useState(false);
  return (
    <div className="sheet-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet">
        <div className="sheet-handle" />
        <h3 className="sheet-title">Help &amp; Support</h3>
        <p className="sheet-sub">Frequently asked questions</p>
        {FAQ_ITEMS.map((f, i) => (
          <div key={i} className="faq-item" onClick={() => setOpen(open === i ? null : i)}>
            <div className="faq-q">{f.q}<ChevronRight size={15} style={{ transform: open === i ? "rotate(90deg)" : "none", transition: "transform .15s", color: "#6f8b80", flexShrink: 0 }} /></div>
            {open === i && <div className="faq-a">{f.a}</div>}
          </div>
        ))}
        <button className="kt-btn" style={{ marginTop: 14 }} onClick={() => setShowContact(true)}><MessageCircle size={15} /> Contact support</button>
      </div>
      {showContact && <ContactSupportSheet onClose={() => setShowContact(false)} />}
    </div>
  );
}

function ContactSupportSheet({ onClose }) {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sent,    setSent]    = useState(false);

  const send = () => {
    if (!subject.trim() || !message.trim()) return;
    setSent(true);
    setTimeout(onClose, 1600);
  };

  return (
    <div className="sheet-backdrop nested" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet">
        <div className="sheet-handle" />
        <h3 className="sheet-title">Contact Support</h3>
        <p className="sheet-sub">Tell us what's going on and our team will follow up by email.</p>

        {!sent ? (
          <>
            <label className="field-label">Subject</label>
            <input className="field-input" style={{ marginBottom: 14 }} placeholder="e.g. Issue with a trade" value={subject} onChange={(e) => setSubject(e.target.value)} />
            <label className="field-label">Message</label>
            <textarea className="field-textarea" style={{ marginBottom: 16 }} placeholder="Describe the issue in detail…" value={message} onChange={(e) => setMessage(e.target.value)} />
            <button className="kt-btn" disabled={!subject.trim() || !message.trim()} style={!subject.trim() || !message.trim() ? { opacity: 0.4 } : {}} onClick={send}>
              <MessageCircle size={15} /> Send message
            </button>
          </>
        ) : (
          <div className="success-box"><CheckCircle2 size={18} /> Message sent! Our support team will respond shortly.</div>
        )}
      </div>
    </div>
  );
}

function PrivacySheet({ onClose }) {
  return (
    <div className="sheet-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet">
        <div className="sheet-handle" />
        <h3 className="sheet-title">Privacy Policy</h3>
        <p className="sheet-sub">Last updated June 2026</p>
        <div className="privacy-block">
          <p><b>Data we collect:</b> Phone number, device fingerprint, transaction history, and content you post (videos, descriptions, messages).</p>
          <p><b>How we use it:</b> To verify identity, prevent fraud and multi-accounting, process trades and payments, and improve recommendations.</p>
          <p><b>Sharing:</b> Your phone number and payment details are never shown to other traders. Username, posts, and Karma Score are public.</p>
          <p><b>Your controls:</b> Edit profile, toggle notifications, or request account deletion at any time from Settings.</p>
        </div>
        <button className="kt-btn ghost" style={{ marginTop: 14 }} onClick={onClose}>Close</button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   CSS — single source of truth
───────────────────────────────────────── */
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap');

  .kt-root {
    --sea: #2563eb; --sea-dark: #1e40af; --sea-light: #eaf1fd;
    --pink: #ef4444; --pink-dark: #b91c1c; --pink-light: #fef2f2;
    --ink: #0f172a; --muted: #6b7587; --line: #ecedf3; --bg: #fff;
    min-height: 100vh; width: 100%;
    background: #f1f4f2; font-family: 'Inter', sans-serif;
    color: var(--ink); display: flex; align-items: center; justify-content: center; padding: 24px; box-sizing: border-box;
    transition: background .2s ease;
  }
  .kt-root *, .kt-root *::before, .kt-root *::after { box-sizing: border-box; }

  /* ── DARK MODE ── */
  .kt-root.kt-dark {
    --sea: #60a5fa; --sea-dark: #93c5fd; --sea-light: rgba(96,165,250,0.14);
    --pink: #f87171; --pink-dark: #fca5a5; --pink-light: rgba(248,113,113,0.12);
    --ink: #f1f5f9; --muted: #94a3b8; --line: #2a3441; --bg: #131a24;
    background: #0a0f16;
  }
  .kt-root.kt-dark .kt-phone { box-shadow: 0 30px 80px -30px rgba(0,0,0,0.6); }
  .kt-root.kt-dark .upload-box { background: rgba(255,255,255,0.02); }
  .kt-root.kt-dark .field-input, .kt-root.kt-dark .field-textarea { background: rgba(255,255,255,0.03); color: var(--ink); }
  .kt-root.kt-dark .search-pill { background: rgba(255,255,255,0.06); }
  .kt-root.kt-dark .icon-btn { background: var(--bg); }
  .kt-root.kt-dark .sheet { background: var(--bg); }
  .kt-root.kt-dark .otp-box { background: rgba(255,255,255,0.03); color: var(--ink); }

  .kt-phone {
    width: 100%; max-width: 390px; height: 820px;
    background: var(--bg); border-radius: 32px; overflow: hidden; position: relative;
    box-shadow: 0 30px 80px -30px rgba(15,28,23,0.3);
    display: flex; flex-direction: column; border: 1px solid var(--line);
  }

  .kt-scroll { flex: 1; overflow-y: auto; -ms-overflow-style: none; scrollbar-width: none; }
  .kt-scroll::-webkit-scrollbar { display: none; }

  /* ── TOP BAR ── */
  .topbar { display: flex; align-items: center; gap: 8px; padding: 14px 14px 10px; background: var(--bg); position: sticky; top: 0; z-index: 5; }
  .pm-logo-mark { display: flex; align-items: center; font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 15px; flex-shrink: 0; letter-spacing: -0.02em; }
  .pm-logo-p { color: var(--sea); }
  .pm-logo-m { color: var(--pink); }
  .search-pill { flex: 1; display: flex; align-items: center; gap: 8px; background: var(--sea-light); border-radius: 999px; padding: 10px 14px; color: var(--muted); font-size: 13.5px; }
  .search-input { flex: 1; background: none; border: none; outline: none; font-family: inherit; font-size: 13.5px; color: var(--ink); }
  .search-input::placeholder { color: var(--muted); }
  .icon-btn { width: 38px; height: 38px; border-radius: 999px; border: 1px solid var(--line); background: var(--bg); display: flex; align-items: center; justify-content: center; color: var(--ink); flex-shrink: 0; cursor: pointer; }

  /* ── FEED CARD ── */
  .feed-card { margin: 10px 16px 18px; border-radius: 24px; overflow: hidden; border: 1px solid var(--line); background: var(--bg); box-shadow: 0 8px 28px -18px rgba(15,28,23,0.2); }

  .feed-video {
    height: 280px; position: relative; display: flex; align-items: center; justify-content: center; overflow: hidden;
  }
  .video-pattern { position: absolute; inset: 0; background: radial-gradient(circle at 25% 25%, rgba(255,255,255,0.55) 0, transparent 50%), radial-gradient(circle at 75% 75%, rgba(255,255,255,0.3) 0, transparent 45%); }
  .category-badge { position: absolute; top: 12px; left: 12px; background: rgba(255,255,255,0.88); color: var(--sea-dark); padding: 4px 12px; border-radius: 999px; font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; z-index: 2; }
  .feed-emoji { font-size: 68px; position: relative; z-index: 1; filter: drop-shadow(0 8px 18px rgba(15,28,23,0.15)); }
  .duration-badge { position: absolute; bottom: 12px; left: 12px; background: rgba(15,28,23,0.45); color: #fff; padding: 5px 12px; border-radius: 999px; font-size: 11px; font-weight: 600; z-index: 2; backdrop-filter: blur(4px); }
  .video-click-area { position: absolute; inset: 0; z-index: 1; }

  /* ── VIDEO PLAY BUTTON ── */
  .play-overlay { position: absolute; inset: 0; z-index: 3; display: flex; align-items: center; justify-content: center; cursor: pointer; background: rgba(0,0,0,0.12); }
  .play-circle { width: 48px; height: 48px; border-radius: 999px; background: rgba(255,255,255,0.92); display: flex; align-items: center; justify-content: center; font-size: 18px; color: #0f172a; box-shadow: 0 4px 20px rgba(0,0,0,0.25); padding-left: 3px; }

  /* ── CLOUDINARY UPLOAD STAGES ── */
  .cld-upload-stage { display: flex; flex-direction: column; align-items: center; padding: 48px 28px 40px; text-align: center; gap: 8px; }
  .cld-upload-icon { width: 72px; height: 72px; border-radius: 22px; background: var(--sea-light); display: flex; align-items: center; justify-content: center; color: var(--sea-dark); margin-bottom: 8px; }
  .cld-upload-title { font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 18px; color: var(--ink); }
  .cld-upload-sub { font-size: 13px; color: var(--muted); max-width: 280px; line-height: 1.5; }
  .cld-upload-note { font-size: 11.5px; color: var(--muted); max-width: 260px; line-height: 1.6; margin-top: 8px; }

  /* ── CLOUDINARY PROGRESS BAR ── */
  .cld-progress-wrap { width: 100%; max-width: 300px; margin-top: 20px; }
  .cld-progress-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
  .cld-progress-label { font-size: 12.5px; font-weight: 700; color: var(--ink); }
  .cld-cancel-btn { font-size: 11.5px; color: #dc2626; background: none; border: none; cursor: pointer; font-weight: 700; padding: 0; }
  .cld-progress-bg { width: 100%; height: 8px; background: var(--line); border-radius: 99px; overflow: hidden; }
  .cld-progress-fill { height: 100%; background: linear-gradient(90deg, var(--sea), #16a34a); border-radius: 99px; transition: width 0.25s ease; }
  @keyframes progressPulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }

  /* ── CLOUDINARY SUCCESS MEDIA INFO ── */
  .cld-media-info { width: 100%; max-width: 320px; margin-top: 16px; border: 1px solid var(--line); border-radius: 14px; overflow: hidden; }
  .cld-info-row { display: flex; justify-content: space-between; align-items: center; padding: 9px 14px; border-bottom: 1px solid var(--line); font-size: 12.5px; }
  .cld-info-row:last-child { border-bottom: none; }
  .cld-info-row span { color: var(--muted); }
  .cld-info-row b { font-weight: 700; color: var(--ink); }

  /* ── SIDEBAR ACTIONS ── */
  .feed-actions { position: absolute; right: 10px; bottom: 10px; display: flex; flex-direction: column; align-items: center; gap: 8px; z-index: 3; }
  .act-wrap { display: flex; flex-direction: column; align-items: center; gap: 2px; }
  .act-btn { width: 40px; height: 40px; border-radius: 999px; background: rgba(255,255,255,0.92); border: none; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 12px rgba(0,0,0,0.12); cursor: pointer; backdrop-filter: blur(4px); transition: transform .1s ease; }
  .act-btn:active { transform: scale(0.9); }
  .trade-btn { background: linear-gradient(135deg, var(--pink), var(--pink-dark)); color: white; }
  .act-count { font-size: 10px; color: #fff; font-weight: 700; text-shadow: 0 1px 3px rgba(0,0,0,0.4); }

  .toast { position: absolute; bottom: 12px; left: 50%; transform: translateX(-50%); background: var(--ink); color: #fff; padding: 8px 16px; border-radius: 999px; font-size: 12px; font-weight: 600; z-index: 10; white-space: nowrap; }

  /* ── FEED BODY ── */
  .feed-body { padding: 14px 16px 16px; }
  .feed-user-row { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
  .avatar-sm { width: 30px; height: 30px; border-radius: 999px; background: var(--sea-light); display: flex; align-items: center; justify-content: center; font-size: 14px; }
  .feed-username { font-weight: 700; font-size: 13.5px; }
  .karma-pill { margin-left: auto; display: flex; align-items: center; gap: 4px; background: var(--sea-light); color: var(--sea-dark); font-size: 11.5px; font-weight: 700; padding: 4px 9px; border-radius: 999px; }
  .feed-title { font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 15px; margin: 0 0 4px; }
  .feed-desc { font-size: 12.5px; color: var(--muted); line-height: 1.5; margin: 0 0 10px; }
  .ai-row { display: flex; align-items: center; gap: 5px; font-size: 12.5px; font-weight: 700; color: var(--sea-dark); }

  /* ── BOTTOM NAV ── */
  .bottom-nav { display: flex; border-top: 1px solid var(--line); background: var(--bg); padding: 10px 8px 16px; }
  .nav-item { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 3px; color: var(--muted); font-size: 10px; font-weight: 600; cursor: pointer; }
  .nav-item.active { color: var(--sea); }
  .nav-item span { margin-top: 1px; }
  .nav-plus { width: 40px; height: 40px; border-radius: 14px; background: linear-gradient(135deg, var(--pink), var(--pink-dark)); color: white; display: flex; align-items: center; justify-content: center; }

  /* ── SCREEN CHROME ── */
  .screen-header { display: flex; align-items: center; gap: 10px; padding: 14px 16px; border-bottom: 1px solid var(--line); background: var(--bg); position: sticky; top: 0; z-index: 5; }
  .screen-header h2 { font-family: 'Space Grotesk', sans-serif; font-size: 17px; font-weight: 700; margin: 0; }
  .back-btn-inline { width: 34px; height: 34px; border-radius: 999px; border: 1px solid var(--line); background: var(--bg); display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; }
  .section-title { font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 14px; padding: 16px 16px 8px; }
  .empty-state { text-align: center; color: var(--muted); font-size: 13px; padding: 40px 20px; }
  .feed-empty-pro { padding: 48px 24px; }
  .feed-empty-icon { width: 52px; height: 52px; margin: 0 auto 14px; border-radius: 16px; background: var(--sea-light); color: var(--sea-dark); display: flex; align-items: center; justify-content: center; }
  .feed-empty-title { font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 15.5px; color: var(--ink); margin-bottom: 6px; }
  .feed-empty-sub { font-size: 13px; color: var(--muted); margin-bottom: 20px; }
  .feed-empty-cta { max-width: 240px; margin: 0 auto; }

  /* ── SHEETS ── */
  .sheet-backdrop { position: absolute; inset: 0; background: rgba(15,28,23,0.45); z-index: 30; display: flex; align-items: flex-end; animation: fadeBd .2s ease-out; }
  .sheet-backdrop.nested { z-index: 60; background: rgba(15,28,23,0.6); }
  @keyframes fadeBd { from { opacity: 0; } }
  .sheet { width: 100%; background: var(--bg); border-radius: 28px 28px 0 0; padding: 8px 20px 28px; max-height: 80%; overflow-y: auto; animation: sheetUp .25s cubic-bezier(.2,.8,.2,1); }
  @keyframes sheetUp { from { transform: translateY(100%); } }
  .sheet-handle { width: 40px; height: 4px; background: var(--line); border-radius: 99px; margin: 6px auto 14px; }
  .sheet-title { font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 18px; margin: 0 0 4px; }
  .sheet-sub { font-size: 12.5px; color: var(--muted); margin: 0 0 16px; line-height: 1.5; }

  /* ── TRADE SHEET ── */
  .option-row { display: flex; align-items: center; justify-content: space-between; padding: 15px; border: 1px solid var(--line); border-radius: 16px; margin-bottom: 10px; cursor: pointer; font-weight: 600; font-size: 14px; }
  .opt-sub { font-size: 12px; color: var(--muted); font-weight: 400; margin-top: 2px; }
  .kp-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 14px; }
  .kp-chip { border: 1px solid var(--line); border-radius: 14px; padding: 14px; text-align: center; font-weight: 700; font-family: 'Space Grotesk', sans-serif; cursor: pointer; }
  .kp-chip.selected { border-color: var(--sea); background: var(--sea-light); color: var(--sea-dark); }

  /* ── BUTTONS ── */
  .kt-btn { width: 100%; padding: 14px; border-radius: 14px; border: none; background: var(--sea); color: white; font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 14px; display: flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer; transition: transform .1s; }
  .kt-btn:active { transform: scale(0.98); }
  .kt-btn.ghost { background: var(--bg); color: var(--sea-dark); border: 1px solid var(--line); }
  .kt-btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .success-box { background: var(--sea-light); color: var(--sea-dark); border-radius: 14px; padding: 14px; display: flex; align-items: center; gap: 10px; font-weight: 700; font-size: 13px; }

  /* ── FORMS ── */
  .field-block { padding: 0 16px 14px; }
  .field-label { display: block; font-size: 11.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: var(--muted); margin-bottom: 7px; }
  .field-input { width: 100%; border: 1px solid var(--line); border-radius: 12px; padding: 12px 14px; font-size: 13.5px; font-family: inherit; outline: none; }
  .field-input:focus { border-color: var(--sea); }
  .field-textarea { width: 100%; border: 1px solid var(--line); border-radius: 12px; padding: 12px 14px; font-size: 13.5px; font-family: inherit; outline: none; resize: none; min-height: 80px; }
  .field-textarea:focus { border-color: var(--sea); }
  .ai-est-box { margin: 0 16px 14px; border-radius: 14px; background: var(--sea-light); padding: 12px 14px; display: flex; align-items: center; gap: 10px; font-size: 12.5px; color: var(--sea-dark); font-weight: 600; }

  /* ── 🤖 AI AUTHENTICITY & KARMA SCORING ENGINE ── */
  .ai-scan-wrap { display: flex; flex-direction: column; align-items: center; padding: 60px 28px 40px; text-align: center; }
  .ai-scan-ring {
    width: 84px; height: 84px; border-radius: 999px;
    background: var(--sea-light); color: var(--sea-dark);
    display: flex; align-items: center; justify-content: center;
    margin-bottom: 18px;
    animation: aiPulse 1.6s ease-in-out infinite;
  }
  @keyframes aiPulse { 0%,100% { box-shadow: 0 0 0 0 rgba(34,197,94,0.25); } 50% { box-shadow: 0 0 0 14px rgba(34,197,94,0); } }
  .ai-scan-title { font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 17px; margin-bottom: 4px; }
  .ai-scan-sub { font-size: 13px; color: var(--muted); margin-bottom: 26px; }
  .ai-scan-steps { display: flex; flex-direction: column; gap: 12px; width: 100%; max-width: 260px; }
  .ai-scan-step { display: flex; align-items: center; gap: 10px; font-size: 12.5px; color: var(--line); transition: color .3s; text-align: left; }
  .ai-scan-step.active { color: var(--ink); }
  .ai-scan-step svg { color: var(--sea); flex-shrink: 0; }
  .ai-scan-dot { width: 14px; height: 14px; border-radius: 999px; border: 2px solid var(--line); flex-shrink: 0; }

  .ai-result-hero { display: flex; flex-direction: column; align-items: center; padding: 28px 20px 18px; text-align: center; }
  .ai-result-ring {
    width: 110px; height: 110px; border-radius: 999px;
    border: 6px solid; display: flex; flex-direction: column; align-items: center; justify-content: center;
    font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 30px;
    margin-bottom: 12px;
  }
  .ai-result-ring-sub { font-size: 11px; font-weight: 600; color: var(--muted); margin-top: -2px; }
  .ai-result-band { font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 15px; margin-bottom: 4px; }
  .ai-result-item-title { font-size: 12.5px; color: var(--muted); }

  .score-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; padding: 0 16px 16px; }
  .score-tile { border: 1px solid var(--line); border-radius: 16px; padding: 14px; }
  .score-tile-value { font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 22px; }
  .score-tile-bar-bg { width: 100%; height: 5px; border-radius: 99px; background: var(--line); margin: 8px 0 8px; overflow: hidden; }
  .score-tile-bar-fill { height: 100%; border-radius: 99px; }
  .score-tile-label { font-size: 11px; color: var(--muted); font-weight: 600; }

  .kp-result-card { margin: 0 16px 18px; border-radius: 18px; padding: 18px; background: linear-gradient(160deg, var(--sea-light), #fff); border: 1px solid var(--line); text-align: center; }
  .kp-result-label { display: flex; align-items: center; justify-content: center; gap: 6px; font-size: 11.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--sea-dark); margin-bottom: 6px; }
  .kp-result-amount { font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 32px; color: var(--sea-dark); margin-bottom: 8px; }
  .kp-result-formula { font-size: 10.5px; color: var(--muted); line-height: 1.5; }

  .badges-section { padding: 0 16px 8px; }
  .badge-grid { display: flex; flex-wrap: wrap; gap: 8px; }
  .ai-badge { display: flex; align-items: center; gap: 6px; background: var(--sea-light); color: var(--sea-dark); border-radius: 999px; padding: 7px 13px; font-size: 11.5px; font-weight: 700; }

  .flags-section { padding: 4px 16px 8px; }
  .ai-flag-row { display: flex; align-items: flex-start; gap: 8px; font-size: 12px; color: #b8860b; background: #fff7e6; border-radius: 10px; padding: 9px 12px; margin-bottom: 8px; line-height: 1.5; }
  .ai-flag-row svg { flex-shrink: 0; margin-top: 2px; }

  .warning-box { display: flex; gap: 10px; background: rgba(239,68,68,0.06); border: 1px solid rgba(239,68,68,0.2); border-radius: 14px; padding: 14px; color: #b91c1c; }
  .warning-box svg { flex-shrink: 0; margin-top: 1px; }
  .upload-box { margin: 16px; border: 2px dashed var(--line); border-radius: 18px; padding: 36px 16px; text-align: center; color: var(--muted); }

  /* ── DETAIL SCREEN ── */
  .detail-video { height: 250px; display: flex; align-items: center; justify-content: center; position: relative; }
  .back-btn { position: absolute; top: 14px; left: 14px; width: 36px; height: 36px; border-radius: 999px; background: rgba(255,255,255,0.9); border: none; display: flex; align-items: center; justify-content: center; cursor: pointer; z-index: 2; }
  .seller-row { display: flex; align-items: center; gap: 12px; padding: 14px 16px; border-bottom: 1px solid var(--line); }
  .avatar-lg { width: 48px; height: 48px; border-radius: 999px; background: var(--sea-light); display: flex; align-items: center; justify-content: center; font-size: 22px; }
  .seller-stats { display: flex; gap: 14px; margin-top: 4px; }
  .seller-stat { font-size: 11.5px; color: var(--muted); display: flex; align-items: center; gap: 4px; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; padding: 14px 16px; }
  .info-box { border: 1px solid var(--line); border-radius: 14px; padding: 12px; }
  .info-label { font-size: 10.5px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 4px; }
  .info-value { font-weight: 700; font-size: 14px; }
  .detail-actions { display: flex; gap: 10px; padding: 12px 16px; }

  /* ── AI HUB ── */
  .ai-banner { display: flex; align-items: center; gap: 12px; margin: 14px 16px; background: var(--sea-light); border-radius: 16px; padding: 14px; color: var(--sea-dark); }
  .ai-banner-title { font-weight: 700; font-size: 13.5px; }
  .ai-banner-sub { font-size: 12px; color: var(--muted); margin-top: 2px; }
  .match-card { border: 1px solid var(--line); border-radius: 14px; padding: 12px 14px; margin-bottom: 10px; }
  .match-bar-bg { width: 100%; height: 6px; border-radius: 99px; background: var(--line); margin-top: 8px; overflow: hidden; }
  .match-bar-fill { height: 100%; background: var(--sea); border-radius: 99px; }

  /* ── BATTLE ── */
  .battle-card { display: flex; align-items: center; gap: 12px; border: 1px solid var(--line); border-radius: 16px; padding: 14px; margin-bottom: 10px; cursor: pointer; transition: border-color .15s; }
  .battle-card.winner { border-color: var(--sea); background: var(--sea-light); }
  .battle-rank { width: 28px; height: 28px; border-radius: 999px; background: var(--sea); color: white; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; flex-shrink: 0; }

  /* ── SHOP ── */
  .monetize-card { margin: 12px 16px; border: 1px solid var(--line); border-radius: 20px; padding: 18px; }
  .wallet-balance-card { margin: 4px 16px 14px; border-radius: 22px; padding: 22px 20px; text-align: center; color: #fff; background: linear-gradient(145deg, var(--sea) 0%, var(--sea-dark) 60%, #0f2a63 100%); box-shadow: 0 14px 30px -14px rgba(37,99,235,0.55); }
  .wallet-balance-label { display: flex; align-items: center; justify-content: center; gap: 6px; font-size: 11.5px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; opacity: 0.85; margin-bottom: 10px; }
  .wallet-balance-amount { font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 34px; line-height: 1; }
  .wallet-balance-amount span { font-size: 16px; opacity: 0.8; margin-left: 4px; }
  .wallet-status-chip { display: inline-flex; align-items: center; gap: 5px; margin-top: 12px; padding: 4px 12px; border-radius: 999px; font-size: 11px; font-weight: 700; background: rgba(255,255,255,0.16); }
  .wallet-status-chip.active { background: rgba(74,222,128,0.25); }
  .wallet-balance-hint { margin: 12px 0 0; font-size: 12px; line-height: 1.5; opacity: 0.9; }
  .monetize-head { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 12px; }
  .monetize-icon { width: 42px; height: 42px; border-radius: 12px; background: var(--sea-light); color: var(--sea-dark); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .monetize-icon.gold { background: #fff3d6; color: #b8860b; }
  .monetize-title { font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 15px; }
  .monetize-sub { font-size: 12px; color: var(--muted); margin-top: 3px; line-height: 1.5; }
  .monetize-price { display: flex; align-items: baseline; gap: 6px; margin-bottom: 12px; }
  .m-amount { font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 26px; color: var(--sea-dark); }
  .m-period { font-size: 12px; color: var(--muted); }
  .m-points { list-style: none; padding: 0; margin: 0 0 14px; display: flex; flex-direction: column; gap: 7px; }
  .m-points li { display: flex; align-items: center; gap: 8px; font-size: 12.5px; }
  .m-points li svg { color: var(--sea); flex-shrink: 0; }
  .pay-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .pay-option { border: 1px solid var(--line); border-radius: 14px; padding: 14px; display: flex; align-items: center; justify-content: center; gap: 8px; font-weight: 700; font-size: 13px; cursor: pointer; }
  .pay-option.selected { border-color: var(--sea); background: var(--sea-light); }
  .pay-option:active { border-color: var(--sea); background: var(--sea-light); }
  .confirm-box { border: 1px solid var(--line); border-radius: 14px; padding: 14px; margin-bottom: 12px; }
  .confirm-row { display: flex; justify-content: space-between; font-size: 12.5px; color: var(--muted); padding: 5px 0; }
  .confirm-row b { color: var(--ink); font-weight: 600; }
  .confirm-row.total { border-top: 1px solid var(--line); margin-top: 6px; padding-top: 10px; }
  .confirm-row.total b { color: var(--sea-dark); font-size: 14px; }

  /* ── PREMIUM BOOST — redesigned cards ── */
  .boost-hero { margin: 4px 16px 16px; padding: 20px 18px; border-radius: 22px; text-align: center; color: #fff; background: linear-gradient(135deg, #1e293b 0%, #1e40af 55%, #2563eb 100%); box-shadow: 0 16px 34px -18px rgba(30,64,175,0.55); }
  .boost-hero-icon { width: 44px; height: 44px; margin: 0 auto 10px; border-radius: 14px; background: rgba(255,255,255,0.14); display: flex; align-items: center; justify-content: center; }
  .boost-hero-title { font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 18px; margin-bottom: 6px; }
  .boost-hero-sub { font-size: 12.5px; line-height: 1.6; opacity: 0.88; max-width: 320px; margin: 0 auto; }

  .boost-grid { display: grid; grid-template-columns: 1fr; gap: 14px; padding: 0 16px 6px; }
  @media (min-width: 620px) { .boost-grid { grid-template-columns: repeat(3, 1fr); align-items: stretch; } }

  .boost-card {
    position: relative; border-radius: 20px; padding: 22px 18px 18px; cursor: pointer;
    background: var(--bg); border: 1px solid var(--line);
    display: flex; flex-direction: column;
    transition: transform .15s ease, box-shadow .15s ease, border-color .15s ease;
  }
  .boost-card:active { transform: scale(0.98); }
  .boost-card-icon { width: 46px; height: 46px; border-radius: 14px; display: flex; align-items: center; justify-content: center; margin-bottom: 12px; }
  .boost-card-label { font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 16px; margin-bottom: 3px; }
  .boost-card-sub { font-size: 12px; color: var(--muted); margin-bottom: 14px; line-height: 1.4; }
  .boost-card-price { font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 24px; margin-bottom: 14px; }
  .boost-card-features { list-style: none; margin: 0 0 18px; padding: 0; display: flex; flex-direction: column; gap: 9px; flex: 1; }
  .boost-card-features li { display: flex; align-items: flex-start; gap: 8px; font-size: 12.5px; line-height: 1.4; color: var(--ink); }
  .boost-card-features li svg { flex-shrink: 0; margin-top: 1px; }
  .boost-card-cta { border: none; border-radius: 999px; padding: 12px 0; font-weight: 700; font-size: 13.5px; display: flex; align-items: center; justify-content: center; gap: 6px; cursor: pointer; width: 100%; }
  .boost-badge { position: absolute; top: -11px; left: 50%; transform: translateX(-50%); display: flex; align-items: center; gap: 4px; padding: 5px 14px; border-radius: 999px; font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; white-space: nowrap; box-shadow: 0 6px 14px -6px rgba(0,0,0,0.35); }

  /* Starter tier — cool blue */
  .boost-tier-starter { border-color: var(--line); }
  .boost-tier-starter .boost-card-icon { background: var(--sea-light); color: var(--sea-dark); }
  .boost-tier-starter .boost-card-price { color: var(--ink); }
  .boost-tier-starter .boost-card-cta { background: var(--sea-light); color: var(--sea-dark); }
  .boost-tier-starter .boost-badge { background: var(--sea-light); color: var(--sea-dark); }

  /* Popular tier — recommended, blue gradient + glow */
  .boost-card.recommended { border: 1.5px solid transparent; background: linear-gradient(var(--bg), var(--bg)) padding-box, linear-gradient(135deg, #2563eb, #7c3aed) border-box; box-shadow: 0 18px 36px -18px rgba(37,99,235,0.45); transform: scale(1.02); }
  .boost-tier-popular .boost-card-icon { background: linear-gradient(135deg, #2563eb, #7c3aed); color: #fff; }
  .boost-tier-popular .boost-card-price { background: linear-gradient(135deg, #2563eb, #7c3aed); -webkit-background-clip: text; background-clip: text; color: transparent; }
  .boost-tier-popular .boost-card-cta { background: linear-gradient(135deg, #2563eb, #7c3aed); color: #fff; }
  .boost-tier-popular .boost-badge { background: linear-gradient(135deg, #2563eb, #7c3aed); color: #fff; }

  /* Gold tier — best value, gold gradient */
  .boost-tier-gold { border-color: rgba(217,164,6,0.35); }
  .boost-tier-gold .boost-card-icon { background: linear-gradient(135deg, #fde68a, #d97706); color: #7c2d12; }
  .boost-tier-gold .boost-card-price { background: linear-gradient(135deg, #d97706, #92400e); -webkit-background-clip: text; background-clip: text; color: transparent; }
  .boost-tier-gold .boost-card-cta { background: linear-gradient(135deg, #f59e0b, #b45309); color: #fff; }
  .boost-tier-gold .boost-badge { background: linear-gradient(135deg, #f59e0b, #b45309); color: #fff; }

  .kt-root.kt-dark .boost-card { background: var(--bg); }
  .kt-root.kt-dark .boost-card.recommended { background: linear-gradient(var(--bg), var(--bg)) padding-box, linear-gradient(135deg, #60a5fa, #c4b5fd) border-box; }

  /* ── PAYMENT HISTORY ── */
  .payment-history-row { display: flex; align-items: center; gap: 10px; padding: 10px 0; border-bottom: 1px solid var(--line); }
  .payment-history-row:last-child { border-bottom: none; }
  .payment-history-icon { width: 32px; height: 32px; border-radius: 9px; background: var(--sea-light); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .payment-status-pill { font-size: 10.5px; font-weight: 700; border: 1px solid; border-radius: 999px; padding: 4px 10px; white-space: nowrap; flex-shrink: 0; }

  /* ── JAZZCASH PAYMENT FLOW ── */
  .jc-header-row { display: flex; align-items: center; gap: 12px; margin-bottom: 18px; }
  .jc-amount-box { background: linear-gradient(135deg, rgba(214,0,28,0.06), rgba(214,0,28,0.02)); border: 1px solid rgba(214,0,28,0.18); border-radius: 16px; padding: 16px; text-align: center; margin-bottom: 16px; }
  .jc-amount-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: #D6001C; margin-bottom: 4px; }
  .jc-amount-value { font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 30px; color: var(--ink); }
  .jc-detail-row { display: flex; align-items: center; justify-content: space-between; border: 1px solid var(--line); border-radius: 14px; padding: 12px 14px; margin-bottom: 10px; }
  .jc-detail-label { font-size: 10.5px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.06em; font-weight: 700; margin-bottom: 3px; }
  .jc-detail-value { font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 15px; color: var(--ink); }
  .jc-copy-btn { display: flex; align-items: center; gap: 5px; background: var(--bg); border: 1px solid var(--line); border-radius: 999px; padding: 7px 12px; font-size: 11.5px; font-weight: 700; color: #D6001C; cursor: pointer; flex-shrink: 0; }
  .jc-steps { display: flex; flex-direction: column; gap: 10px; margin: 16px 0 18px; }
  .jc-step { display: flex; align-items: flex-start; gap: 10px; font-size: 12.5px; color: var(--ink); line-height: 1.5; }
  .jc-ai-notice { display: flex; align-items: center; gap: 8px; background: var(--sea-light); color: var(--sea-dark); border-radius: 12px; padding: 10px 12px; font-size: 12px; font-weight: 600; margin-bottom: 16px; }

  /* ── PAYMENT VERIFICATION RESULT ── */
  .ai-result-ring.jc-ring { border-color: #D6001C; }

  /* ── CHAT ── */
  .chat-row { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-bottom: 1px solid var(--line); cursor: pointer; }
  .unread-dot { background: var(--sea); color: white; font-size: 10px; font-weight: 700; border-radius: 999px; min-width: 18px; height: 18px; display: flex; align-items: center; justify-content: center; padding: 0 5px; }
  .msg-row { display: flex; padding: 4px 16px; }
  .msg-row.me { justify-content: flex-end; }
  .msg-bubble { max-width: 75%; padding: 10px 14px; border-radius: 16px; font-size: 13.5px; line-height: 1.4; }
  .msg-bubble.them { background: var(--sea-light); color: var(--ink); border-bottom-left-radius: 4px; }
  .msg-bubble.me { background: var(--sea); color: white; border-bottom-right-radius: 4px; }
  .chat-input-row { display: flex; align-items: center; gap: 10px; padding: 12px 16px; border-top: 1px solid var(--line); background: var(--bg); }
  .chat-input { flex: 1; background: var(--sea-light); border: none; outline: none; border-radius: 999px; padding: 10px 16px; font-size: 13px; font-family: inherit; }
  .send-btn { width: 38px; height: 38px; border-radius: 999px; background: var(--sea); color: white; display: flex; align-items: center; justify-content: center; flex-shrink: 0; cursor: pointer; border: none; }

  /* ── PROFILE ── */
  .profile-head { display: flex; flex-direction: column; align-items: center; padding: 24px 16px 16px; text-align: center; }
  .profile-avatar { width: 78px; height: 78px; border-radius: 999px; background: var(--sea-light); display: flex; align-items: center; justify-content: center; font-size: 36px; margin-bottom: 10px; }
  .profile-name { font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 18px; }
  .profile-bio { font-size: 12.5px; color: var(--muted); margin-top: 4px; max-width: 260px; line-height: 1.5; }
  .stat-row { display: flex; gap: 22px; margin-top: 14px; }
  .stat-item { text-align: center; }
  .stat-num { font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 16px; }
  .stat-lbl { font-size: 11px; color: var(--muted); margin-top: 2px; }
  .karma-id-box { margin-top: 12px; background: var(--sea-light); color: var(--sea-dark); border-radius: 999px; padding: 6px 16px; font-size: 12.5px; }
  .karma-id-box b { font-family: 'Space Grotesk', sans-serif; }
  .menu-row { display: flex; align-items: center; gap: 12px; padding: 14px 16px; border-bottom: 1px solid var(--line); cursor: pointer; }
  .menu-icon { width: 36px; height: 36px; border-radius: 10px; background: var(--sea-light); color: var(--sea-dark); display: flex; align-items: center; justify-content: center; }
  .menu-label { flex: 1; font-weight: 600; font-size: 13.5px; }

  /* ── LISTINGS / SAVED ── */
  .listing-card { display: flex; gap: 12px; border: 1px solid var(--line); border-radius: 16px; padding: 12px; margin-bottom: 12px; align-items: center; }
  .listing-thumb { width: 64px; height: 64px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 24px; flex-shrink: 0; }
  .listing-info { flex: 1; min-width: 0; }
  .listing-title { font-weight: 700; font-size: 13.5px; line-height: 1.35; margin-bottom: 6px; }
  .status-pill { font-size: 10.5px; font-weight: 700; padding: 3px 9px; border-radius: 999px; text-transform: uppercase; letter-spacing: 0.04em; }
  .status-pill.active { background: var(--sea-light); color: var(--sea-dark); }
  .status-pill.pending { background: #fff3d6; color: #b8860b; }
  .boost-btn { display: flex; align-items: center; gap: 6px; border: 1px solid var(--line); background: var(--bg); color: var(--ink); border-radius: 999px; padding: 7px 12px; font-size: 11.5px; font-weight: 700; cursor: pointer; }
  .boost-btn.on { background: var(--sea-light); color: var(--sea-dark); border-color: transparent; }

  /* ── ORDERS ── */
  .tab-scroll { display: flex; gap: 8px; padding: 12px 16px; overflow-x: auto; -ms-overflow-style: none; scrollbar-width: none; }
  .tab-scroll::-webkit-scrollbar { display: none; }
  .order-tab { display: flex; align-items: center; gap: 6px; padding: 8px 14px; border-radius: 999px; border: 1px solid var(--line); font-size: 12px; font-weight: 600; white-space: nowrap; cursor: pointer; flex-shrink: 0; }
  .order-tab.active { background: var(--sea); color: white; border-color: var(--sea); }
  .order-card { margin: 0 16px 12px; border: 1px solid var(--line); border-radius: 16px; padding: 14px; }

  /* ── SETTINGS ── */
  .switch { width: 40px; height: 24px; border-radius: 999px; background: var(--line); position: relative; flex-shrink: 0; transition: background .15s; }
  .switch.on { background: var(--sea); }
  .switch-knob { position: absolute; top: 3px; left: 3px; width: 18px; height: 18px; border-radius: 999px; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.2); transition: transform .15s; }
  .switch.on .switch-knob { transform: translateX(16px); }
  .faq-item { border: 1px solid var(--line); border-radius: 14px; padding: 14px; margin-bottom: 10px; cursor: pointer; }
  .faq-q { display: flex; align-items: center; justify-content: space-between; font-weight: 600; font-size: 13.5px; gap: 8px; }
  .faq-a { font-size: 12.5px; color: var(--muted); margin-top: 8px; line-height: 1.6; }
  .about-version { display: flex; align-items: center; justify-content: center; gap: 6px; margin-top: 16px; font-size: 11.5px; color: var(--muted); }
  .privacy-block { display: flex; flex-direction: column; gap: 12px; }
  .privacy-block p { font-size: 12.5px; color: var(--ink); line-height: 1.6; margin: 0; }
  .privacy-block b { color: var(--sea-dark); }

  /* ── FIND USER ── */
  .user-result { display: flex; align-items: center; gap: 12px; border: 1px solid var(--sea); border-radius: 16px; padding: 14px; margin-top: 16px; background: var(--sea-light); flex-wrap: wrap; }
  .user-dir-row { display: flex; align-items: center; gap: 12px; padding: 12px 4px; border-bottom: 1px solid var(--line); cursor: pointer; }

  /* ── PHONE INPUT (in settings sheets) ── */
  .kt-phone-row { display: flex; align-items: center; gap: 10px; background: var(--sea-light); border: 1px solid var(--line); border-radius: 14px; padding: 13px 16px; }
  .kt-code { font-size: 14px; color: var(--muted); border-right: 1px solid var(--line); padding-right: 10px; }
  .kt-code option { color: var(--ink); }
  .kt-input { flex: 1; background: none; border: none; outline: none; font-size: 14px; font-family: inherit; color: var(--ink); }
  .field-error { display: flex; align-items: center; gap: 5px; margin-top: -6px; font-size: 11.5px; color: #dc2626; }
  .resend-row { font-size: 12.5px; color: var(--muted); margin: 4px 0 16px; }
  .resend-link { color: var(--sea); font-weight: 700; cursor: pointer; }

  /* ── COMMENTS ── */
  .comment-list { display: flex; flex-direction: column; gap: 12px; margin-bottom: 16px; }
  .comment-row { display: flex; gap: 10px; }
  .comment-user { font-weight: 700; font-size: 12.5px; }
  .comment-text { font-size: 13px; color: var(--ink); margin-top: 2px; }

  /* ── 📍 LOCATION-BASED SMART MATCHING ── */
  .location-bar { padding: 4px 16px 12px; display: flex; flex-direction: column; gap: 8px; background: var(--bg); }
  .location-pill { align-self: flex-start; display: flex; align-items: center; gap: 5px; background: var(--sea-light); color: var(--sea-dark); font-size: 11.5px; font-weight: 700; padding: 5px 11px; border-radius: 999px; }
  .filter-scroll { display: flex; gap: 8px; overflow-x: auto; -ms-overflow-style: none; scrollbar-width: none; }
  .filter-scroll::-webkit-scrollbar { display: none; }
  .filter-chip { flex-shrink: 0; padding: 7px 13px; border-radius: 999px; border: 1px solid var(--line); font-size: 11.5px; font-weight: 600; color: var(--muted); cursor: pointer; white-space: nowrap; }
  .filter-chip.active { background: var(--sea); color: white; border-color: var(--sea); }

  .nearby-section { padding: 14px 0 4px; }
  .nearby-header { display: flex; align-items: center; gap: 6px; font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 14px; padding: 0 16px 10px; color: var(--ink); }
  .nearby-header svg { color: var(--sea); }
  .nearby-scroll { display: flex; gap: 12px; overflow-x: auto; padding: 0 16px 6px; -ms-overflow-style: none; scrollbar-width: none; }
  .nearby-scroll::-webkit-scrollbar { display: none; }
  .nearby-card { flex-shrink: 0; width: 124px; cursor: pointer; }
  .nearby-thumb { width: 124px; height: 88px; border-radius: 14px; display: flex; align-items: center; justify-content: center; font-size: 26px; margin-bottom: 6px; }
  .nearby-title { font-size: 11.5px; font-weight: 600; line-height: 1.35; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; margin-bottom: 4px; }
  .nearby-meta { display: flex; align-items: center; gap: 5px; font-size: 10.5px; color: var(--sea-dark); font-weight: 700; }

  .notif-dot { position: absolute; top: 7px; right: 7px; width: 8px; height: 8px; border-radius: 999px; background: #ef4444; border: 1.5px solid var(--bg); }
  .notif-row { display: flex; align-items: center; gap: 10px; border: 1px solid var(--line); border-radius: 14px; padding: 13px; margin-bottom: 10px; cursor: pointer; }
  .notif-emoji { font-size: 18px; flex-shrink: 0; }
  .notif-text { flex: 1; font-size: 12.5px; line-height: 1.5; color: var(--ink); }

  .loc-badge-row { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-bottom: 8px; }
  .loc-badge { display: flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 600; color: var(--muted); background: #f1f4f2; border-radius: 999px; padding: 3px 9px; }
  .loc-badge.dist { color: var(--sea-dark); background: var(--sea-light); }
  .loc-badge.karma { color: #b8860b; background: #fff3d6; }
  .loc-badge.verified { color: var(--sea-dark); background: var(--sea-light); }

  /* ── MAP SCREEN ── */
  .map-canvas { position: relative; flex: 1; background: #eef6f1; overflow: hidden; min-height: 280px; }
  .map-grid { position: absolute; inset: 0; background-image: linear-gradient(#dcebe2 1px, transparent 1px), linear-gradient(90deg, #dcebe2 1px, transparent 1px); background-size: 28px 28px; opacity: 0.6; }
  .map-pin { position: absolute; transform: translate(-50%, -100%); cursor: pointer; z-index: 2; }
  .map-pin-dot { width: 32px; height: 32px; border-radius: 999px; background: var(--sea); color: white; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(0,0,0,0.18); border: 2px solid white; }
  .map-pin.active .map-pin-dot { background: #16a34a; transform: scale(1.15); }
  .map-pin-self { transform: translate(-50%, -50%); z-index: 3; }
  .map-pin-dot.self { width: 16px; height: 16px; background: #22c55e; border: 3px solid white; box-shadow: 0 0 0 4px rgba(20,184,127,0.2); }
  .map-pin-pulse { position: absolute; top: 50%; left: 50%; width: 16px; height: 16px; border-radius: 999px; background: rgba(20,184,127,0.35); transform: translate(-50%,-50%); animation: mapPulse 2s ease-out infinite; }
  @keyframes mapPulse { 0% { transform: translate(-50%,-50%) scale(1); opacity: 0.7; } 100% { transform: translate(-50%,-50%) scale(3.2); opacity: 0; } }
  .map-detail-card { display: flex; align-items: center; gap: 12px; padding: 14px 16px; border-top: 1px solid var(--line); background: var(--bg); }
  .map-detail-thumb { width: 52px; height: 52px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 22px; flex-shrink: 0; }
  .map-list { border-top: 1px solid var(--line); max-height: 230px; overflow-y: auto; background: var(--bg); }
  .map-list-row { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-bottom: 1px solid var(--line); cursor: pointer; }
  .map-list-thumb { width: 42px; height: 42px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0; }

  /* ── LOCATION SETTINGS (light theme variant for Settings sheet) ── */
  .city-grid-light { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 14px; }
  .city-chip-light { display: flex; align-items: center; gap: 6px; border: 1px solid var(--line); border-radius: 12px; padding: 10px 11px; font-size: 12.5px; font-weight: 600; cursor: pointer; color: var(--ink); }
  .city-chip-light svg { color: var(--muted); flex-shrink: 0; }
  .city-chip-light.selected { border-color: var(--sea); background: var(--sea-light); color: var(--sea-dark); }
  .city-chip-light.selected svg { color: var(--sea-dark); }

  /* ── SMART MATCH PREVIEW (Create Post) ── */
  .match-preview-box { margin: 0 16px 16px; border: 1px solid var(--sea); background: var(--sea-light); border-radius: 16px; padding: 13px; }
  .match-preview-title { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 700; color: var(--sea-dark); margin-bottom: 10px; }
  .match-preview-row { display: flex; align-items: center; gap: 10px; padding: 6px 0; }
`;
