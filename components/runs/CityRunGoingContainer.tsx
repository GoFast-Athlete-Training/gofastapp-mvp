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
  const isIndividual = run.cityRunType === 'INDIVIDUAL';
  const backHref = '/gorun';
  const backLabel = isHost ? 'Run' : 'My Runs';
  const socialRun = hasSocialRunLifecycle(run);

  const handleCheckin = async () => {
    if (!socialRun || isHost) return;
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
  const shellMax = isIndividual ? 'max-w-4xl' : 'max-w-6xl';

  return (
    <div className="min-h-screen bg-gray-100 overflow-x-hidden">
      <div className={`${shellMax} mx-auto px-4 py-3 sm:py-4`}>
        <Link
          href={backHref}
          className="mb-2 inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900"
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
          allowCheckin={!isHost && socialRun}
        />

        <div className="hidden lg:block space-y-3">
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

          <div
            className={
              isIndividual
                ? 'grid grid-cols-1 xl:grid-cols-[1fr_17rem] items-start gap-4'
                : 'grid grid-cols-3 items-start gap-4'
            }
          >
            <div className={isIndividual ? 'space-y-3 min-w-0' : 'col-span-2 space-y-3'}>
              <CityRunDetailsSection run={run} />
            </div>
            <div className="space-y-3">
              <CityRunPeopleSection rsvps={rsvps} sticky />
              {isIndividual ? null : (
                <CityRunChatSection runId={run.id} variant="sidebar-square" />
              )}
            </div>
          </div>

          {isIndividual ? <CityRunChatSection runId={run.id} /> : null}
        </div>
      </div>
    </div>
  );
}
