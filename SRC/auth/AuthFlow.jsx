// ── Extracted from App.jsx: AuthFlow ──
import AUTH_CSS from "../styles/auth.css?raw";
import React, { useState, useEffect, useRef } from "react";
import {
  Send
} from "lucide-react";
import {
  onAuthStateChanged,
  signInWithPhoneNumber,
  RecaptchaVerifier,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signInWithEmailAndPassword,
  EmailAuthProvider,
  linkWithCredential,
} from "firebase/auth";
import { auth } from "../firebase";
import { createUserProfile, getUserProfile, touchLastSeen } from "../services/userService";
import { LocationScreen } from "./LocationScreen";
import { LoginPhoneScreen } from "./LoginPhoneScreen";
import { OtpScreen } from "./OtpScreen";
import { SecurityScreen } from "./SecurityScreen";
import { SignupScreen } from "./SignupScreen";
import { SplashScreen } from "./SplashScreen";
import { SuccessScreen } from "./SuccessScreen";
import { PmHexLogo } from "../components/PmHexLogo";
import { generateFingerprint, getFriendlyAuthError } from "../utils/firebaseHelpers";
import { DEFAULT_LOCATION } from "../utils/location";

export function AuthFlow({ onComplete, onAdminMode }) {
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

