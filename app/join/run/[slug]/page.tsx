'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import api from '@/lib/api';
import TopNav from '@/components/shared/TopNav';
import JoinRunGuestExplainer from '@/components/runs/JoinRunGuestExplainer';
import {
  cityRunTogetherPath,
  markCityRunJoinedBanner,
} from '@/lib/city-run/run-nav-paths';

/**
 * /join/run/[slug] — session gate from public "I'm in".
 * Signed-in: auto RSVP → cityruntogether.
 * Signed-out: two-option explainer (signup vs name on list).
 */
export default function JoinRunPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [runId, setRunId] = useState<string | null>(null);
  const [runSlug, setRunSlug] = useState<string | null>(null);
  const [runTitle, setRunTitle] = useState<string>('this run');
  const [runLoading, setRunLoading] = useState(true);
  const [runError, setRunError] = useState<string | null>(null);
  const [authResolved, setAuthResolved] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
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
          if (data.run.title?.trim()) setRunTitle(data.run.title.trim());
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

  const completeGoingRsvp = async () => {
    if (!runId) return;
    setRsvpError(null);
    try {
      await api.post(`/runs/${runId}/rsvp`, { status: 'going' });
      const key = runSlug ?? runId;
      markCityRunJoinedBanner(runId);
      router.replace(cityRunTogetherPath(key));
    } catch (err: unknown) {
      console.error('RSVP error:', err);
      setRsvpError('Could not save your RSVP. Please try again.');
      autoRsvpStarted.current = false;
    }
  };

  useEffect(() => {
    if (!authResolved || !isLoggedIn || !runId || autoRsvpStarted.current) return;
    autoRsvpStarted.current = true;
    void completeGoingRsvp();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot when session + run ready
  }, [authResolved, isLoggedIn, runId]);

  if (runLoading || !authResolved) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
        <TopNav />
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mt-8" />
        <p className="mt-4 text-sm text-gray-600">Loading…</p>
      </div>
    );
  }

  if (runError || !runId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <TopNav />
        <p className="text-gray-500">{runError || 'Run not found'}</p>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <JoinRunGuestExplainer
        run={{
          title: runTitle,
          slug: runSlug ?? slug,
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <TopNav />
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mt-8" />
      <p className="mt-4 text-sm text-gray-600">Adding you to this run…</p>
      {rsvpError ? <p className="mt-3 text-sm text-red-600 text-center max-w-sm">{rsvpError}</p> : null}
    </div>
  );
}
