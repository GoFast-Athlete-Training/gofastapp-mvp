'use client';

import type { HealthDailyDto, HealthSleepDto } from '@/lib/garmin-health/athlete-health-records';

function secToDurationLabel(sec: number | null): string | null {
  if (sec == null || sec < 0) return null;
  const totalMin = Math.round(sec / 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h <= 0) return `${m}m`;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatCalendarDate(calendarDate: string | null): string | null {
  if (!calendarDate) return null;
  return new Date(`${calendarDate}T12:00:00`).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function bodyBatteryLevelColor(level: number): string {
  if (level >= 75) return 'text-emerald-700';
  if (level >= 50) return 'text-sky-700';
  if (level >= 25) return 'text-amber-700';
  return 'text-red-700';
}

function bodyBatteryBarColor(level: number): string {
  if (level >= 75) return 'bg-emerald-500';
  if (level >= 50) return 'bg-sky-500';
  if (level >= 25) return 'bg-amber-500';
  return 'bg-red-500';
}

function GarminBadge() {
  return (
    <span className="flex items-center gap-1.5 text-xs font-normal text-gray-500 ml-auto">
      <img
        src="/Garmin_Connect_app_1024x1024-02.png"
        alt="Garmin Connect"
        width={16}
        height={16}
        className="w-4 h-4 rounded shrink-0"
      />
      Garmin Connect
    </span>
  );
}

function hasDailyContent(daily: HealthDailyDto): boolean {
  return (
    daily.bodyBatteryLevel != null ||
    daily.bodyBatteryHigh != null ||
    daily.bodyBatteryLow != null ||
    daily.bodyBatteryCharged != null ||
    daily.bodyBatteryDrained != null ||
    daily.restingHeartRate != null ||
    daily.steps != null
  );
}

interface Props {
  daily: HealthDailyDto | null;
  sleep: HealthSleepDto | null;
  lastSyncAt: string | null;
}

export default function HealthDashboard({ daily, sleep, lastSyncAt }: Props) {
  const showDaily = daily != null && hasDailyContent(daily);
  const showSleep = sleep != null && sleep.durationInSeconds != null;

  if (!showDaily && !showSleep) {
    return (
      <section className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/60 p-6 shadow-sm">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <h2 className="text-lg font-bold text-gray-900">Waiting for sync</h2>
          <GarminBadge />
        </div>
        <p className="text-sm text-gray-600">
          Sync your watch in Garmin Connect, then refresh this page.
          {lastSyncAt ? (
            <>
              {' '}
              Last sync:{' '}
              <span className="font-medium text-gray-800">
                {new Date(lastSyncAt).toLocaleString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </span>
            </>
          ) : null}
        </p>
      </section>
    );
  }

  const dailyDateLabel = daily ? formatCalendarDate(daily.calendarDate) : null;
  const sleepDateLabel = sleep ? formatCalendarDate(sleep.calendarDate) : null;

  return (
    <div className="space-y-4">
      {showDaily && daily ? (
        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <h2 className="text-lg font-bold text-gray-900">Body Battery</h2>
            <GarminBadge />
          </div>
          {dailyDateLabel ? (
            <p className="text-sm text-gray-600 mb-4">
              Day of <span className="font-semibold text-gray-900">{dailyDateLabel}</span>
            </p>
          ) : null}

          {daily.bodyBatteryLevel != null ? (
            <div className="mb-4">
              <div className="flex items-end justify-between gap-2 mb-2">
                <p className="text-xs text-gray-500">Level</p>
                <p
                  className={`text-3xl font-bold tabular-nums ${bodyBatteryLevelColor(daily.bodyBatteryLevel)}`}
                >
                  {daily.bodyBatteryLevel}
                </p>
              </div>
              <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${bodyBatteryBarColor(daily.bodyBatteryLevel)}`}
                  style={{
                    width: `${Math.min(100, Math.max(0, daily.bodyBatteryLevel))}%`,
                  }}
                />
              </div>
            </div>
          ) : daily.bodyBatteryCharged != null || daily.bodyBatteryDrained != null ? (
            <p className="text-sm text-gray-600 mb-4">
              Today&apos;s energy changes — level syncs when Garmin sends a full daily summary.
            </p>
          ) : null}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            {[
              { label: 'High', value: daily.bodyBatteryHigh },
              { label: 'Low', value: daily.bodyBatteryLow },
              { label: 'Charged', value: daily.bodyBatteryCharged },
              { label: 'Drained', value: daily.bodyBatteryDrained },
            ].map(({ label, value }) => (
              <div
                key={label}
                className="rounded-lg border border-gray-100 bg-gray-50/80 px-3 py-2"
              >
                <p className="text-xs text-gray-500">{label}</p>
                <p className="font-semibold text-gray-900 tabular-nums">{value ?? '—'}</p>
              </div>
            ))}
          </div>

          {(daily.restingHeartRate != null || daily.steps != null) && (
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              {daily.restingHeartRate != null ? (
                <div className="rounded-lg border border-gray-100 bg-gray-50/80 px-3 py-2">
                  <p className="text-xs text-gray-500">Resting heart rate</p>
                  <p className="font-semibold text-gray-900 tabular-nums">
                    {daily.restingHeartRate}{' '}
                    <span className="text-xs font-normal text-gray-500">bpm</span>
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Recovery signal from your watch</p>
                </div>
              ) : null}
              {daily.steps != null ? (
                <div className="rounded-lg border border-gray-100 bg-gray-50/80 px-3 py-2">
                  <p className="text-xs text-gray-500">Steps</p>
                  <p className="font-semibold text-gray-900 tabular-nums">
                    {daily.steps.toLocaleString()}
                  </p>
                </div>
              ) : null}
            </div>
          )}

          <p className="text-xs text-gray-500 mt-3">
            Body Battery from your synced Garmin daily summary. Higher is more recovered energy.
          </p>
        </section>
      ) : null}

      {showSleep && sleep ? (
        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <h2 className="text-lg font-bold text-gray-900">Sleep</h2>
            <GarminBadge />
          </div>
          {sleepDateLabel ? (
            <p className="text-sm text-gray-600 mb-3">
              Night of <span className="font-semibold text-gray-900">{sleepDateLabel}</span>
            </p>
          ) : null}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-sm">
            {[
              { label: 'Total', value: secToDurationLabel(sleep.durationInSeconds) },
              { label: 'Deep', value: secToDurationLabel(sleep.deepSleepDurationInSeconds) },
              { label: 'Light', value: secToDurationLabel(sleep.lightSleepDurationInSeconds) },
              { label: 'REM', value: secToDurationLabel(sleep.remSleepInSeconds) },
              { label: 'Awake', value: secToDurationLabel(sleep.awakeDurationInSeconds) },
            ].map(({ label, value }) => (
              <div
                key={label}
                className="rounded-lg border border-gray-100 bg-gray-50/80 px-3 py-2"
              >
                <p className="text-xs text-gray-500">{label}</p>
                <p className="font-semibold text-gray-900">{value ?? '—'}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-3">Sleep stages from your synced Garmin device.</p>
        </section>
      ) : null}

      {lastSyncAt ? (
        <p className="text-xs text-gray-500 text-center">
          Last synced{' '}
          {new Date(lastSyncAt).toLocaleString(undefined, {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
          })}
        </p>
      ) : null}
    </div>
  );
}
