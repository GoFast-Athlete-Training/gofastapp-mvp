export type AthleteConnectStatusState =
  | 'setup_required'
  | 'verification_pending'
  | 'action_required'
  | 'payouts_ready';

export function formatUsdFromCents(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}

export function connectStatusBadgeClass(
  state: AthleteConnectStatusState,
  ready: boolean,
): string {
  if (ready) return 'bg-emerald-100 text-emerald-800';
  if (state === 'action_required') return 'bg-amber-100 text-amber-900';
  return 'bg-gray-100 text-gray-700';
}
