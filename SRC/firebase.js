// =============================================================================
//  src/firebase.js  ·  Point Market — Firebase Initialization
//  Single source of truth for the Firebase app, Auth, Firestore, and Storage
//  instances. Every other file imports { auth, db, storage } from here —
//  never re-initializes Firebase anywhere else in the codebase.
//
//  Env vars (optional): if VITE_FIREBASE_* variables are present (e.g. set
//  in Vercel → Project Settings → Environment Variables), they take
//  precedence. Otherwise the app falls back to the values below so local
//  dev and existing deployments keep working without extra setup.
// =============================================================================
import { initializeApp, getApps } from "firebase/app";
import { getAuth, setPersistence, browserLocalPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey:             import.meta.env.VITE_FIREBASE_API_KEY             || "AIzaSyCwZ9DknsQplM86ZViFd-bdvb2NYkZNsmw",
  authDomain:         import.meta.env.VITE_FIREBASE_AUTH_DOMAIN         || "point-market-2b267.firebaseapp.com",
  projectId:          import.meta.env.VITE_FIREBASE_PROJECT_ID         || "point-market-2b267",
  storageBucket:      import.meta.env.VITE_FIREBASE_STORAGE_BUCKET     || "point-market-2b267.firebasestorage.app",
  messagingSenderId:  import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID|| "341808689412",
  appId:              import.meta.env.VITE_FIREBASE_APP_ID            || "1:341808689412:web:ebd7426c06fcca28f5a051",
};

// Idempotent init — safe under Vite HMR (hot module reload) and guards
// against ever accidentally calling initializeApp() twice in one runtime.
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

export const auth    = getAuth(app);
export const db      = getFirestore(app);
export const storage = getStorage(app);

// Keep users signed in across page reloads (auto-login, like WhatsApp)
setPersistence(auth, browserLocalPersistence).catch(() => {
  // Persistence can fail in some private-browsing contexts — auth still
  // works for the current session, it just won't survive a hard refresh.
});

export default app;
