import { sendPlannedWorkoutReminders } from '@/lib/app-notifications/planned-workout-reminders';

export async function processTrainingRunReminders(now = new Date()) {
  const result = await sendPlannedWorkoutReminders(now);

  return {
    notificationsUpserted: result.remindersSent,
    pushesSent: result.pushesSent,
    planWorkouts: result.workoutsConsidered,
    scheduledRuns: 0,
    skippedNoToken: result.skippedNoToken,
    errors: result.errors,
  };
}
