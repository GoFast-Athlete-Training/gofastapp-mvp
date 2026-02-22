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
function waitForAuthUser(timeoutMs = 3000): Promise<import('firebase/auth').User | null> {
  return new Promise((resolve) => {
    // Already resolved — return immediately
    if (auth.currentUser !== undefined) {
      resolve(auth.currentUser);
      return;
    }
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

  // Get current user — wait briefly if Firebase hasn't restored session yet
  let user = auth.currentUser;
  if (!user) {
    user = await waitForAuthUser(3000);
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
// DO NOT redirect on 401 here. Doing so causes /signup ↔ /welcome loops for
// users who ARE authenticated but whose token wasn't ready. Let individual
// pages / callers handle auth errors in context.
api.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(error),
);

export default api;
