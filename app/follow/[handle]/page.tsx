'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import api from '@/lib/api';
import { LocalStorageAPI } from '@/lib/localstorage';

type FollowTarget = {
  hostAthleteId: string;
  slug: string;
  displayName: string;
  firstName: string | null;
  gofastHandle: string | null;
};

export default function FollowExplainerPage() {
  const params = useParams();
  const router = useRouter();
  const handle = (params?.handle as string)?.trim() || '';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [target, setTarget] = useState<FollowTarget | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isSelf, setIsSelf] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadStatus = useCallback(async () => {
    const res = await api.get(`/follow/${encodeURIComponent(handle)}`);
    const data = res.data;
    if (!data.success || !data.target) {
      throw new Error(data.error || 'Page not found');
    }
    setTarget(data.target);
    setIsFollowing(!!data.isFollowing);
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

  const handleFollow = async () => {
    if (!handle || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.post(`/follow/${encodeURIComponent(handle)}`);
      if (!res.data?.success) {
        throw new Error(res.data?.error || 'Could not follow');
      }
      LocalStorageAPI.removeGwmFollowIntent();
      const slug = res.data.slug || handle;
      router.replace(`/container/${encodeURIComponent(slug)}`);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      setError(e.response?.data?.error || e.message || 'Could not follow');
    } finally {
      setSubmitting(false);
    }
  };

  const signupHref = `/signup?redirect=${encodeURIComponent(`/follow/${handle}`)}`;

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500" />
      </div>
    );
  }

  if (error && !target) {
    return (
      <div className="min-h-screen bg-stone-50 px-4 py-16 max-w-lg mx-auto">
        <p className="text-gray-700">{error}</p>
        <Link href="/welcome" className="mt-4 inline-block text-orange-600 font-semibold">
          Go to GoFast
        </Link>
      </div>
    );
  }

  const firstName = target?.firstName?.trim() || target?.displayName || 'them';

  return (
    <div className="min-h-screen bg-stone-50 px-4 py-10">
      <div className="max-w-lg mx-auto space-y-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-600">
            GoFast with Others
          </p>
          <h1 className="text-2xl font-bold text-gray-900 mt-2">Follow {firstName}</h1>
          {target?.gofastHandle ? (
            <p className="text-sm text-gray-500 mt-1">@{target.gofastHandle}</p>
          ) : null}
        </div>

        <section className="rounded-2xl border border-gray-200 bg-white p-5 space-y-3 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900">What you&apos;ll get</h2>
          <ul className="text-sm text-gray-600 space-y-2 list-disc pl-5">
            <li>Follow {firstName}&apos;s public GoFastWithMe updates on GoFast.</li>
            <li>See their runs, plans, and community activity when they publish them.</li>
            <li>Join specific runs or training plans from their public page when available.</li>
          </ul>
          <p className="text-xs text-gray-500 pt-1">
            Tips, nutrition guidance, and paid coaching subscriptions come in a later pass.
          </p>
        </section>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        {isSelf ? (
          <p className="text-sm text-gray-600">This is your page.</p>
        ) : isFollowing ? (
          <div className="space-y-3">
            <p className="text-sm text-emerald-800 font-medium">You&apos;re already following {firstName}.</p>
            <Link
              href={`/container/${encodeURIComponent(target?.slug || handle)}`}
              className="inline-flex w-full justify-center rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white hover:bg-orange-600"
            >
              Open their hub
            </Link>
          </div>
        ) : isAuthenticated ? (
          <button
            type="button"
            onClick={() => void handleFollow()}
            disabled={submitting}
            className="w-full rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
          >
            {submitting ? 'Following…' : `Follow ${firstName}`}
          </button>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              Sign up or sign in to follow {firstName} on GoFast.
            </p>
            <Link
              href={signupHref}
              className="inline-flex w-full justify-center rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white hover:bg-orange-600"
            >
              Sign up to follow
            </Link>
            <Link
              href={`${signupHref}&mode=signin`}
              className="inline-flex w-full justify-center rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-800 hover:bg-gray-50"
            >
              I already have an account
            </Link>
          </div>
        )}

        {target?.slug ? (
          <Link
            href={`/u/${encodeURIComponent(target.slug)}`}
            className="block text-center text-sm font-medium text-gray-500 hover:text-gray-700"
          >
            View public page
          </Link>
        ) : null}
      </div>
    </div>
  );
}
