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
      console.log('🔑 API: Token injected into request:', config.url);
    } catch (error) {
      console.error('❌ API: Failed to get token in interceptor:', error);
      // Don't block the request, but log the error
    }
  } else {
    console.warn('⚠️ API: No Firebase user in interceptor for request:', config.url);
  }
  return config;
});

export default api;

