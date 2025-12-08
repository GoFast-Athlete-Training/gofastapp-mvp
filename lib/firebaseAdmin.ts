// lib/firebaseAdmin.ts
import * as admin from "firebase-admin";

let adminAuthInstance: admin.auth.Auth | null = null;

export function getAdminAuth(): admin.auth.Auth {
  if (adminAuthInstance) {
    return adminAuthInstance;
  }

  if (!admin.apps.length) {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (!projectId || !clientEmail || !privateKey) {
      const missing = [];
      if (!projectId) missing.push('FIREBASE_PROJECT_ID');
      if (!clientEmail) missing.push('FIREBASE_CLIENT_EMAIL');
      if (!privateKey) missing.push('FIREBASE_PRIVATE_KEY');
      throw new Error(`❌ Firebase Admin env vars missing: ${missing.join(', ')}`);
    }

    try {
      // Replace escaped newlines
      const cleanPrivateKey = privateKey.replace(/\\n/g, "\n");

      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey: cleanPrivateKey,
        }),
      });

      console.log("🔥 Firebase Admin initialized for project:", projectId);
    } catch (err: any) {
      console.error("❌ Firebase Admin initialization failed:", err?.message);
      throw new Error(`❌ Firebase Admin initialization failed: ${err?.message}`);
    }
  }

  adminAuthInstance = admin.auth();
  return adminAuthInstance;
}

// Lazy initialization - only initializes when actually used (at runtime, not build time)
export const adminAuth = new Proxy({} as admin.auth.Auth, {
  get(_target, prop) {
    return getAdminAuth()[prop as keyof admin.auth.Auth];
  },
});
