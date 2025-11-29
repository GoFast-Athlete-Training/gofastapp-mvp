'use client';

import { useRouter } from 'next/navigation';

interface RSVPCardProps {
  nextRun: any;
  crew: any;
  runCrewId: string | null;
  isCrewAdmin: boolean;
}

export default function RSVPCard({ nextRun, crew, runCrewId, isCrewAdmin }: RSVPCardProps) {
  const router = useRouter();

  if (!crew || !nextRun) return null;

  const handleGoToCrew = () => {
    if (!runCrewId) {
      router.push('/runcrew');
      return;
    }
    const targetRoute = isCrewAdmin ? `/runcrew/${runCrewId}/admin` : `/runcrew/${runCrewId}`;
    router.push(targetRoute);
  };

  return (
    <div className="bg-orange-50 border-2 border-orange-200 rounded-xl p-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">
            Your crew is running soon — RSVP now
          </h3>
          <p className="text-sm text-gray-600">
            {nextRun.title || 'Upcoming run'} on{' '}
            {nextRun.date
              ? new Date(nextRun.date).toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                })
              : 'soon'}
          </p>
        </div>
        <button
          onClick={handleGoToCrew}
          className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-2 rounded-lg font-semibold transition whitespace-nowrap"
        >
          RSVP →
        </button>
      </div>
    </div>
  );
}

