'use client';

import { getAuth, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, GoogleAuthProvider, User } from 'firebase/auth';
import { auth } from './firebase';

export async function signInWithGoogle(): Promise<User> {
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(auth, provider);
  return result.user;
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

