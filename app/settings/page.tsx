'use client';


import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { DollarSign, Hash, Sparkles, Globe, Copy, Check } from 'lucide-react';
import { LocalStorageAPI } from '@/lib/localstorage';
import AthleteAppShell from '@/components/athlete/AthleteAppShell';
import api from '@/lib/api';

export default function SettingsPage() {
  const router = useRouter();
  const [athlete, setAthlete] = useState<any>(null);
  /** Avoid flashing wrong Garmin / profile-derived UI before /athlete/:id returns. */
  const [athleteReady, setAthleteReady] = useState(false);
  const [copiedProfileUrl, setCopiedProfileUrl] = useState(false);

  const [ambassadorCredits, setAmbassadorCredits] = useState<{
    ambassador: boolean;
    tally: number;
    amountEarnedDollars: number;
    periodStart: string | null;
    amountPerCreditCents: number;
  } | null>(null);

  useEffect(() => {
    const id = LocalStorageAPI.getAthleteId();
    if (!id) {
      router.replace('/welcome');
      return;
    }
    api
      .get(`/athlete/${id}`)
      .then((res) => {
        if (res.data?.athlete) {
          setAthlete(res.data.athlete);
          setAthleteReady(true);
        } else {
          router.replace('/welcome');
        }
      })
      .catch(() => router.replace('/welcome'));
  }, [router]);

  useEffect(() => {
    if (athlete?.role !== 'AMBASSADOR') return;
    api
      .get('/me/ambassador-credits')
      .then((res) => {
        if (res.data?.success && res.data?.ambassador) {
          setAmbassadorCredits({
            ambassador: true,
            tally: res.data.tally ?? 0,
            amountEarnedDollars: res.data.amountEarnedDollars ?? 0,
            periodStart: res.data.periodStart ?? null,
            amountPerCreditCents: res.data.amountPerCreditCents ?? 1000,
          });
        } else {
          setAmbassadorCredits({ ambassador: false, tally: 0, amountEarnedDollars: 0, periodStart: null, amountPerCreditCents: 1000 });
        }
      })
      .catch(() => setAmbassadorCredits(null));
  }, [athlete?.role]);

  const copyPublicProfileUrl = async () => {
    const h = athlete?.gofastHandle;
    if (!h || typeof window === 'undefined') return;
    const url = `${window.location.origin}/u/${encodeURIComponent(h)}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedProfileUrl(true);
      setTimeout(() => setCopiedProfileUrl(false), 2000);
    } catch {
      alert(url);
    }
  };

  return (
    <AthleteAppShell>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-600 mt-2">Manage your account settings and integrations</p>
          <Link
            href="/athlete-home"
            className="inline-flex mt-3 text-sm font-semibold text-orange-600 hover:text-orange-700"
          >
            ← Back to home
          </Link>
        </div>

        {!athleteReady ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-500">
            <div
              className="h-10 w-10 animate-spin rounded-full border-2 border-gray-200 border-t-orange-500 mb-4"
              aria-hidden
            />
            <p className="text-sm">Loading settings…</p>
          </div>
        ) : (
        <div className="space-y-6">
          {/* Ambassador: My payment credits (like My Work for data-entry) */}
          {athlete?.role === 'AMBASSADOR' && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-1 flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-amber-500" />
                My payment credits
              </h2>
              <p className="text-gray-600 text-sm mb-4">
                Join a run, post a photo on that run → get $10 credit. Payouts are processed by GoFast.
              </p>
              {ambassadorCredits?.ambassador ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                      <Hash className="h-4 w-4" />
                      Credits this period
                    </div>
                    <div className="text-2xl font-bold text-gray-900">{ambassadorCredits.tally}</div>
                    <div className="text-xs text-gray-500">
                      {ambassadorCredits.periodStart
                        ? `Since ${new Date(ambassadorCredits.periodStart).toLocaleDateString()}`
                        : 'All time (no payout yet)'}
                    </div>
                  </div>
                  <div className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                      <DollarSign className="h-4 w-4 text-emerald-600" />
                      Amount earned
                    </div>
                    <div className="text-2xl font-bold text-emerald-700">
                      ${ambassadorCredits.amountEarnedDollars.toFixed(2)}
                    </div>
                    <div className="text-xs text-gray-500">${(ambassadorCredits.amountPerCreditCents / 100).toFixed(0)} per qualified run</div>
                  </div>
                </div>
              ) : ambassadorCredits && !ambassadorCredits.ambassador ? null : (
                <div className="text-gray-500 text-sm">Loading…</div>
              )}
              <Link
                href="/ambassador-welcome"
                className="inline-block mt-3 text-sm text-sky-600 hover:text-sky-800"
              >
                How ambassador credits work →
              </Link>
            </div>
          )}

          {/* Profile Settings */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Profile</h2>
            <p className="text-gray-600 mb-4">Update your profile information, photo, and bio.</p>
            <Link
              href="/athlete-edit-profile"
              className="inline-block bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition"
            >
              Edit Profile
            </Link>
          </div>

          {/* Public athlete page */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-1 flex items-center gap-2">
              <Globe className="h-5 w-5 text-sky-600" />
              Public profile
            </h2>
            <p className="text-gray-600 text-sm mb-4">
              Your page at <code className="text-xs bg-gray-100 px-1 rounded">/u/your-handle</code> shows bio,
              location, training summary, upcoming workouts, and CityRuns you host (safe fields only — no account
              secrets).
            </p>
            {!athlete?.gofastHandle ? (
              <p className="text-amber-800 text-sm">Set a GoFast handle in Edit Profile to get a public URL.</p>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={copyPublicProfileUrl}
                  className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  {copiedProfileUrl ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                  {copiedProfileUrl ? 'Copied' : 'Copy link'}
                </button>
                <Link
                  href={`/u/${athlete.gofastHandle}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-sky-600 hover:text-sky-800 font-medium"
                >
                  Open public page →
                </Link>
              </div>
            )}
          </div>

          {/* Training baseline */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Training baseline</h2>
            <p className="text-gray-600 mb-4">
              Current 5K pace and typical weekly mileage — used when you don&apos;t have a goal time yet
              and for plan snapshots.
            </p>
            <Link
              href="/athlete-edit-profile"
              className="inline-block bg-slate-700 hover:bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-semibold transition"
            >
              Set baseline in profile
            </Link>
          </div>

          {/* Race goal */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Race goal</h2>
            <p className="text-gray-600 mb-4">Set your goal race and target time for personalized workout suggestions.</p>
            <Link
              href="/goals"
              className="inline-block bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition"
            >
              Set race goal
            </Link>
          </div>

          {/* Integrations */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Integrations</h2>
            <p className="text-gray-600 mb-4">
              Connect or manage devices on each integration&apos;s page.
            </p>

            {/* Garmin: status here; connect/disconnect lives on /settings/garmin */}
            <div className="border border-gray-200 rounded-lg p-4 mb-4 hover:border-gray-300 transition">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <Image
                    src="/Garmin_Connect_app_1024x1024-02.png"
                    alt="Garmin Connect"
                    width={40}
                    height={40}
                    className="rounded shrink-0"
                  />
                  <div className="min-w-0">
                    <h3 className="text-lg font-semibold text-gray-900">Garmin Connect</h3>
                    <p className="text-sm text-gray-600">
                      {athlete?.garmin_connected ? (
                        <span className="text-green-600 font-medium">Connected</span>
                      ) : (
                        <span className="text-gray-500">Not connected</span>
                      )}
                    </p>
                  </div>
                </div>
                <Link
                  href="/settings/garmin"
                  className={`shrink-0 px-4 py-1.5 text-sm font-medium rounded-lg transition text-center ${
                    athlete?.garmin_connected
                      ? 'text-gray-700 hover:bg-gray-100 border border-gray-200'
                      : 'text-white bg-orange-500 hover:bg-orange-600'
                  }`}
                >
                  {athlete?.garmin_connected ? 'Manage' : 'Connect'}
                </Link>
              </div>
            </div>
          </div>
        </div>
        )}
      </div>
    </AthleteAppShell>
  );
}
