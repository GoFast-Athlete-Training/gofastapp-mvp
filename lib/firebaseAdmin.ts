import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';

let app: App | null = null;
let adminAuth: Auth | null = null;

/**
 * Initialize Firebase Admin SDK (lazy initialization)
 * Matches backend pattern from gofastbackendv2-fall2025
 */
function initializeFirebase(): App {
  if (typeof window !== 'undefined') {
    throw new Error('Firebase Admin can only be initialized on the server');
  }

  // Return existing app if already initialized
  if (app) {
    return app;
  }

  try {
    // Check if already initialized globally
    const existingApps = getApps();
    if (existingApps.length > 0) {
      app = existingApps[0];
      adminAuth = getAuth(app);
      console.log('✅ FIREBASE: Admin SDK already initialized');
      return app;
    }

    // Get Firebase service account from environment
    const serviceAccountEnv = process.env.FIREBASE_SERVICE_ACCOUNT;
    
    if (!serviceAccountEnv) {
      console.error('❌ FIREBASE: FIREBASE_SERVICE_ACCOUNT environment variable not set');
      console.error('❌ FIREBASE: Set this in Vercel environment variables as FIREBASE_SERVICE_ACCOUNT');
      throw new Error('Firebase service account not configured. Set FIREBASE_SERVICE_ACCOUNT environment variable.');
    }

    // Parse service account JSON
    let serviceAccount;
    try {
      serviceAccount = JSON.parse(serviceAccountEnv);
    } catch (parseError) {
      console.error('❌ FIREBASE: Failed to parse FIREBASE_SERVICE_ACCOUNT JSON:', parseError);
      throw new Error('FIREBASE_SERVICE_ACCOUNT is not valid JSON. Check your environment variable.');
    }

    // Validate required fields
    if (!serviceAccount.project_id && !serviceAccount.projectId) {
      throw new Error('Firebase service account missing project_id');
    }
    if (!serviceAccount.client_email && !serviceAccount.clientEmail) {
      throw new Error('Firebase service account missing client_email');
    }
    if (!serviceAccount.private_key && !serviceAccount.privateKey) {
      throw new Error('Firebase service account missing private_key');
    }

    // Normalize field names (service account can have either format)
    const normalizedAccount = {
      projectId: serviceAccount.project_id || serviceAccount.projectId,
      clientEmail: serviceAccount.client_email || serviceAccount.clientEmail,
      privateKey: (serviceAccount.private_key || serviceAccount.privateKey)?.replace(/\\n/g, '\n'),
    };

    // Initialize Firebase Admin
    app = initializeApp({
      credential: cert(normalizedAccount as any),
      projectId: normalizedAccount.projectId,
    });

    adminAuth = getAuth(app);

    console.log('✅ FIREBASE: Admin SDK initialized successfully');
    console.log('✅ FIREBASE: Project ID:', normalizedAccount.projectId);
    
    return app;
  } catch (error: any) {
    console.error('❌ FIREBASE: Failed to initialize Admin SDK:', error.message);
    throw error;
  }
}

/**
 * Get Firebase Admin Auth instance
 * Initializes if not already done
 */
export function getAdminAuth(): Auth {
  if (typeof window !== 'undefined') {
    throw new Error('Firebase Admin can only be used on the server');
  }

  if (!adminAuth) {
    initializeFirebase();
  }

  if (!adminAuth) {
    throw new Error('Failed to initialize Firebase Admin Auth');
  }

  return adminAuth;
}

/**
 * Verify Firebase ID Token
 * Server-side only
 */
export async function verifyFirebaseIdToken(token: string) {
  if (typeof window !== 'undefined') {
    throw new Error('verifyFirebaseIdToken can only be called on the server');
  }

  const auth = getAdminAuth();
  return auth.verifyIdToken(token);
}

// Export for backward compatibility
export { adminAuth };

