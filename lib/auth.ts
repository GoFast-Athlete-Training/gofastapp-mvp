'use client';

import { getAuth, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, GoogleAuthProvider, User } from 'firebase/auth';
import { auth } from './firebase';

export async function signInWithGoogle(): Promise<User> {
  try {
    console.log('🚀 signInWithGoogle: Starting Google sign-in popup...');
    const provider = new GoogleAuthProvider();
    
    // Add additional scopes if needed
    provider.addScope('profile');
    provider.addScope('email');
    
    console.log('🚀 signInWithGoogle: Calling signInWithPopup...');
    const result = await signInWithPopup(auth, provider);
    console.log('✅ signInWithGoogle: Popup successful, user:', result.user.email);
    return result.user;
  } catch (error: any) {
    console.error('❌ signInWithGoogle: Error:', error);
    console.error('❌ signInWithGoogle: Error code:', error.code);
    console.error('❌ signInWithGoogle: Error message:', error.message);
    
    // Re-throw with more context
    if (error.code === 'auth/popup-closed-by-user') {
      throw new Error('Sign-in popup was closed. Please try again.');
    } else if (error.code === 'auth/popup-blocked') {
      throw new Error('Popup was blocked by your browser. Please allow popups for this site.');
    } else {
      throw error;
    }
  }
}

export async function signUpWithEmail(email: string, password: string, displayName?: string): Promise<User> {
  const result = await createUserWithEmailAndPassword(auth, email, password);
  const user = result.user;
  
  if (displayName) {
    await updateProfile(user, { displayName });
  }
  
  return user;
}

export async function signInWithEmail(email: string, password: string): Promise<User> {
  const result = await signInWithEmailAndPassword(auth, email, password);
  return result.user;
}

export async function getToken(): Promise<string | null> {
  const user = auth.currentUser;
  if (!user) return null;
  return user.getIdToken();
}

