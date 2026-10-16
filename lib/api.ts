'use client';

import axios from 'axios';
import { auth } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { LocalStorageAPI } from './localstorage';
import { ATHLETE_ID_HEADER, SKIP_ATHLETE_BOOTSTRAP_HEADER } from './gofast-request-headers';
import { STAFF_ID_HEADER } from './staff-forward-auth';

const STAFF_PREVIEW_STORAGE_KEY = 'gofast_staff_preview_id';

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
  if (typeof window === 'undefined') {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
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

function shouldSkipAthleteBootstrap(config: { headers?: Record<string, unknown> }): boolean {
  return config.headers?.[SKIP_ATHLETE_BOOTSTRAP_HEADER] === '1';
}

// ── Request interceptor ────────────────────────────────────────────────────────
api.interceptors.request.use(async (config) => {
  const hadAuthorization = Boolean(config.headers?.['Authorization']);

  let user = auth.currentUser;
  if (!user && !hadAuthorization) {
    user = await waitForAuthUser(5000);
  }

  if (!hadAuthorization && user) {
    try {
      const token = await user.getIdToken();
      config.headers['Authorization'] = `Bearer ${token}`;
    } catch (err) {
      console.error('❌ API: Failed to get Firebase token:', err);
    }
  }

  const signedIn = Boolean(user || hadAuthorization);
  if (
    signedIn &&
    !LocalStorageAPI.getAthleteId() &&
    !shouldSkipAthleteBootstrap(config)
  ) {
    const { ensureAthleteIdInStorage } = await import('./ensure-athlete-session');
    await ensureAthleteIdInStorage();
  }

  const aid = LocalStorageAPI.getAthleteId();
  if (aid && config.headers[ATHLETE_ID_HEADER] == null) {
    config.headers[ATHLETE_ID_HEADER] = aid;
  }

  if (typeof window !== 'undefined') {
    const staffPreviewId = sessionStorage.getItem(STAFF_PREVIEW_STORAGE_KEY);
    if (staffPreviewId && config.headers[STAFF_ID_HEADER] == null) {
      config.headers[STAFF_ID_HEADER] = staffPreviewId;
    }
  }

  return config;
});

// ── Response interceptor ───────────────────────────────────────────────────────
const RETRY_KEY = '__authRetry';

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;
    if (typeof window === 'undefined') {
      return Promise.reject(error);
    }
    if (error?.response?.status === 401 && config && !config[RETRY_KEY]) {
      const user = auth.currentUser ?? (await waitForAuthUser(3000));
      if (user) {
        try {
          const token = await user.getIdToken(true);
          config[RETRY_KEY] = true;
          config.headers['Authorization'] = `Bearer ${token}`;
          if (!LocalStorageAPI.getAthleteId()) {
            const { ensureAthleteIdInStorage } = await import('./ensure-athlete-session');
            await ensureAthleteIdInStorage();
          }
          const retryAid = LocalStorageAPI.getAthleteId();
          if (retryAid) {
            config.headers[ATHLETE_ID_HEADER] = retryAid;
          }
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
