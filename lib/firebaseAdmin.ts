import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth, Auth } from "firebase-admin/auth";

let adminApp: ReturnType<typeof initializeApp> | null = null;
let _adminAuth: Auth | null = null;

function getAdminApp() {
  if (typeof window !== "undefined") {
    throw new Error("Firebase Admin cannot run client-side");
  }

  if (adminApp) {
    return adminApp;
  }

  const existing = getApps();
  if (existing.length > 0) {
    adminApp = existing[0];
    _adminAuth = getAuth(adminApp);
    return adminApp;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    console.warn("⚠️ FIREBASE ADMIN: Missing environment variables");
    throw new Error("Firebase Admin environment variables not set");
  }

  const adminConfig = {
    projectId,
    clientEmail,
    privateKey: privateKey.replace(/\\n/g, "\n"),
  };

  adminApp = initializeApp({ credential: cert(adminConfig) });
  _adminAuth = getAuth(adminApp);
  
  console.log("✅ Firebase Admin initialized with project:", projectId);
  
  return adminApp;
}

export { getAdminApp };

export const adminAuth = new Proxy({} as Auth, {
  get(_target, prop) {
    if (!_adminAuth) {
      getAdminApp();
    }
    return (_adminAuth as any)[prop];
  },
});
