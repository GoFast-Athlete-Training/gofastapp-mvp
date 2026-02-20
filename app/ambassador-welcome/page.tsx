'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Sparkles, MapPin, Camera, DollarSign, ArrowRight } from 'lucide-react';
import TopNav from '@/components/shared/TopNav';
import { LocalStorageAPI } from '@/lib/localstorage';

export default function AmbassadorWelcomePage() {
  const [athlete, setAthlete] = useState<any>(null);

  useEffect(() => {
    setAthlete(LocalStorageAPI.getAthlete());
  }, []);

  const isAmbassador = athlete?.role === 'AMBASSADOR';

  return (
    <div className="min-h-screen bg-gray-50">
      <TopNav />
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 px-6 py-8 border-b border-amber-100">
            <div className="flex items-center gap-3 mb-2">
              <Sparkles className="h-8 w-8 text-amber-500" />
              <h1 className="text-2xl font-bold text-gray-900">Welcome, Ambassador</h1>
            </div>
            <p className="text-gray-700">
              You’re part of the GoFast ambassador program. Here’s how it works.
            </p>
          </div>

          <div className="p-6 space-y-6">
            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Your role</h2>
              <p className="text-gray-600">
                As an ambassador, you represent GoFast at runs and in your community. You help grow the run culture we care about—and you get paid for it.
              </p>
            </section>

            <section className="bg-gray-50 rounded-lg p-4 border border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-emerald-600" />
                Join a run, get paid
              </h2>
              <ol className="space-y-3 text-gray-700">
                <li className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 text-sm font-medium">1</span>
                  <span className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-gray-500" />
                    RSVP to a run (tap “Going”).
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 text-sm font-medium">2</span>
                  <span className="flex items-center gap-2">
                    <Camera className="h-4 w-4 text-gray-500" />
                    Post at least one photo on that run (add it to your RSVP).
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 text-sm font-medium">3</span>
                  <span>
                    <strong>Get a $10 credit.</strong> Credits add up; GoFast processes payouts from their side.
                  </span>
                </li>
              </ol>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Where to see your credits</h2>
              <p className="text-gray-600 mb-4">
                In <strong>Settings → My payment credits</strong> you’ll see how many qualified runs you’ve done this period and the amount earned. When GoFast runs a payout, your balance resets and a new period starts.
              </p>
              <Link
                href="/settings"
                className="inline-flex items-center gap-2 text-sky-600 hover:text-sky-800 font-medium"
              >
                Go to Settings
                <ArrowRight className="h-4 w-4" />
              </Link>
            </section>

            {!isAmbassador && (
              <p className="text-sm text-gray-500 italic">
                You’re viewing this as a non-ambassador. If you’ve been made an ambassador, sign out and back in so your role updates.
              </p>
            )}
          </div>
        </div>

        <div className="mt-6 text-center">
          <Link
            href="/gorun"
            className="text-sky-600 hover:text-sky-800 font-medium"
          >
            Find a run →
          </Link>
        </div>
      </main>
    </div>
  );
}
