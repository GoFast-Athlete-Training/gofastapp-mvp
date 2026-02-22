'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import api from '@/lib/api';
import TopNav from '@/components/shared/TopNav';
import { Calendar, Clock, MapPin } from 'lucide-react';

/**
 * /join/run/[slug]
 *
 * Pre-RSVP staging page + auth gate. Slug-driven.
 *
 * - Run card loads immediately from public API (no auth)
 * - Firebase auth resolves quietly in background
 * - CTA skeleton swaps to the right action once auth is known:
 *     Logged in  → "I'm going" confirm → RSVP → /gorun/[runId]
 *     Not logged in → "Create account" / "Sign in" → /join/run/[slug]/signup
 * - No redirects on load, no membership resolution, no yanks.
 */
export default function JoinRunPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [run, setRun] = useState<any>(null);
  const [runLoading, setRunLoading] = useState(true);
  const [runError, setRunError] = useState<string | null>(null);
  const [authResolved, setAuthResolved] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [rsvpError, setRsvpError] = useState<string | null>(null);

  // Run fetch — public, no auth needed
  useEffect(() => {
    if (!slug) return;
    fetch(`/api/runs/public/${slug}`)
      .then(r => r.json())
      .then(data => {
        if (data.success && data.run) setRun(data.run);
        else setRunError('Run not found');
      })
      .catch(() => setRunError('Could not load run'))
      .finally(() => setRunLoading(false));
  }, [slug]);

  // Auth check — resolves quietly; CTA skeleton hides the wait
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setIsLoggedIn(!!user);
      setAuthResolved(true);
      unsubscribe();
    });
    return unsubscribe;
  }, []);

  const handleConfirmRsvp = async () => {
    if (!run) return;
    setConfirming(true);
    setRsvpError(null);
    try {
      await api.post(`/runs/${run.id}/rsvp`, { status: 'going' });
      router.replace(`/gorun/${run.id}`);
    } catch (err: any) {
      console.error('RSVP error:', err?.response?.status, err?.message);
      setRsvpError('Could not save your RSVP. Please try again.');
      setConfirming(false);
    }
  };

  if (runLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500" />
      </div>
    );
  }

  if (runError || !run) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">{runError || 'Run not found'}</p>
      </div>
    );
  }

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  const formatTime = () => {
    if (run.startTimeHour === null || run.startTimeHour === undefined) return null;
    const min = String(run.startTimeMinute ?? 0).padStart(2, '0');
    return `${run.startTimeHour}:${min} ${run.startTimePeriod || 'AM'}`;
  };

  const time = formatTime();

  return (
    <div className="min-h-screen bg-gray-50">
      <TopNav />
      <div className="max-w-lg mx-auto px-4 py-8 space-y-4">

        {/* Run club header */}
        {run.runClub && (
          <div className="bg-white rounded-xl shadow-sm p-4 flex items-center gap-3">
            {run.runClub.logoUrl && (
              <img
                src={run.runClub.logoUrl}
                alt={run.runClub.name}
                className="w-12 h-12 rounded-full object-cover border border-gray-100"
              />
            )}
            <div>
              <div className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Hosted by</div>
              <div className="font-bold text-gray-900">{run.runClub.name}</div>
              {run.runClub.city && <div className="text-xs text-gray-500">{run.runClub.city}</div>}
            </div>
          </div>
        )}

        {/* Run details */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-5">{run.title}</h1>
          <div className="space-y-3 text-sm text-gray-700">
            <div className="flex items-center gap-3">
              <Calendar className="h-4 w-4 text-gray-400 shrink-0" />
              <span>{formatDate(run.date)}</span>
            </div>
            {time && (
              <div className="flex items-center gap-3">
                <Clock className="h-4 w-4 text-gray-400 shrink-0" />
                <span>{time}</span>
              </div>
            )}
            <div className="flex items-start gap-3">
              <MapPin className="h-4 w-4 text-gray-400 shrink-0 mt-0.5" />
              <div>
                <div>{run.meetUpPoint}</div>
                {(run.meetUpStreetAddress || run.meetUpCity) && (
                  <div className="text-gray-400 text-xs mt-0.5">
                    {[run.meetUpStreetAddress, run.meetUpCity, run.meetUpState].filter(Boolean).join(', ')}
                  </div>
                )}
              </div>
            </div>
            {(run.totalMiles || run.pace) && (
              <div className="flex gap-5 pt-1">
                {run.totalMiles && <span><span className="text-gray-400">Distance</span> {run.totalMiles} mi</span>}
                {run.pace && <span><span className="text-gray-400">Pace</span> {run.pace}</span>}
              </div>
            )}
          </div>
          {run.description && (
            <p className="mt-5 pt-5 border-t border-gray-100 text-sm text-gray-600 whitespace-pre-wrap">
              {run.description}
            </p>
          )}
        </div>

        {/* CTA — skeleton while auth resolves, then fork */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          {!authResolved ? (
            <div className="space-y-3">
              <div className="h-4 w-40 bg-gray-100 rounded animate-pulse" />
              <div className="h-12 bg-gray-100 rounded-xl animate-pulse" />
            </div>
          ) : isLoggedIn ? (
            <>
              <p className="text-sm text-gray-500 mb-4">Looks good? Lock in your spot.</p>
              <button
                onClick={handleConfirmRsvp}
                disabled={confirming}
                className="w-full py-3 bg-orange-500 text-white rounded-xl font-semibold hover:bg-orange-600 disabled:opacity-50 transition"
              >
                {confirming ? 'Saving…' : "I'm going →"}
              </button>
              {rsvpError && <p className="text-red-500 text-sm mt-3 text-center">{rsvpError}</p>}
            </>
          ) : (
            <>
              <p className="text-sm text-gray-500 mb-4">Join this run on GoFast — it's free.</p>
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
            </>
          )}
        </div>

      </div>
    </div>
  );
}
