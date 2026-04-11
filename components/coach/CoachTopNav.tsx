'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { LocalStorageAPI } from '@/lib/localstorage';

export default function CoachTopNav() {
  const router = useRouter();

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      LocalStorageAPI.clearAll();
      router.push('/');
    } catch (e) {
      console.error('Coach sign out:', e);
    }
  };

  return (
    <header className="bg-white/95 border-b border-amber-200 sticky top-0 z-50 backdrop-blur">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
        <Link href="/coach-hub" className="flex items-center gap-2">
          <img src="/logo.jpg" alt="GoFast Coach" className="w-9 h-9 rounded-full" />
          <span className="text-lg font-bold text-amber-900">GoFast Coach</span>
        </Link>
        <nav className="flex items-center gap-2 sm:gap-4 text-sm font-medium">
          <Link href="/coach-hub" className="text-amber-900/80 hover:text-amber-950 px-2 py-1 rounded-lg hover:bg-amber-50">
            Hub
          </Link>
          <Link href="/coach-hub/groups" className="text-amber-900/80 hover:text-amber-950 px-2 py-1 rounded-lg hover:bg-amber-50">
            Training groups
          </Link>
          <Link href="/coach-hub/profile" className="text-amber-900/80 hover:text-amber-950 px-2 py-1 rounded-lg hover:bg-amber-50">
            Profile
          </Link>
          <button
            type="button"
            onClick={handleSignOut}
            className="text-amber-800 hover:text-amber-950 px-2 py-1 rounded-lg hover:bg-amber-50"
          >
            Sign out
          </button>
        </nav>
      </div>
    </header>
  );
}
