'use client';

import { useCallback, useEffect, useState } from 'react';
import TopNav from '@/components/shared/TopNav';
import AthleteSidebar from '@/components/athlete/AthleteSidebar';
import HealthDashboard from '@/components/health/HealthDashboard';
import GarminConnectPrompt from '@/components/health/GarminConnectPrompt';
import type { HealthDailyDto, HealthSleepDto } from '@/lib/garmin-health/athlete-health-records';
import { auth } from '@/lib/firebase';
import { athleteBearerFetchHeaders } from '@/lib/athlete-bearer-fetch-headers';
import { onAuthStateChanged } from 'firebase/auth';

type HealthResponse = {
  success: boolean;
  garminConnected: boolean;
  lastSyncAt: string | null;
  daily: HealthDailyDto | null;
  sleep: HealthSleepDto | null;
};

export default function HealthPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <TopNav />
      <div className="flex flex-1 overflow-hidden">
        <AthleteSidebar />
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Health</h1>
              <p className="text-gray-600 leading-relaxed">
                Recovery, sleep, and readiness from your Garmin — so you can train at your best.
              </p>
            </div>
            <HealthHub />
          </div>
        </main>
      </div>
    </div>
  );
}

function HealthHub() {
  const [authReady, setAuthReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadHealth = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const u = auth.currentUser;
      if (!u) return;
      const token = await u.getIdToken();
      const res = await fetch('/api/me/health', {
        headers: athleteBearerFetchHeaders(token),
      });
      const json = (await res.json()) as HealthResponse & { error?: string };
      if (!res.ok || !json.success) {
        setError(json.error ?? 'Could not load health data');
        setHealth(null);
        return;
      }
      setHealth(json);
    } catch {
      setError('Could not load health data');
      setHealth(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setAuthReady(!!user);
      if (user) {
        void loadHealth();
      } else {
        setLoading(false);
      }
    });
    return () => unsub();
  }, [loadHealth]);

  if (!authReady || loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500" />
      </div>
    );
  }

  if (error) {
    return (
      <section className="rounded-2xl border border-red-100 bg-red-50/50 p-6 text-sm text-red-800">
        {error}
        <button
          type="button"
          onClick={() => void loadHealth()}
          className="mt-3 block text-orange-700 font-semibold hover:underline"
        >
          Try again
        </button>
      </section>
    );
  }

  if (!health?.garminConnected) {
    return <GarminConnectPrompt />;
  }

  return (
    <HealthDashboard
      daily={health.daily}
      sleep={health.sleep}
      lastSyncAt={health.lastSyncAt}
    />
  );
}
