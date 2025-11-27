import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';

let app: App;
let adminAuth: Auth;

if (typeof window === 'undefined') {
  // Server-side only
  if (getApps().length === 0) {
    // Support both formats:
    // 1. FIREBASE_SERVICE_ACCOUNT as JSON string (from Render/backend)
    // 2. Individual fields (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY)
    let serviceAccount;
    
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      // Parse JSON string (backend format)
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    } else {
      // Use individual fields
      serviceAccount = {
        projectId: process.env.FIREBASE_PROJECT_ID || 'gofast-a5f94',
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      };
    }

    if (!serviceAccount.projectId || !serviceAccount.clientEmail || !serviceAccount.privateKey) {
      throw new Error('Firebase Admin credentials not configured. Set FIREBASE_SERVICE_ACCOUNT or individual fields.');
    }

    app = initializeApp({
      credential: cert(serviceAccount as any),
    });
  } else {
    app = getApps()[0];
  }
  adminAuth = getAuth(app);
}

export { adminAuth };

export async function verifyFirebaseIdToken(token: string) {
  if (typeof window !== 'undefined') {
    throw new Error('verifyFirebaseIdToken can only be called on the server');
  }
  return adminAuth.verifyIdToken(token);
}

