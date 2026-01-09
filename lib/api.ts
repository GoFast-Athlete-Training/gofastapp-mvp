'use client';

import axios from 'axios';
import { auth } from './firebase';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || '/api',
});

api.interceptors.request.use(async (config) => {
  // Always get a fresh token from Firebase
  const user = auth.currentUser;
  if (user) {
    try {
      // Force refresh to get the latest token
      const token = await user.getIdToken(true);
      if (token) {
        config.headers['Authorization'] = `Bearer ${token}`;
      } else {
        console.error('❌ API: Got empty token from Firebase');
      }
    } catch (error) {
      console.error('❌ API: Failed to get token:', error);
      // Try to get token without force refresh
      try {
        const token = await user.getIdToken(false);
        if (token) {
          config.headers['Authorization'] = `Bearer ${token}`;
        }
      } catch (fallbackError) {
        console.error('❌ API: Fallback token get also failed:', fallbackError);
      }
    }
  } else {
    // No user - this will cause 401, but let the response interceptor handle it
    console.warn('⚠️ API: No Firebase user found - request may fail with 401');
    console.warn('⚠️ API: Current path:', typeof window !== 'undefined' ? window.location.pathname : 'server');
  }
  return config;
});

// Handle 401 errors - redirect to signup if unauthorized
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      console.error('❌ API: 401 Unauthorized - User not authenticated');
      
      // Only redirect if we're in the browser
      if (typeof window !== 'undefined') {
        // Clear any stale auth data
        const currentPath = window.location.pathname;
        // Don't redirect if already on signup/signin pages OR join-crew signup/confirm pages
        if (!currentPath.includes('/signup') && 
            !currentPath.includes('/signin') &&
            !currentPath.includes('/join/runcrew/') &&
            !currentPath.includes('/confirm')) {
          console.log('🚫 Redirecting to signup due to 401');
          window.location.href = '/signup';
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;

