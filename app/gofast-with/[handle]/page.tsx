'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import api from '@/lib/api';
import { LocalStorageAPI } from '@/lib/localstorage';
import {
  goFastWithConfirmPath,
  goFastWithSignupPath,
  headlineForTarget,
  type GoFastWithTarget,
} from '@/lib/gofast-with-me/gofast-with-bridge';
import {
  GoFastWithAppAllusion,
  GoFastWithBridgeShell,
  GoFastWithTargetCard,
} from '@/components/gofast-with-me/GoFastWithBridgeShell';

export default function GoFastWithFrontDoorPage() {
  const params = useParams();
  const router = useRouter();
  const handle = (params?.handle as string)?.trim() || '';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [target, setTarget] = useState<GoFastWithTarget | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isMember, setIsMember] = useState(false);
  const [isSelf, setIsSelf] = useState(false);

  const loadStatus = useCallback(async () => {
    const res = await api.get(`/follow/${encodeURIComponent(handle)}`);
    const data = res.data;
    if (!data.success || !data.target) {
      throw new Error(data.error || 'Page not found');
    }
    setTarget({
      hostAthleteId: data.target.hostAthleteId,
      slug: data.target.slug,
      displayName: data.target.displayName,
      firstName: data.target.firstName,
      gofastHandle: data.target.gofastHandle,
      photoURL: null,
    });
    setIsMember(!!data.isFollowing);
    setIsSelf(!!data.isSelf);
  }, [handle]);

  useEffect(() => {
    if (!handle) {
      setError('Missing handle');
      setLoading(false);
      return;
    }

    LocalStorageAPI.setGwmFollowIntentHandle(handle);

    let cancelled = false;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setIsAuthenticated(!!user);
      try {
        await loadStatus();
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Something went wrong');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [handle, loadStatus]);

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500" />
      </div>
    );
  }

  if (error && !target) {
    return (
      <GoFastWithBridgeShell>
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-200">
          <p className="text-gray-700">{error}</p>
          <Link href="/welcome" className="mt-4 inline-block text-orange-600 font-semibold">
            Go to GoFast
          </Link>
        </div>
      </GoFastWithBridgeShell>
    );
  }

  if (!target) return null;

  const headline = headlineForTarget(target);
  const slug = target.slug || handle;

  const handlePrimary = () => {
    if (isSelf) return;
    if (isMember) {
      router.push(`/container/${encodeURIComponent(slug)}`);
      return;
    }
    if (isAuthenticated) {
      router.push(goFastWithConfirmPath(slug));
      return;
    }
    router.push(goFastWithSignupPath(slug));
  };

  return (
    <GoFastWithBridgeShell>
      <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-200">
        <GoFastWithTargetCard target={target} headline={headline} />

        <section className="mb-6 text-left space-y-3">
          <h2 className="text-sm font-semibold text-gray-900">What you&apos;ll get</h2>
          <ul className="text-sm text-gray-600 space-y-2 list-disc pl-5">
            <li>See their training, runs, and updates when they publish them.</li>
            <li>Join specific runs or training plans from their public page.</li>
            <li>Stay connected in the GoFast app after you confirm here.</li>
          </ul>
        </section>

        <GoFastWithAppAllusion />

        <div className="mt-6 space-y-3">
          {isSelf ? (
            <p className="text-sm text-gray-600 text-center">This is your page.</p>
          ) : isMember ? (
            <>
              <p className="text-sm text-emerald-800 font-medium text-center">
                You&apos;re GoFasting with {target.firstName?.trim() || target.displayName}.
              </p>
              <button
                type="button"
                onClick={handlePrimary}
                className="w-full rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white hover:bg-orange-600"
              >
                Open hub
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={handlePrimary}
              className="w-full rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white hover:bg-orange-600"
            >
              {isAuthenticated ? 'Continue' : headline}
            </button>
          )}

          <Link
            href={`/u/${encodeURIComponent(slug)}`}
            className="block text-center text-sm font-medium text-gray-500 hover:text-gray-700"
          >
            View public page
          </Link>
        </div>
      </div>
    </GoFastWithBridgeShell>
  );
}
