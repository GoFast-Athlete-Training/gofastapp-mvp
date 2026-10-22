'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import api from '@/lib/api';
import { LocalStorageAPI } from '@/lib/localstorage';
import CityRunChatSection, { type CityRunChatLock } from '@/components/runs/CityRunChatSection';
import CityRunDetailsSection, {
  CityRunGoingBanner,
  CityRunRsvpPanel,
} from '@/components/runs/CityRunDetailsSection';
import CityRunMobileTabs from '@/components/runs/CityRunMobileTabs';
import CityRunPeopleSection from '@/components/runs/CityRunPeopleSection';
import {
  isRunPast,
  type CityRunDetails,
  type CityRunRsvp,
} from '@/components/runs/city-run-types';
import { hasSocialRunLifecycle } from '@/lib/city-run-copy';
import { athleteHasCityRunMembership } from '@/lib/city-run/rsvp-attendance';
import { isHostRsvpRole } from '@/lib/city-run/rsvp-role';
import { resolveViewerRsvpRole } from '@/lib/city-run/viewer-run-role';
import CityRunHostActions from '@/components/runs/CityRunHostActions';
import HostRunExecutionPanel from '@/components/runs/HostRunExecutionPanel';

interface Props {
  run: CityRunDetails;
  onLeave: () => void;
  isGuestSession?: boolean;
  onJoinRun?: () => void;
  rsvpLoading?: boolean;
  backHref?: string;
  backLabel?: string;
}

export default function CityRunRsvpGroup({
  run,
  onLeave,
  isGuestSession = false,
  onJoinRun,
  rsvpLoading = false,
  backHref = '/gorun',
  backLabel = 'Run',
}: Props) {
  const [rsvps, setRsvps] = useState<CityRunRsvp[]>(run.rsvps || []);
  const [checkingIn, setCheckingIn] = useState(false);
  const [runIsPast, setRunIsPast] = useState(false);
  const [athleteId, setAthleteId] = useState<string | null>(null);

  useEffect(() => {
    setAthleteId(LocalStorageAPI.getAthleteId());
  }, [run.currentRSVPRole, run.id]);

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

  const hasMembership = athleteHasCityRunMembership(run, athleteId);

  const viewerRsvpRole = useMemo(
    () => resolveViewerRsvpRole(run, athleteId),
    [run, athleteId]
  );
  const isHost = isHostRsvpRole(viewerRsvpRole);
  const isIndividual = run.cityRunType === 'INDIVIDUAL';
  const socialRun = hasSocialRunLifecycle(run);

  const joinRunHref = `/join/run/${encodeURIComponent(run.slug?.trim() || run.id)}`;

  const chatLock: CityRunChatLock = useMemo(() => {
    if (hasMembership) return null;
    if (isGuestSession || !athleteId) return 'sign-in';
    return 'rsvp';
  }, [hasMembership, isGuestSession, athleteId]);

  const showJoinPanel = !hasMembership;
  const showPastCheckinPanel =
    hasMembership && runIsPast && !isHost && socialRun;

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

  const shellMax = 'max-w-6xl';

  const rsvpPanel = (
    <CityRunRsvpPanel
      runIsPast={runIsPast}
      rsvpLoading={rsvpLoading || checkingIn}
      onRsvp={() => onJoinRun?.()}
      onCheckin={() => void handleCheckin()}
      runClub={run.runClub}
      cityRunType={run.cityRunType}
      runTitle={run.title}
      allowCheckin={!isHost && socialRun}
      publicRsvpPage={showJoinPanel}
      alreadyRsvped={hasMembership}
    />
  );

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
          hideWorkoutPrescribe
          chatLock={chatLock}
          joinRunHref={joinRunHref}
          onJoinRun={onJoinRun}
          joinLoading={rsvpLoading}
          showJoinPanel={showJoinPanel}
          showPastCheckinPanel={showPastCheckinPanel}
          hasMembership={hasMembership}
        />

        <div className="hidden lg:block space-y-3">
          {hasMembership ? <CityRunGoingBanner rsvpRole={viewerRsvpRole} /> : null}
          {isHost ? <CityRunHostActions cityRunId={run.id} /> : null}
          {isHost && isIndividual ? <HostRunExecutionPanel cityRunId={run.id} /> : null}

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)] items-start">
            <div className="space-y-3 min-w-0">
              <CityRunDetailsSection run={run} />
              {showJoinPanel || showPastCheckinPanel ? rsvpPanel : null}
            </div>
            <div className="space-y-4 xl:sticky xl:top-20 self-start min-w-0 w-full">
              <CityRunPeopleSection rsvps={rsvps} />
              <CityRunChatSection
                runId={run.id}
                variant="sidebar-panel"
                chatLock={chatLock}
                joinRunHref={joinRunHref}
                onJoinRun={onJoinRun}
                joinLoading={rsvpLoading}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
