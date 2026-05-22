'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import CityRunChatSection from '@/components/runs/CityRunChatSection';
import CityRunDetailsSection, {
  CityRunCheckinCta,
  CityRunGoingBanner,
} from '@/components/runs/CityRunDetailsSection';
import CityRunMobileTabs from '@/components/runs/CityRunMobileTabs';
import CityRunPeopleSection from '@/components/runs/CityRunPeopleSection';
import { isRunPast, type CityRunDetails, type CityRunRsvp } from '@/components/runs/city-run-types';

interface Props {
  run: CityRunDetails;
  onLeave: () => void;
}

export default function CityRunGoingContainer({ run, onLeave }: Props) {
  const [rsvps, setRsvps] = useState<CityRunRsvp[]>(run.rsvps || []);
  const [rsvpLoading, setRsvpLoading] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [runIsPast, setRunIsPast] = useState(false);

  useEffect(() => {
    setRunIsPast(isRunPast(run.date));
  }, [run.date]);

  const handleRsvp = async (status: 'going' | 'not-going') => {
    setRsvpLoading(true);
    try {
      await api.post(`/runs/${run.id}/rsvp`, { status });
      if (status !== 'going') {
        onLeave();
        return;
      }
      const res = await api.get(`/runs/${run.id}`);
      if (res.data.success) setRsvps(res.data.run.rsvps || []);
    } catch (err) {
      console.error('RSVP error:', err);
    } finally {
      setRsvpLoading(false);
    }
  };

  const handleCheckin = async () => {
    setCheckingIn(true);
    try {
      await api.post(`/runs/${run.id}/checkin`, {});
      onLeave();
    } catch (err) {
      console.error('Checkin error:', err);
    } finally {
      setCheckingIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden">
      <div className="max-w-7xl mx-auto px-4 py-4 sm:py-6">
        <CityRunMobileTabs
          mode="going"
          run={run}
          rsvps={rsvps}
          runIsPast={runIsPast}
          rsvpLoading={rsvpLoading}
          checkingIn={checkingIn}
          onLeave={() => void handleRsvp('not-going')}
          onCheckin={() => void handleCheckin()}
        />

        <div className="hidden lg:block space-y-4">
          <CityRunGoingBanner
            rsvpLoading={rsvpLoading}
            onLeave={() => void handleRsvp('not-going')}
          />

          {runIsPast ? (
            <CityRunCheckinCta checkingIn={checkingIn} onCheckin={() => void handleCheckin()} />
          ) : null}

          <div className="grid grid-cols-3 items-start gap-6">
            <div className="col-span-2 space-y-4">
              <CityRunDetailsSection run={run} />
            </div>
            <CityRunPeopleSection rsvps={rsvps} sticky />
          </div>

          <CityRunChatSection runId={run.id} />
        </div>
      </div>
    </div>
  );
}
