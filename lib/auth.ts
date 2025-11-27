'use client';

import { getAuth, signInWithPopup, GoogleAuthProvider, User } from 'firebase/auth';
import { auth } from './firebase';

export async function signInWithGoogle(): Promise<User> {
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(auth, provider);
  return result.user;
}

export async function getToken(): Promise<string | null> {
  const user = auth.currentUser;
  if (!user) return null;
  return user.getIdToken();
}

