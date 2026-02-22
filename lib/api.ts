'use client';

import axios from 'axios';
import { auth } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || '/api',
});

/**
 * Wait for Firebase auth state to resolve.
 * auth.currentUser is null immediately after page load even when the user IS
 * authenticated — Firebase restores the session asynchronously. If we fire a
 * request before that happens we get 401s for fully authenticated users.
 */
function waitForAuthUser(timeoutMs = 5000): Promise<import('firebase/auth').User | null> {
  return new Promise((resolve) => {
    // NOTE: auth.currentUser starts as null (not undefined) while Firebase is
    // still rehydrating the session — DO NOT early-return on null here.
    // onAuthStateChanged fires synchronously if auth is already resolved,
    // so this is safe and fast for both fresh loads and navigations.
    const timer = setTimeout(() => {
      unsubscribe();
      resolve(null);
    }, timeoutMs);

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      clearTimeout(timer);
      unsubscribe();
      resolve(user);
    });
  });
}

// ── Request interceptor ────────────────────────────────────────────────────────
api.interceptors.request.use(async (config) => {
  // If a caller already set Authorization (e.g. explicit token pass), respect it
  if (config.headers['Authorization']) {
    return config;
  }

  // Get current user — wait for Firebase to restore session (refresh token persists in localStorage)
  let user = auth.currentUser;
  if (!user) {
    user = await waitForAuthUser(5000);
  }

  if (user) {
    try {
      const token = await user.getIdToken();
      config.headers['Authorization'] = `Bearer ${token}`;
    } catch (err) {
      console.error('❌ API: Failed to get Firebase token:', err);
    }
  }

  return config;
});

// ── Response interceptor ───────────────────────────────────────────────────────
// DO NOT redirect on 401. On 401, retry the request once with a force-refreshed
// token (Firebase uses the refresh token to get a new ID token). Handles "I'm
// logged in but my token expired" without asking the user to sign in again.
const RETRY_KEY = '__authRetry';

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;
    if (error?.response?.status === 401 && config && !config[RETRY_KEY]) {
      const user = auth.currentUser;
      if (user) {
        try {
          const token = await user.getIdToken(true);
          config[RETRY_KEY] = true;
          config.headers['Authorization'] = `Bearer ${token}`;
          return api.request(config);
        } catch (refreshErr) {
          console.warn('API: Token refresh failed on 401 retry', refreshErr);
        }
      }
    }
    return Promise.reject(error);
  },
);

export default api;
