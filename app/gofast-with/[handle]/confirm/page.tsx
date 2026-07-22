'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import api from '@/lib/api';
import { LocalStorageAPI } from '@/lib/localstorage';
import {
  goFastWithFrontDoorPath,
  goFastWithSignupPath,
  headlineForTarget,
  type GoFastWithTarget,
} from '@/lib/gofast-with-me/gofast-with-bridge';
import {
  GoFastWithAppAllusion,
  GoFastWithBridgeShell,
} from '@/components/gofast-with-me/GoFastWithBridgeShell';

export default function GoFastWithConfirmPage() {
  const params = useParams();
  const router = useRouter();
  const handle = (params?.handle as string)?.trim() || '';

  const [target, setTarget] = useState<GoFastWithTarget | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [alreadyMember, setAlreadyMember] = useState(false);

  useEffect(() => {
    if (!handle) {
      setError('Missing handle');
      setLoading(false);
      return;
    }

    const intent = LocalStorageAPI.getGwmFollowIntentHandle();
    if (!intent || intent !== handle) {
      router.replace(goFastWithFrontDoorPath(handle));
      return;
    }

    let cancelled = false;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setIsAuthenticated(!!user);
      if (!user) {
        router.replace(goFastWithSignupPath(handle));
        return;
      }

      try {
        const res = await api.get(`/follow/${encodeURIComponent(handle)}`);
        if (!res.data?.success || !res.data.target) {
          throw new Error(res.data?.error || 'Not found');
        }
        if (cancelled) return;

        setTarget({
          hostAthleteId: res.data.target.hostAthleteId,
          slug: res.data.target.slug,
          displayName: res.data.target.displayName,
          firstName: res.data.target.firstName,
          gofastHandle: res.data.target.gofastHandle,
          photoURL: null,
        });

        if (res.data.isSelf) {
          setError('This is your page.');
          setLoading(false);
          return;
        }

        if (res.data.isFollowing) {
          setAlreadyMember(true);
          setLoading(false);
          return;
        }

        setLoading(false);
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Something went wrong');
          setLoading(false);
        }
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [handle, router]);

  const handleConfirm = async () => {
    if (!handle || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.post(`/follow/${encodeURIComponent(handle)}`);
      if (!res.data?.success) {
        throw new Error(res.data?.error || 'Could not connect');
      }
      LocalStorageAPI.removeGwmFollowIntent();
      const slug = res.data.slug || handle;
      router.replace(`/container/${encodeURIComponent(slug)}`);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      setError(e.response?.data?.error || e.message || 'Could not connect');
      setSubmitting(false);
    }
  };

  const handleNotNow = () => {
    LocalStorageAPI.removeGwmFollowIntent();
    router.push(goFastWithFrontDoorPath(handle));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500" />
      </div>
    );
  }

  if (!target) {
    return (
      <GoFastWithBridgeShell>
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-200">
          <p className="text-gray-700">{error || 'Unavailable'}</p>
        </div>
      </GoFastWithBridgeShell>
    );
  }

  const headline = headlineForTarget(target);
  const slug = target.slug || handle;

  if (alreadyMember) {
    return (
      <GoFastWithBridgeShell>
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-200 text-center space-y-4">
          <p className="text-emerald-800 font-medium">
            You&apos;re already GoFasting with {target.firstName?.trim() || target.displayName}.
          </p>
          <Link
            href={`/container/${encodeURIComponent(slug)}`}
            className="inline-flex w-full justify-center rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white hover:bg-orange-600"
          >
            Open hub
          </Link>
        </div>
      </GoFastWithBridgeShell>
    );
  }

  return (
    <GoFastWithBridgeShell backHref={goFastWithFrontDoorPath(handle)} backLabel="Back">
      <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-200">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-green-100 rounded-full mx-auto mb-4 flex items-center justify-center text-2xl">
            ✓
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">You&apos;re all set!</h1>
          <p className="text-gray-600">
            Confirm to {headline.toLowerCase()} on GoFast.
          </p>
          {target.gofastHandle ? (
            <p className="text-sm text-gray-500 mt-1">@{target.gofastHandle}</p>
          ) : null}
        </div>

        <GoFastWithAppAllusion />

        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

        <div className="mt-6 space-y-3">
          <button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={submitting || !isAuthenticated}
            className="w-full rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
          >
            {submitting ? 'Connecting…' : "Let's go"}
          </button>
          <button
            type="button"
            onClick={handleNotNow}
            disabled={submitting}
            className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-50"
          >
            Not now
          </button>
        </div>
      </div>
    </GoFastWithBridgeShell>
  );
}
