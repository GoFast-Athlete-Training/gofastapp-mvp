import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getAuth, setPersistence, browserLocalPersistence, type Auth } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "gofast-nextapp.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "gofast-nextapp",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "gofast-nextapp.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "243085846592",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:243085846592:web:1b6a1e397cd14aec9fd7a5",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-SF8QF8FCE2",
};

let clientApp: FirebaseApp | undefined;
let clientAuth: Auth | undefined;

if (typeof window !== "undefined") {
  try {
    clientApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
    clientAuth = getAuth(clientApp);
    setPersistence(clientAuth, browserLocalPersistence).catch((error) => {
      if (process.env.NODE_ENV !== "production" || typeof window !== "undefined") {
        console.error("Failed to set auth persistence:", error);
      }
    });
  } catch (error) {
    console.error("Firebase client initialization failed:", error);
  }
}

/** Placeholder so `auth.currentUser` during SSR / static prerender is safe (real auth loads in the browser). */
const authSsrPlaceholder = { currentUser: null } as Auth;

export const app = (clientApp ?? ({} as FirebaseApp)) as FirebaseApp;

export const auth = (clientAuth ?? authSsrPlaceholder) as Auth;

// Initialize Analytics (only in browser, async)
let analytics: ReturnType<typeof getAnalytics> | null = null;
if (typeof window !== "undefined" && clientApp) {
  isSupported().then((yes) => {
    if (yes && clientApp) {
      analytics = getAnalytics(clientApp);
    }
  });
}
