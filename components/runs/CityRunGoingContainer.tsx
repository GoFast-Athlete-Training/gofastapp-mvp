'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import CityRunChatSection from '@/components/runs/CityRunChatSection';
import CityRunDetailsSection, { CityRunGoingBanner } from '@/components/runs/CityRunDetailsSection';
import CityRunMobileTabs from '@/components/runs/CityRunMobileTabs';
import CityRunPeopleSection from '@/components/runs/CityRunPeopleSection';
import CityRunRunDayCompanion from '@/components/runs/CityRunRunDayCompanion';
import CityRunWorkoutCard from '@/components/runs/CityRunWorkoutCard';
import { isRunPast, type CityRunDetails, type CityRunRsvp } from '@/components/runs/city-run-types';
import { isClubRun } from '@/lib/city-run-copy';

interface Props {
  run: CityRunDetails;
  onLeave: () => void;
}

export default function CityRunGoingContainer({ run, onLeave }: Props) {
  const [rsvps, setRsvps] = useState<CityRunRsvp[]>(run.rsvps || []);
  const [checkingIn, setCheckingIn] = useState(false);
  const [runIsPast, setRunIsPast] = useState(false);

  useEffect(() => {
    setRsvps(run.rsvps || []);
  }, [run.rsvps]);

  useEffect(() => {
    setRunIsPast(isRunPast(run.date));
  }, [run.date]);

  const clubRun = isClubRun(run);

  const handleCheckin = async () => {
    if (!clubRun) return;
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

  const hasWorkout =
    Boolean(run.workoutId || run.workout) || Boolean(run.workoutDescription?.trim());

  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden">
      <div className="max-w-7xl mx-auto px-4 py-4 sm:py-6">
        <CityRunMobileTabs
          mode="going"
          run={run}
          rsvps={rsvps}
          runIsPast={runIsPast}
          checkingIn={checkingIn}
          onCheckin={() => void handleCheckin()}
        />

        <div className="hidden lg:block space-y-4">
          <CityRunGoingBanner />

          <CityRunRunDayCompanion
            run={run}
            runIsPast={runIsPast}
            onAddShout={clubRun && runIsPast ? () => void handleCheckin() : undefined}
            checkingIn={checkingIn}
          />

          {hasWorkout ? (
            <CityRunWorkoutCard
              workoutId={run.workoutId}
              workout={run.workout}
              workoutDescription={run.workoutDescription}
            />
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
