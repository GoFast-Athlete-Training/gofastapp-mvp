'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import api from '@/lib/api';
import TopNav from '@/components/shared/TopNav';

/**
 * /join/run/[slug]
 *
 * Unsigned auth gate only. No public run card — that lives on gofastlinks /run/{slug}.
 *
 * - Already signed in → RSVP going → /cityruntogether/{slug}
 * - Not signed in → create account / sign in → signup flow returns here, then same hop
 */
export default function JoinRunPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [runId, setRunId] = useState<string | null>(null);
  const [runSlug, setRunSlug] = useState<string | null>(null);
  const [runTitle, setRunTitle] = useState<string | null>(null);
  const [runLoading, setRunLoading] = useState(true);
  const [runError, setRunError] = useState<string | null>(null);
  const [authResolved, setAuthResolved] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [rsvpError, setRsvpError] = useState<string | null>(null);
  const autoRsvpStarted = useRef(false);

  useEffect(() => {
    if (!slug) return;
    fetch(`/api/runs/public/${slug}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.run) {
          setRunId(data.run.id);
          setRunSlug(data.run.slug?.trim() || slug);
          setRunTitle(data.run.title ?? null);
        } else {
          setRunError('Run not found');
        }
      })
      .catch(() => setRunError('Could not load run'))
      .finally(() => setRunLoading(false));
  }, [slug]);

  useEffect(() => {
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (cancelled) return;
      if (user) {
        if (timeoutId) clearTimeout(timeoutId);
        setIsLoggedIn(true);
        setAuthResolved(true);
        unsubscribe();
        return;
      }
      if (timeoutId) return;
      timeoutId = setTimeout(() => {
        if (cancelled) return;
        timeoutId = null;
        setIsLoggedIn(false);
        setAuthResolved(true);
        unsubscribe();
      }, 1200);
    });

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
      unsubscribe();
    };
  }, []);

  const hubPath = () =>
    `/cityruntogether/${encodeURIComponent(runSlug ?? runId ?? slug)}`;

  const completeGoingRsvp = async () => {
    if (!runId) return;
    setBusy(true);
    setRsvpError(null);
    try {
      await api.post(`/runs/${runId}/rsvp`, { status: 'going' });
      router.replace(hubPath());
    } catch (err: unknown) {
      console.error('RSVP error:', err);
      setRsvpError('Could not save your RSVP. Please try again.');
      setBusy(false);
      autoRsvpStarted.current = false;
    }
  };

  useEffect(() => {
    if (!authResolved || !isLoggedIn || !runId || autoRsvpStarted.current) return;
    autoRsvpStarted.current = true;
    void completeGoingRsvp();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot when session + run ready
  }, [authResolved, isLoggedIn, runId]);

  if (runLoading || (authResolved && isLoggedIn)) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
        <TopNav />
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mt-8" />
        <p className="mt-4 text-sm text-gray-600">
          {isLoggedIn ? 'Adding you to this run…' : 'Loading…'}
        </p>
        {rsvpError ? <p className="mt-3 text-sm text-red-600 text-center max-w-sm">{rsvpError}</p> : null}
      </div>
    );
  }

  if (runError || !runId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">{runError || 'Run not found'}</p>
      </div>
    );
  }

  if (!authResolved) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <TopNav />
      <div className="max-w-md mx-auto px-4 py-12">
        <div className="bg-white rounded-xl shadow-sm p-8 text-center">
          <h1 className="text-xl font-bold text-gray-900 mb-2">Join this run on GoFast</h1>
          {runTitle ? <p className="text-sm text-gray-600 mb-6">{runTitle}</p> : null}
          <p className="text-sm text-gray-500 mb-6">Sign in or create a free account to RSVP.</p>
          <a
            href={`/join/run/${slug}/signup`}
            className="block w-full py-3 bg-orange-500 text-white rounded-xl font-semibold hover:bg-orange-600 transition text-center mb-3"
          >
            Create account →
          </a>
          <a
            href={`/join/run/${slug}/signup?mode=signin`}
            className="block w-full py-3 bg-white border border-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition text-center text-sm"
          >
            Already have an account? Sign in
          </a>
        </div>
      </div>
    </div>
  );
}
