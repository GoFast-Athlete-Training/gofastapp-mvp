'use client';

import { useState } from 'react';
import CreateCityRunForm, {
  type CreateCityRunFormWorkout,
} from '@/components/cityruns/CreateCityRunForm';
import GoFastWithMeWorkoutPicker from '@/components/gofast-with-me/GoFastWithMeWorkoutPicker';
import GoFastWithMeInvitePathFork from '@/components/gofast-with-me/GoFastWithMeInvitePathFork';
import GoFastWithMeRunsPanel from '@/components/gofast-with-me/GoFastWithMeRunsPanel';
import type { ShareHubPlanStatus } from '@/lib/profile/share-creator-card-logic';
import { canPublishPlan } from '@/lib/gofast-with-me/plan-sharing-utils';

type Props = {
  athleteId: string;
  publicSlug: string;
  plan: ShareHubPlanStatus | null;
};

type InvitePath = 'fork' | 'own';

export default function GoFastWithMeRunsStudioPanel({
  athleteId,
  publicSlug,
  plan,
}: Props) {
  const [builderWorkout, setBuilderWorkout] = useState<CreateCityRunFormWorkout | null>(null);
  const [invitePath, setInvitePath] = useState<InvitePath | null>(null);
  const [hubRefreshKey, setHubRefreshKey] = useState(0);

  const showWorkoutPicker =
    !!plan?.planId &&
    !!plan.startDate &&
    plan.totalWeeks != null &&
    canPublishPlan(plan);

  const handleRunCreated = () => {
    setBuilderWorkout(null);
    setInvitePath(null);
    setHubRefreshKey((k) => k + 1);
  };

  const handleWorkoutReady = (workout: CreateCityRunFormWorkout) => {
    setBuilderWorkout(workout);
    setInvitePath('fork');
  };

  const resetInviteFlow = () => {
    setBuilderWorkout(null);
    setInvitePath(null);
  };

  return (
    <section id="runs-studio" className="space-y-6 pb-8 max-w-3xl">
      <div>
        <h2 className="text-lg font-bold text-gray-900">Runs</h2>
        <p className="text-sm text-gray-600 mt-1">
          Host join-me runs followers can RSVP to.
        </p>
      </div>

      {showWorkoutPicker ? (
        <GoFastWithMeWorkoutPicker
          planId={plan!.planId!}
          planStartDate={plan!.startDate!}
          totalWeeks={plan!.totalWeeks!}
          onWorkoutReady={handleWorkoutReady}
        />
      ) : null}

      {builderWorkout && invitePath === 'fork' ? (
        <GoFastWithMeInvitePathFork
          sourceWorkout={builderWorkout}
          onChooseOwn={() => setInvitePath('own')}
          onCancel={resetInviteFlow}
          onDone={handleRunCreated}
        />
      ) : null}

      {builderWorkout && invitePath === 'own' ? (
        <div className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Build your invite</h3>
            <p className="text-xs text-gray-600 mt-1">
              Tune your workout, then add meetup and time. You&apos;ll get an RSVP link for
              followers.
            </p>
          </div>
          <CreateCityRunForm
            workout={builderWorkout}
            editableWorkout
            onWorkoutChange={setBuilderWorkout}
            onCancel={resetInviteFlow}
            onDone={handleRunCreated}
          />
        </div>
      ) : null}

      <GoFastWithMeRunsPanel
        key={hubRefreshKey}
        athleteId={athleteId}
        publicSlug={publicSlug}
        embedded
        showNoPlanFallback={!showWorkoutPicker}
      />
    </section>
  );
}
