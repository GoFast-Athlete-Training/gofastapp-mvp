'use client';

import { useState } from 'react';
import { ImagePlus, Info, MessageCircle, Users } from 'lucide-react';
import MobileHubTabs from '@/components/shared/MobileHubTabs';
import CityRunChatSection from '@/components/runs/CityRunChatSection';
import CityRunDetailsSection, {
  CityRunGoingBanner,
  CityRunRsvpPanel,
  CityRunSeriesPanel,
} from '@/components/runs/CityRunDetailsSection';
import CityRunPeopleSection from '@/components/runs/CityRunPeopleSection';
import CityRunRunDayCompanion from '@/components/runs/CityRunRunDayCompanion';
import CityRunWorkoutCard from '@/components/runs/CityRunWorkoutCard';
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
import { hasSocialRunLifecycle } from '@/lib/city-run-copy';

type PreRsvpMobileProps = {
  mode: 'pre-rsvp';
  run: CityRunDetails;
  runIsPast: boolean;
  rsvpLoading: boolean;
  onRsvp: (status: 'going' | 'not-going') => void;
  onCheckin: () => void;
  onBack: () => void;
  allowCheckin?: boolean;
};

type GoingMobileProps = {
  mode: 'going';
  run: CityRunDetails;
  rsvps: CityRunRsvp[];
  runIsPast: boolean;
  checkingIn: boolean;
  onCheckin: () => void;
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
  { id: 'chatter', label: 'Chatter', icon: <MessageCircle className="h-5 w-5" /> },
  { id: 'details', label: 'Details', icon: <Info className="h-5 w-5" /> },
  { id: 'people', label: 'People', icon: <Users className="h-5 w-5" /> },
] as const;

const POST_RUN_TABS = [
  { id: 'shouts', label: 'Shouts', icon: <MessageCircle className="h-5 w-5" /> },
  { id: 'photos', label: 'Photos', icon: <ImagePlus className="h-5 w-5" /> },
  { id: 'crew', label: 'Crew', icon: <Users className="h-5 w-5" /> },
] as const;

export default function CityRunMobileTabs(props: CityRunMobileTabsProps) {
  const defaultTab =
    props.mode === 'going' ? 'chatter' : props.mode === 'post-run' ? 'shouts' : 'details';
  const [activeTab, setActiveTab] = useState(defaultTab);

  if (props.mode === 'pre-rsvp') {
    const isSeries = props.run.runSeriesId != null;
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
            {isSeries && props.run.runSeries ? (
              <CityRunSeriesPanel series={props.run.runSeries} runClub={props.run.runClub} />
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
            />
          </div>
        ) : null}
        {activeTab === 'people' ? (
          <CityRunPeopleSection rsvps={props.run.rsvps || []} locked expanded />
        ) : null}
      </MobileHubTabs>
    );
  }

  if (props.mode === 'going') {
    const hasWorkout =
      Boolean(props.run.workoutId || props.run.workout) ||
      Boolean(props.run.workoutDescription?.trim());
    const socialRun = hasSocialRunLifecycle(props.run);

    return (
      <MobileHubTabs tabs={[...GOING_TABS]} activeTab={activeTab} onTabChange={setActiveTab}>
        {activeTab === 'chatter' ? (
          <div className="flex min-h-[calc(100dvh-11rem)] flex-col space-y-3">
            <CityRunGoingBanner />
            <CityRunChatSection runId={props.run.id} variant="mobile-hub" showHeading={false} />
          </div>
        ) : null}
        {activeTab === 'details' ? (
          <div className="space-y-4">
            <CityRunRunDayCompanion
              run={props.run}
              runIsPast={props.runIsPast}
              onAddShout={socialRun && props.runIsPast ? props.onCheckin : undefined}
              checkingIn={props.checkingIn}
            />
            {hasWorkout ? (
              <CityRunWorkoutCard
                workoutId={props.run.workoutId}
                workout={props.run.workout}
                workoutDescription={props.run.workoutDescription}
              />
            ) : null}
            <CityRunDetailsSection run={props.run} compact />
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
