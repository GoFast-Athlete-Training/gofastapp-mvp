'use client';

import { useState } from 'react';
import { ImagePlus, Info, MessageCircle, Users } from 'lucide-react';
import MobileHubTabs from '@/components/shared/MobileHubTabs';
import CityRunChatSection, { type CityRunChatLock } from '@/components/runs/CityRunChatSection';
import CityRunDetailsSection, {
  CityRunGoingBanner,
  CityRunRsvpPanel,
  CityRunSeriesPanel,
} from '@/components/runs/CityRunDetailsSection';
import CityRunPeopleSection, { PublicSeeWhosGoingSection } from '@/components/runs/CityRunPeopleSection';
import CityRunWorkoutCard, { type PlannedWorkoutSummary } from '@/components/runs/CityRunWorkoutCard';
import {
  CityRunPostRunCrewSection,
  CityRunPostRunPhotosSection,
  CityRunPostRunShoutsSection,
} from '@/components/runs/CityRunPostRunSections';
import type {
  CityRunCheckin,
  CityRunDetails,
  CityRunRsvp,
  PostRunRun,
} from '@/components/runs/city-run-types';
import { runShouldShowWorkoutPrescribe } from '@/components/runs/city-run-types';
import { isHostRsvpRole } from '@/lib/city-run/rsvp-role';
import CityRunHostActions from '@/components/runs/CityRunHostActions';
import HostRunExecutionPanel from '@/components/runs/HostRunExecutionPanel';
type PreRsvpMobileProps = {
  mode: 'pre-rsvp';
  run: CityRunDetails;
  runIsPast: boolean;
  rsvpLoading: boolean;
  onRsvp: (status: 'going' | 'not-going') => void;
  onCheckin: () => void;
  onBack: () => void;
  allowCheckin?: boolean;
  publicRsvpPage?: boolean;
  alreadyRsvped?: boolean;
};

type GoingMobileProps = {
  mode: 'going';
  run: CityRunDetails;
  rsvps: CityRunRsvp[];
  runIsPast: boolean;
  checkingIn: boolean;
  onCheckin: () => void;
  allowCheckin?: boolean;
  viewerRsvpRole?: string | null;
  hideWorkoutPrescribe?: boolean;
  chatLock?: CityRunChatLock;
  joinRunHref?: string;
  onJoinRun?: () => void;
  joinLoading?: boolean;
  showJoinPanel?: boolean;
  showPastCheckinPanel?: boolean;
  hasMembership?: boolean;
};

type PostRunMobileProps = {
  mode: 'post-run';
  run: PostRunRun;
  myCheckin: CityRunCheckin;
  checkins: CityRunCheckin[];
  athleteId: string | null;
  othersWithShouts: CityRunCheckin[];
  photos: CityRunCheckin[];
  othersCount: number;
  sortedCrew: CityRunCheckin[];
  editingShouts: boolean;
  shoutsInput: string;
  savingShouts: boolean;
  uploading: boolean;
  uploadError: string | null;
  onStartEditShouts: () => void;
  onCancelEditShouts: () => void;
  onShoutsInputChange: (value: string) => void;
  onSaveShouts: () => void;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
};

export type CityRunMobileTabsProps = PreRsvpMobileProps | GoingMobileProps | PostRunMobileProps;

const PRE_RSVP_TABS = [
  { id: 'details', label: 'Details', icon: <Info className="h-5 w-5" /> },
  { id: 'people', label: 'People', icon: <Users className="h-5 w-5" /> },
] as const;

const GOING_TABS = [
  { id: 'details', label: 'Details', icon: <Info className="h-5 w-5" /> },
  { id: 'people', label: 'People', icon: <Users className="h-5 w-5" /> },
  { id: 'chatter', label: 'Chatter', icon: <MessageCircle className="h-5 w-5" /> },
] as const;

const POST_RUN_TABS = [
  { id: 'shouts', label: 'Shouts', icon: <MessageCircle className="h-5 w-5" /> },
  { id: 'photos', label: 'Photos', icon: <ImagePlus className="h-5 w-5" /> },
  { id: 'crew', label: 'Crew', icon: <Users className="h-5 w-5" /> },
] as const;

export default function CityRunMobileTabs(props: CityRunMobileTabsProps) {
  const defaultTab =
    props.mode === 'going' ? 'details' : props.mode === 'post-run' ? 'shouts' : 'details';
  const [activeTab, setActiveTab] = useState(defaultTab);

  if (props.mode === 'pre-rsvp') {
    const isSeries = props.run.runSeriesId != null;
    const hasWorkout =
      !props.publicRsvpPage && runShouldShowWorkoutPrescribe(props.run);
    return (
      <MobileHubTabs
        tabs={[...PRE_RSVP_TABS]}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      >
        {activeTab === 'details' ? (
          <div className="space-y-4">
            <CityRunDetailsSection
              run={props.run}
              showBackButton
              onBack={props.onBack}
              showHostCard
            />
            {hasWorkout ? (
              <CityRunWorkoutCard
                workoutId={props.run.workoutId}
                workout={props.run.workout}
                plannedWorkout={props.run.plannedWorkout as PlannedWorkoutSummary | null | undefined}
                workoutDescription={props.run.workoutDescription}
              />
            ) : null}
            {isSeries && props.run.runSeries ? (
              <CityRunSeriesPanel
                series={props.run.runSeries}
                runClub={props.run.runClub}
                occurrenceMeetUpPoint={props.run.meetUpPoint}
                occurrenceStartTimeHour={props.run.startTimeHour}
                occurrenceStartTimeMinute={props.run.startTimeMinute}
                occurrenceStartTimePeriod={props.run.startTimePeriod}
              />
            ) : null}
            <CityRunRsvpPanel
              runIsPast={props.runIsPast}
              rsvpLoading={props.rsvpLoading}
              onRsvp={props.onRsvp}
              onCheckin={props.onCheckin}
              runClub={props.run.runClub}
              cityRunType={props.run.cityRunType}
              runTitle={props.run.title}
              allowCheckin={props.allowCheckin ?? true}
              publicRsvpPage={props.publicRsvpPage}
              alreadyRsvped={props.alreadyRsvped}
            />
          </div>
        ) : null}
        {activeTab === 'people' ? (
          props.publicRsvpPage ? (
            <PublicSeeWhosGoingSection rsvps={props.run.rsvps || []} />
          ) : (
            <CityRunPeopleSection rsvps={props.run.rsvps || []} locked expanded />
          )
        ) : null}
      </MobileHubTabs>
    );
  }

  if (props.mode === 'going') {
    const hasWorkout =
      !props.hideWorkoutPrescribe && runShouldShowWorkoutPrescribe(props.run);
    const viewerRsvpRole = props.viewerRsvpRole ?? props.run.currentRSVPRole;
    const isHost = isHostRsvpRole(viewerRsvpRole);
    const isIndividual = props.run.cityRunType === 'INDIVIDUAL';

    return (
      <MobileHubTabs tabs={[...GOING_TABS]} activeTab={activeTab} onTabChange={setActiveTab}>
        {activeTab === 'chatter' ? (
          <div className="flex min-h-[calc(100dvh-11rem)] flex-col">
            <CityRunChatSection
              runId={props.run.id}
              variant="mobile-hub"
              showHeading
              chatLock={props.chatLock ?? null}
              joinRunHref={props.joinRunHref}
              onJoinRun={props.onJoinRun}
              joinLoading={props.joinLoading}
            />
          </div>
        ) : null}
        {activeTab === 'details' ? (
          <div className="space-y-4">
            {props.hasMembership !== false ? (
              <CityRunGoingBanner rsvpRole={viewerRsvpRole} />
            ) : null}
            {isHost ? <CityRunHostActions cityRunId={props.run.id} /> : null}
            {isHost && isIndividual ? (
              <HostRunExecutionPanel cityRunId={props.run.id} />
            ) : null}
            {hasWorkout ? (
              <CityRunWorkoutCard
                workoutId={props.run.workoutId}
                workout={props.run.workout}
                plannedWorkout={props.run.plannedWorkout as PlannedWorkoutSummary | null | undefined}
                workoutDescription={props.run.workoutDescription}
              />
            ) : null}
            <CityRunDetailsSection run={props.run} compact />
            {props.showJoinPanel || props.showPastCheckinPanel ? (
              <CityRunRsvpPanel
                runIsPast={props.runIsPast}
                rsvpLoading={props.joinLoading ?? props.checkingIn}
                onRsvp={() => props.onJoinRun?.()}
                onCheckin={props.onCheckin}
                runClub={props.run.runClub}
                cityRunType={props.run.cityRunType}
                runTitle={props.run.title}
                allowCheckin={props.allowCheckin ?? true}
                publicRsvpPage={props.showJoinPanel}
                alreadyRsvped={props.hasMembership}
              />
            ) : null}
          </div>
        ) : null}
        {activeTab === 'people' ? (
          <CityRunPeopleSection rsvps={props.rsvps} expanded />
        ) : null}
      </MobileHubTabs>
    );
  }

  return (
    <MobileHubTabs tabs={[...POST_RUN_TABS]} activeTab={activeTab} onTabChange={setActiveTab}>
      {activeTab === 'shouts' ? (
        <CityRunPostRunShoutsSection
          myCheckin={props.myCheckin}
          othersWithShouts={props.othersWithShouts}
          editingShouts={props.editingShouts}
          shoutsInput={props.shoutsInput}
          savingShouts={props.savingShouts}
          onStartEdit={props.onStartEditShouts}
          onCancelEdit={props.onCancelEditShouts}
          onShoutsInputChange={props.onShoutsInputChange}
          onSaveShouts={props.onSaveShouts}
        />
      ) : null}
      {activeTab === 'photos' ? (
        <CityRunPostRunPhotosSection
          myCheckin={props.myCheckin}
          photos={props.photos}
          athleteId={props.athleteId}
          othersCount={props.othersCount}
          uploading={props.uploading}
          uploadError={props.uploadError}
          onFileChange={props.onFileChange}
        />
      ) : null}
      {activeTab === 'crew' ? (
        <CityRunPostRunCrewSection
          sortedCrew={props.sortedCrew}
          athleteId={props.athleteId}
          crewExpanded
          onToggleExpanded={() => undefined}
          expanded
        />
      ) : null}
    </MobileHubTabs>
  );
}
