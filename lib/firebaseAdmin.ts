import { initializeApp, getApps, cert, App } from "firebase-admin/app";
import { getAuth, Auth } from "firebase-admin/auth";

let app: App | null = null;
let adminAuth: Auth | null = null;

function safeGetServiceAccount() {
  const env = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!env) return null;

  try {
    const json = JSON.parse(env);
    return {
      projectId: json.project_id || json.projectId,
      clientEmail: json.client_email || json.clientEmail,
      privateKey: (json.private_key || json.privateKey)?.replace(/\\n/g, "\n"),
    };
  } catch (err) {
    console.error("❌ FIREBASE: Invalid FIREBASE_SERVICE_ACCOUNT JSON", err);
    return null;
  }
}

export function initAdmin() {
  if (typeof window !== "undefined") return;

  if (app) return app;

  const existing = getApps();
  if (existing.length > 0) {
    app = existing[0];
    adminAuth = getAuth(app);
    return app;
  }

  const serviceAccount = safeGetServiceAccount();

  if (!serviceAccount) {
    console.warn("⚠️ FIREBASE ADMIN DISABLED: No service account provided");
    return null;
  }

  app = initializeApp({
    credential: cert(serviceAccount as any),
    projectId: serviceAccount.projectId,
  });

  adminAuth = getAuth(app);
  console.log("✅ Firebase Admin initialized with project:", serviceAccount.projectId);
  console.log("🔍 Firebase Admin client email:", serviceAccount.clientEmail);
  
  // Verify project matches client
  const expectedProjectId = "gofast-a5f94";
  if (serviceAccount.projectId !== expectedProjectId) {
    console.error("❌ FIREBASE PROJECT MISMATCH!");
    console.error(`   Backend Admin project: ${serviceAccount.projectId}`);
    console.error(`   Client project: ${expectedProjectId}`);
    console.error("   ⚠️ These MUST match or token verification will fail!");
  } else {
    console.log("✅ Firebase project matches client (gofast-a5f94)");
  }

  return app;
}

export function getAdminAuth() {
  if (typeof window !== "undefined") {
    throw new Error("Firebase Admin cannot run client-side");
  }

  if (!adminAuth) initAdmin();
  return adminAuth;
}

export async function verifyFirebaseIdToken(token: string) {
  const auth = getAdminAuth();
  if (!auth) {
    console.warn("⚠️ verifyFirebaseIdToken called but Admin not initialized");
    return null;
  }
  return auth.verifyIdToken(token);
}
