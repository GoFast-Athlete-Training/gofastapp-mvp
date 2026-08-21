'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import api from '@/lib/api';
import {
  goFastWithConfirmPath,
  goFastWithSignupPath,
  type GoFastWithTarget,
} from '@/lib/gofast-with-me/gofast-with-bridge';
import { followAthleteHeadline } from '@/lib/gofast-with-me/resolve-public-actions';
import { athleteCommunityPath } from '@/lib/gofast-with-me/athlete-community-routes';
import { runnerPublicLandingUrl } from '@/lib/gofast-with-me/runner-public-url';
import {
  GoFastWithAppAllusion,
  GoFastWithBridgeShell,
  GoFastWithTargetCard,
} from '@/components/gofast-with-me/GoFastWithBridgeShell';

export default function GoFastWithFollowExplainerPage() {
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

  const slug = target.slug || handle;
  const followHeadline = followAthleteHeadline(target.firstName, target.displayName);
  const firstName = target.firstName?.trim() || target.displayName;

  const handlePrimary = () => {
    if (isSelf) return;
    if (isMember) {
      router.push(athleteCommunityPath(slug));
      return;
    }
    if (isAuthenticated) {
      router.push(goFastWithConfirmPath(slug));
      return;
    }
    router.push(goFastWithSignupPath(slug));
  };

  return (
    <GoFastWithBridgeShell backHref={runnerPublicLandingUrl(slug)} backLabel="Back to public page">
      <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-200">
        <GoFastWithTargetCard target={target} headline={followHeadline} />

        <section className="mb-6 text-left space-y-4 text-gray-700">
          <p className="text-base leading-relaxed">
            You can read {firstName}&apos;s public GoFast With Me page without an account. Following
            is the next step if you want their follower community inside GoFast.
          </p>

          <div>
            <h2 className="text-sm font-semibold text-gray-900 mb-2">What following unlocks</h2>
            <ul className="text-sm space-y-2 list-disc pl-5">
              <li>Their follower community hub — training updates, GoRuns, tips, and Chatter.</li>
              <li>A free connection to stay in their running journey after you confirm.</li>
              <li>Participation in community conversation — not just the public landing page.</li>
            </ul>
          </div>

          <p className="text-sm text-gray-600 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
            Following is free. It is not paid coaching, private training-plan enrollment, or
            automatic program signup.
          </p>
        </section>

        <GoFastWithAppAllusion />

        <div className="mt-6 space-y-3">
          {isSelf ? (
            <p className="text-sm text-gray-600 text-center">This is your page.</p>
          ) : isMember ? (
            <>
              <p className="text-sm text-emerald-800 font-medium text-center">
                You&apos;re already following {firstName}.
              </p>
              <button
                type="button"
                onClick={handlePrimary}
                className="w-full rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white hover:bg-orange-600"
              >
                Open community
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={handlePrimary}
              className="w-full rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white hover:bg-orange-600"
            >
              {isAuthenticated ? 'Continue to confirm follow' : 'Continue to sign up or sign in'}
            </button>
          )}

          <a
            href={runnerPublicLandingUrl(slug)}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-center text-sm font-medium text-gray-500 hover:text-gray-700"
          >
            View public page
          </a>
        </div>
      </div>
    </GoFastWithBridgeShell>
  );
}
