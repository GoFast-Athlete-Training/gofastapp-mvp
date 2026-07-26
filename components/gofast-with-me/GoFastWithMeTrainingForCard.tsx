'use client';

import GoalRaceCard from '@/app/u/[handle]/_components/GoalRaceCard';
import type { GoFastWithMeTrainingFor } from '@/lib/gofast-with-me/training-for-types';

type Props = GoFastWithMeTrainingFor;

export default function GoFastWithMeTrainingForCard({
  trainingSummary,
  primaryChasingGoal,
}: Props) {
  return (
    <GoalRaceCard
      trainingSummary={trainingSummary}
      primaryChasingGoal={primaryChasingGoal}
    />
  );
}
