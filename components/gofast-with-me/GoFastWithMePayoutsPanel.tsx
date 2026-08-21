'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { loadConnectAndInitialize } from '@stripe/connect-js';
import {
  ConnectAccountManagement,
  ConnectAccountOnboarding,
  ConnectComponentsProvider,
} from '@stripe/react-connect-js';
import { RefreshCw } from 'lucide-react';
import api from '@/lib/api';
import {
  connectStatusBadgeClass,
  formatUsdFromCents,
  type AthleteConnectStatusState,
} from '@/lib/gofast-with-me/payout-panel-utils';

type ConnectStatus = {
  ready: boolean;
  state: AthleteConnectStatusState;
  label: string;
  detail: string;
  accountId: string | null;
};

type EarningsSummary = {
  totalCreditedAthleteShareCents: number;
  creditedSponsorshipCount: number;
  label: string;
  detail: string;
};

type SponsorshipHistoryRow = {
  commitmentId: string;
  brandNameSnapshot: string | null;
  athleteShareCents: number | null;
  paidAt: string | null;
};

export default function GoFastWithMePayoutsPanel() {
  const [connectStatus, setConnectStatus] = useState<ConnectStatus | null>(null);
  const [earnings, setEarnings] = useState<EarningsSummary | null>(null);
  const [sponsorships, setSponsorships] = useState<SponsorshipHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim() ?? '';

  const refreshAll = useCallback(() => {
    setRefreshKey((value) => value + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const [payoutsRes, earningsRes, sponsorshipsRes] = await Promise.all([
          api.get('/athlete/me/payouts'),
          api.get('/athlete/me/earnings'),
          api.get('/athlete/me/sponsorships'),
        ]);

        if (cancelled) return;

        if (!payoutsRes.data.success) {
          setError(payoutsRes.data.error ?? 'Failed to load payout status');
          return;
        }

        setConnectStatus(payoutsRes.data.status as ConnectStatus);

        if (earningsRes.data.success) {
          const payload = earningsRes.data.earnings as EarningsSummary | undefined;
          if (payload) setEarnings(payload);
        }

        if (sponsorshipsRes.data.success) {
          setSponsorships((sponsorshipsRes.data.sponsorships as SponsorshipHistoryRow[]) ?? []);
        }
      } catch {
        if (!cancelled) setError('Failed to load earnings and payout settings');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const connectInstance = useMemo(() => {
    if (!publishableKey) return null;

    return loadConnectAndInitialize({
      publishableKey,
      fetchClientSecret: async () => {
        const mode = connectStatus?.ready ? 'management' : 'onboarding';
        const { data } = await api.post('/athlete/me/payouts', { mode });
        if (!data.success || !data.clientSecret) {
          throw new Error(data.error ?? 'Failed to initialize payout setup');
        }
        if (data.status) setConnectStatus(data.status as ConnectStatus);
        return data.clientSecret as string;
      },
    });
  }, [publishableKey, connectStatus?.ready]);

  if (loading) {
    return <div className="text-sm text-gray-500">Loading earnings and payout settings…</div>;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Earnings &amp; Payouts</h1>
          <p className="text-sm text-gray-600 mt-2">
            Connect a bank account through Stripe so brand sponsorship payments can credit your
            athlete share. Funds are credited to your Stripe balance immediately after payment —
            Stripe pays your bank on its payout schedule, not as an instant deposit.
          </p>
        </div>
        <button
          type="button"
          onClick={refreshAll}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <RefreshCw className="h-4 w-4" aria-hidden />
          Refresh
        </button>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      {!publishableKey ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Stripe publishable key is not configured for this environment.
        </div>
      ) : null}

      {connectStatus ? (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Setup status</p>
              <p className="text-lg font-semibold text-gray-900">{connectStatus.label}</p>
            </div>
            <StatusBadge state={connectStatus.state} ready={connectStatus.ready} />
          </div>
          <p className="text-sm text-gray-600">{connectStatus.detail}</p>
        </div>
      ) : null}

      {earnings ? (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Earnings credited
          </p>
          <p className="text-3xl font-bold text-gray-900">
            {formatUsdFromCents(earnings.totalCreditedAthleteShareCents)}
          </p>
          <p className="text-sm text-gray-600">
            {earnings.creditedSponsorshipCount}{' '}
            {earnings.creditedSponsorshipCount === 1 ? 'sponsorship' : 'sponsorships'} credited to
            your Stripe balance
          </p>
          <p className="text-xs text-gray-500">{earnings.detail}</p>
        </div>
      ) : null}

      {publishableKey && connectInstance ? (
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm min-h-[420px]">
          <ConnectComponentsProvider connectInstance={connectInstance}>
            {connectStatus?.ready ? (
              <ConnectAccountManagement
                onLoadError={() => setError('Failed to load payout management')}
              />
            ) : (
              <ConnectAccountOnboarding
                onExit={() => refreshAll()}
                onLoadError={() => setError('Failed to load payout onboarding')}
              />
            )}
          </ConnectComponentsProvider>
        </div>
      ) : null}

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Recent sponsorship earnings
          </p>
          <p className="text-sm text-gray-600 mt-1">
            Athlete share amounts credited to your Stripe balance after brand payment.
          </p>
        </div>

        {sponsorships.length === 0 ? (
          <p className="text-sm text-gray-500">No paid sponsorships yet.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {sponsorships.slice(0, 10).map((row) => (
              <li key={row.commitmentId} className="flex items-center justify-between gap-4 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {row.brandNameSnapshot?.trim() || 'Brand sponsorship'}
                  </p>
                  <p className="text-xs text-gray-500">
                    {row.paidAt ? new Date(row.paidAt).toLocaleDateString() : 'Paid date pending'}
                  </p>
                </div>
                <p className="text-sm font-semibold text-gray-900">
                  {row.athleteShareCents != null
                    ? formatUsdFromCents(row.athleteShareCents)
                    : '—'}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ state, ready }: { state: AthleteConnectStatusState; ready: boolean }) {
  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-semibold ${connectStatusBadgeClass(state, ready)}`}
    >
      {ready ? 'Ready' : state.replace(/_/g, ' ')}
    </span>
  );
}
