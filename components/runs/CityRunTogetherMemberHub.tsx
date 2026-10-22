'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import CityRunChatSection from '@/components/runs/CityRunChatSection';
import { CityRunGoingBanner } from '@/components/runs/CityRunDetailsSection';
import CityRunHostedByStrip from '@/components/runs/CityRunHostedByStrip';
import CityRunTogetherMeetupStrip from '@/components/runs/CityRunTogetherMeetupStrip';
import CityRunMobileTabs from '@/components/runs/CityRunMobileTabs';
import CityRunPeopleSection from '@/components/runs/CityRunPeopleSection';
import CityRunRouteSlice from '@/components/runs/CityRunRouteSlice';
import {
  isRunPast,
  type CityRunDetails,
  type CityRunRsvp,
} from '@/components/runs/city-run-types';
import { hasSocialRunLifecycle } from '@/lib/city-run-copy';
import { cityRunDoorUrl } from '@/lib/city-run/run-nav-paths';
import { isHostRsvpRole } from '@/lib/city-run/rsvp-role';
import { resolveViewerRsvpRole } from '@/lib/city-run/viewer-run-role';
import CityRunHostActions from '@/components/runs/CityRunHostActions';
import HostRunExecutionPanel from '@/components/runs/HostRunExecutionPanel';
import { LocalStorageAPI } from '@/lib/localstorage';
import api from '@/lib/api';

type Props = {
  run: CityRunDetails;
  onLeave: () => void;
  showJoinedBanner?: boolean;
  backHref?: string;
  backLabel?: string;
};

export default function CityRunTogetherMemberHub({
  run,
  onLeave,
  showJoinedBanner = false,
  backHref = '/gorun',
  backLabel = 'Run',
}: Props) {
  const [rsvps, setRsvps] = useState<CityRunRsvp[]>(run.rsvps || []);
  const [checkingIn, setCheckingIn] = useState(false);
  const [runIsPast, setRunIsPast] = useState(false);
  const [athleteId, setAthleteId] = useState<string | null>(null);

  useEffect(() => {
    setAthleteId(LocalStorageAPI.getAthleteId());
  }, [run.id]);

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
      }),
    );
  }, [run.date, run.startTimeHour, run.startTimeMinute, run.startTimePeriod, run.timezone]);

  const viewerRsvpRole = useMemo(
    () => resolveViewerRsvpRole(run, athleteId),
    [run, athleteId],
  );
  const isHost = isHostRsvpRole(viewerRsvpRole);
  const isIndividual = run.cityRunType === 'INDIVIDUAL';
  const socialRun = hasSocialRunLifecycle(run);
  const publicDoorHref = cityRunDoorUrl(run.slug?.trim() || run.id);
  const showPastCheckinPanel = runIsPast && !isHost && socialRun;

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

  const overview = (
    <div className="space-y-3">
      {showJoinedBanner ? (
        <CityRunGoingBanner rsvpRole={viewerRsvpRole} />
      ) : null}
      {isHost ? <CityRunHostActions cityRunId={run.id} /> : null}
      {isHost && isIndividual ? (
        <HostRunExecutionPanel cityRunId={run.id} />
      ) : null}
      <h1 className="text-xl font-bold text-gray-900">{run.title}</h1>
      <CityRunTogetherMeetupStrip run={run} />
      <CityRunHostedByStrip run={run} />
      <CityRunRouteSlice run={run} publicDoorHref={publicDoorHref} />
      {showPastCheckinPanel ? (
        <button
          type="button"
          onClick={() => void handleCheckin()}
          disabled={checkingIn}
          className="w-full rounded-xl bg-orange-600 py-3 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-60"
        >
          {checkingIn ? 'Saving…' : 'Log that you ran'}
        </button>
      ) : null}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-100 overflow-x-hidden">
      <div className="mx-auto max-w-6xl px-4 py-3 sm:py-4">
        <Link
          href={backHref}
          className="mb-2 inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
          {backLabel}
        </Link>

        <CityRunMobileTabs
          mode="going"
          surface="together"
          run={run}
          rsvps={rsvps}
          runIsPast={runIsPast}
          checkingIn={checkingIn}
          onCheckin={() => void handleCheckin()}
          viewerRsvpRole={viewerRsvpRole}
          allowCheckin={!isHost && socialRun}
          hideWorkoutPrescribe
          chatLock={null}
          hasMembership
          togetherOverview={overview}
        />

        <div className="hidden lg:block space-y-4">
          {overview}
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)]">
            <CityRunPeopleSection rsvps={rsvps} expanded />
            <CityRunChatSection runId={run.id} variant="sidebar-panel" chatLock={null} />
          </div>
        </div>
      </div>
    </div>
  );
}
