import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { LocalStorageAPI } from '@/lib/localstorage';
import { runManageSignInPath } from '@/lib/runmanage/door';

const SESSION_GATE_KEY = 'gofast_uid_resolved';

export function clearAthleteSessionGate() {
  try {
    sessionStorage.removeItem(SESSION_GATE_KEY);
  } catch {
    /* ignore */
  }
}

/** Sign out Firebase and clear local athlete/session keys; return path to navigate to. */
export async function signOutProductDoor(returnPath?: string): Promise<string> {
  clearAthleteSessionGate();
  LocalStorageAPI.clearAll();
  await signOut(auth);
  return returnPath ?? '/signup?auth=signin';
}

export async function signOutRunManageDoor(): Promise<string> {
  return signOutProductDoor(runManageSignInPath());
}
