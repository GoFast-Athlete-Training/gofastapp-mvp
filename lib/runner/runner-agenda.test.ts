import { describe, expect, it } from 'vitest';
import { buildRunnerAgenda, type RunnerJoinedRun, type RunnerPlanSession } from './build-runner-agenda';

const TODAY = '2026-08-30';

function plan(overrides: Partial<RunnerPlanSession> & Pick<RunnerPlanSession, 'dateKey' | 'title'>): RunnerPlanSession {
  return {
    plannedWorkoutId: null,
    workoutId: null,
    workoutType: 'Easy',
    estimatedDistanceInMeters: 12000,
    actualDistanceMeters: null,
    actualDurationSeconds: null,
    cityRunId: null,
    plannedWorkoutPreview: null,
    ...overrides,
  };
}

function joined(overrides: Partial<RunnerJoinedRun> & Pick<RunnerJoinedRun, 'id' | 'title' | 'dateKey'>): RunnerJoinedRun {
  return {
    slug: null,
    date: `${overrides.dateKey}T12:00:00.000Z`,
    city: 'boston',
    cityRunType: 'CLUB',
    meetUpPoint: 'Track',
    meetUpCity: 'Boston',
    meetUpState: 'MA',
    totalMiles: 5,
    pace: '8:00',
    workoutDescription: null,
    startTimeHour: 6,
    startTimeMinute: 30,
    startTimePeriod: 'AM',
    timezone: null,
    runClub: { slug: 'dcc', name: 'DCCR', logoUrl: null },
    runClubId: 'club1',
    plannedWorkoutId: null,
    plannedWorkoutPreview: null,
    hasCheckin: false,
    checkedInAt: null,
    isPast: false,
    isToday: overrides.dateKey === TODAY,
    isLive: overrides.dateKey === TODAY,
    needsWereYouThere: false,
    supportsCheckin: true,
    ...overrides,
  };
}

describe('buildRunnerAgenda', () => {
  it('merges plan and joined run when cityRunId matches', () => {
    const items = buildRunnerAgenda({
      todayKey: TODAY,
      planSessions: [
        plan({
          dateKey: TODAY,
          title: 'Tempo 6',
          plannedWorkoutId: 'pw1',
          cityRunId: 'run1',
        }),
      ],
      joinedRuns: [joined({ id: 'run1', title: 'Thursday Tempo', dateKey: TODAY })],
    });

    expect(items).toHaveLength(1);
    expect(items[0]?.kind).toBe('merged');
    expect(items[0]?.plan?.title).toBe('Tempo 6');
    expect(items[0]?.joinedRun?.id).toBe('run1');
  });

  it('keeps same-day plan and run separate when unlinked', () => {
    const items = buildRunnerAgenda({
      todayKey: TODAY,
      planSessions: [plan({ dateKey: TODAY, title: 'Easy 5' })],
      joinedRuns: [joined({ id: 'run2', title: 'Social Run', dateKey: TODAY })],
    });

    expect(items).toHaveLength(1);
    expect(items[0]?.kind).toBe('merged');
    expect(items[0]?.plan?.title).toBe('Easy 5');
    expect(items[0]?.joinedRun?.title).toBe('Social Run');
  });

  it('ranks today first, then check-in window, then future', () => {
    const items = buildRunnerAgenda({
      todayKey: TODAY,
      planSessions: [plan({ dateKey: '2026-09-02', title: 'Future plan' })],
      joinedRuns: [
        joined({
          id: 'past',
          title: 'Past nag',
          dateKey: '2026-08-29',
          isToday: false,
          isLive: false,
          isPast: true,
          needsWereYouThere: true,
        }),
        joined({ id: 'today', title: 'Today run', dateKey: TODAY, isToday: true, isLive: true }),
      ],
    });

    expect(items[0]?.joinedRun?.id).toBe('today');
    expect(items.some((i) => i.joinedRun?.id === 'past')).toBe(true);
  });

  it('still surfaces tomorrow plan-only workout after today is completed', () => {
    const tomorrow = '2026-08-31';
    const items = buildRunnerAgenda({
      todayKey: TODAY,
      planSessions: [
        plan({
          dateKey: TODAY,
          title: 'Easy 5',
          workoutId: 'w-done',
          actualDistanceMeters: 8046,
          actualDurationSeconds: 2400,
        }),
        plan({
          dateKey: tomorrow,
          title: 'Tempo 6',
          plannedWorkoutId: 'pw-tomorrow',
        }),
      ],
      joinedRuns: [],
    });

    const tomorrowItem = items.find((i) => i.dateKey === tomorrow);
    expect(tomorrowItem?.kind).toBe('plan-only');
    expect(tomorrowItem?.plan?.title).toBe('Tempo 6');
    expect(tomorrowItem?.plan?.plannedWorkoutId).toBe('pw-tomorrow');
  });

  it('includes all joined run types when provided', () => {
    const items = buildRunnerAgenda({
      todayKey: TODAY,
      planSessions: [],
      joinedRuns: [
        joined({ id: 'club', title: 'Club', dateKey: '2026-09-01', cityRunType: 'CLUB' }),
        joined({
          id: 'hosted',
          title: 'Hosted',
          dateKey: '2026-09-03',
          cityRunType: 'INDIVIDUAL',
          runClub: null,
          runClubId: null,
        }),
      ],
    });

    expect(items).toHaveLength(2);
    expect(items.map((i) => i.joinedRun?.cityRunType)).toEqual(
      expect.arrayContaining(['CLUB', 'INDIVIDUAL'])
    );
  });
});
