// ── Extracted from App.jsx: generateFingerprint, getFriendlyAuthError ──
import { auth } from "../firebase";

export function generateFingerprint() {
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


export function getFriendlyAuthError(error, fallback) {
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

