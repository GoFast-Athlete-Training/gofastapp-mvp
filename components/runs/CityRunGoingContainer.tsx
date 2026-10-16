'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import api from '@/lib/api';
import { LocalStorageAPI } from '@/lib/localstorage';
import CityRunChatSection from '@/components/runs/CityRunChatSection';
import CityRunDetailsSection, { CityRunGoingBanner } from '@/components/runs/CityRunDetailsSection';
import CityRunMobileTabs from '@/components/runs/CityRunMobileTabs';
import CityRunPeopleSection from '@/components/runs/CityRunPeopleSection';
import CityRunWorkoutCard, { type PlannedWorkoutSummary } from '@/components/runs/CityRunWorkoutCard';
import {
  isRunPast,
  runShouldShowWorkoutPrescribe,
  type CityRunDetails,
  type CityRunRsvp,
} from '@/components/runs/city-run-types';
import { hasSocialRunLifecycle } from '@/lib/city-run-copy';
import { isHostRsvpRole } from '@/lib/city-run/rsvp-role';
import { resolveViewerRsvpRole } from '@/lib/city-run/viewer-run-role';
import CityRunHostActions from '@/components/runs/CityRunHostActions';

interface Props {
  run: CityRunDetails;
  onLeave: () => void;
}

export default function CityRunGoingContainer({ run, onLeave }: Props) {
  const [rsvps, setRsvps] = useState<CityRunRsvp[]>(run.rsvps || []);
  const [checkingIn, setCheckingIn] = useState(false);
  const [runIsPast, setRunIsPast] = useState(false);
  const [athleteId, setAthleteId] = useState<string | null>(null);

  useEffect(() => {
    setAthleteId(LocalStorageAPI.getAthleteId());
  }, []);

  useEffect(() => {
    setRsvps(run.rsvps || []);
  }, [run.rsvps]);

  useEffect(() => {
    setRunIsPast(
      isRunPast(run.date, {
        startTimeHour: run.startTimeHour,
        startTimeMinute: run.startTimeMinute,
        startTimePeriod: run.startTimePeriod,
        timezone: run.timezone,
      })
    );
  }, [run.date, run.startTimeHour, run.startTimeMinute, run.startTimePeriod, run.timezone]);

  const viewerRsvpRole = useMemo(
    () => resolveViewerRsvpRole(run, athleteId),
    [run, athleteId]
  );
  const isHost = isHostRsvpRole(viewerRsvpRole);
  const backHref = isHost ? '/build-a-run' : '/runner';
  const backLabel = isHost ? 'Runs I created' : 'Runner';

  const socialRun = hasSocialRunLifecycle(run);

  const handleCheckin = async () => {
    if (!socialRun) return;
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

  const showWorkoutPrescribe = runShouldShowWorkoutPrescribe(run);

  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden">
      <div className="max-w-7xl mx-auto px-4 py-4 sm:py-6">
        <Link
          href={backHref}
          className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
          {backLabel}
        </Link>

        <CityRunMobileTabs
          mode="going"
          run={run}
          rsvps={rsvps}
          runIsPast={runIsPast}
          checkingIn={checkingIn}
          onCheckin={() => void handleCheckin()}
          viewerRsvpRole={viewerRsvpRole}
        />

        <div className="hidden lg:block space-y-4">
          <CityRunGoingBanner rsvpRole={viewerRsvpRole} />
          {isHost ? <CityRunHostActions cityRunId={run.id} /> : null}

          {showWorkoutPrescribe ? (
            <CityRunWorkoutCard
              workoutId={run.workoutId}
              workout={run.workout}
              plannedWorkout={run.plannedWorkout as PlannedWorkoutSummary | null | undefined}
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
