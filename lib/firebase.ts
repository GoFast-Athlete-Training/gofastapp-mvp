import { initializeApp, getApps, getApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getAuth, setPersistence, browserLocalPersistence } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyCjpoH763y2GH4VDc181IUBaZHqE_ryZ1c",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "gofast-a5f94.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "gofast-a5f94",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "gofast-a5f94.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "500941094498",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:500941094498:web:4008d94b89a9e3a4889b3b",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-CQ0GJCJLXX",
};

export const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);

// Set persistence to keep user logged in across page refreshes
// This is critical for preventing logout on refresh
// Only set persistence in browser, and only if auth is available
if (typeof window !== "undefined") {
  try {
    setPersistence(auth, browserLocalPersistence).catch((error) => {
      // Silently fail during build - will work at runtime
      if (process.env.NODE_ENV !== "production" || typeof window !== "undefined") {
        console.error("Failed to set auth persistence:", error);
      }
    });
  } catch (error) {
    // Ignore errors during build
  }
}

// Initialize Analytics (only in browser, async)
let analytics: ReturnType<typeof getAnalytics> | null = null;
if (typeof window !== "undefined") {
  isSupported().then((yes) => {
    if (yes) {
      analytics = getAnalytics(app);
    }
  });
}
