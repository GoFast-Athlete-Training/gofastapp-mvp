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
      config.headers['Authorization'] = `Bearer ${token}`;
    } catch (error) {
      console.error('❌ API: Failed to get token:', error);
      // Don't block the request, but log the error
    }
  } else {
    // No user - this will cause 401, but let the response interceptor handle it
    console.warn('⚠️ API: No Firebase user found - request may fail with 401');
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
        // Don't redirect if already on signup/signin pages
        if (!currentPath.includes('/signup') && !currentPath.includes('/signin')) {
          console.log('🚫 Redirecting to signup due to 401');
          window.location.href = '/signup';
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;

