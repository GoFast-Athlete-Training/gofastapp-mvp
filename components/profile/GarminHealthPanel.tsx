'use client';

function secToDurationLabel(sec: unknown): string | null {
  if (typeof sec !== 'number' || !Number.isFinite(sec) || sec < 0) return null;
  const totalMin = Math.round(sec / 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h <= 0) return `${m}m`;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function readNum(obj: Record<string, unknown>, ...keys: string[]): number | null {
  for (const key of keys) {
    const v = obj[key];
    if (typeof v === 'number' && Number.isFinite(v)) return Math.round(v);
  }
  return null;
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

interface Props {
  garminConnected: boolean;
  garminSleepRaw: unknown;
  garminDailyRaw: unknown;
}

export default function GarminHealthPanel({
  garminConnected,
  garminSleepRaw,
  garminDailyRaw,
}: Props) {
  if (!garminConnected) return null;

  const garminSleep =
    garminSleepRaw !== null &&
    garminSleepRaw !== undefined &&
    typeof garminSleepRaw === 'object' &&
    !Array.isArray(garminSleepRaw)
      ? (garminSleepRaw as Record<string, unknown>)
      : null;

  const garminDaily =
    garminDailyRaw !== null &&
    garminDailyRaw !== undefined &&
    typeof garminDailyRaw === 'object' &&
    !Array.isArray(garminDailyRaw)
      ? (garminDailyRaw as Record<string, unknown>)
      : null;

  const bodyBatteryRecent = garminDaily
    ? readNum(
        garminDaily,
        'bodyBatteryMostRecentValue',
        'bodyBatteryHighestValue',
        'bodyBatteryHighValue'
      )
    : null;
  const bodyBatteryHigh = garminDaily
    ? readNum(garminDaily, 'bodyBatteryHighestValue', 'bodyBatteryHighValue')
    : null;
  const bodyBatteryLow = garminDaily
    ? readNum(garminDaily, 'bodyBatteryLowestValue', 'bodyBatteryLowValue')
    : null;
  const bodyBatteryCharged = garminDaily
    ? readNum(garminDaily, 'bodyBatteryChargedValue')
    : null;
  const bodyBatteryDrained = garminDaily
    ? readNum(garminDaily, 'bodyBatteryDrainedValue')
    : null;

  const hasSleep = garminSleep != null;
  const hasBodyBattery =
    bodyBatteryRecent != null || bodyBatteryHigh != null || bodyBatteryLow != null;

  if (!hasSleep && !hasBodyBattery) {
    return (
      <section className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/60 p-6 shadow-sm">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <h2 className="text-lg font-bold text-gray-900">Garmin wellness</h2>
          <GarminBadge />
        </div>
        <p className="text-sm text-gray-600">
          Sleep and Body Battery will appear here after your watch syncs to Garmin Connect.
          Sync your device, then refresh this page.
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      {hasBodyBattery ? (
        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <h2 className="text-lg font-bold text-gray-900">Body Battery</h2>
            <GarminBadge />
          </div>
          {typeof garminDaily?.calendarDate === 'string' ? (
            <p className="text-sm text-gray-600 mb-4">
              Day of{' '}
              <span className="font-semibold text-gray-900">
                {new Date(`${garminDaily.calendarDate}T12:00:00`).toLocaleDateString(undefined, {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </span>
            </p>
          ) : null}

          {bodyBatteryRecent != null ? (
            <div className="mb-4">
              <div className="flex items-end justify-between gap-2 mb-2">
                <p className="text-xs text-gray-500">Most recent</p>
                <p
                  className={`text-3xl font-bold tabular-nums ${bodyBatteryLevelColor(bodyBatteryRecent)}`}
                >
                  {bodyBatteryRecent}
                </p>
              </div>
              <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${bodyBatteryBarColor(bodyBatteryRecent)}`}
                  style={{ width: `${Math.min(100, Math.max(0, bodyBatteryRecent))}%` }}
                />
              </div>
            </div>
          ) : null}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            {[
              { label: 'High', value: bodyBatteryHigh },
              { label: 'Low', value: bodyBatteryLow },
              { label: 'Charged', value: bodyBatteryCharged },
              { label: 'Drained', value: bodyBatteryDrained },
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
          <p className="text-xs text-gray-500 mt-3">
            Body Battery from your synced Garmin daily summary. Higher is more recovered energy.
          </p>
        </section>
      ) : null}

      {hasSleep ? (
        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <h2 className="text-lg font-bold text-gray-900">Sleep</h2>
            <GarminBadge />
          </div>
          {typeof garminSleep.calendarDate === 'string' ? (
            <p className="text-sm text-gray-600 mb-3">
              Night of{' '}
              <span className="font-semibold text-gray-900">
                {new Date(`${garminSleep.calendarDate}T12:00:00`).toLocaleDateString(undefined, {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </span>
            </p>
          ) : null}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-sm">
            {[
              { label: 'Total', key: 'durationInSeconds' },
              { label: 'Deep', key: 'deepSleepDurationInSeconds' },
              { label: 'Light', key: 'lightSleepDurationInSeconds' },
              { label: 'REM', key: 'remSleepInSeconds' },
              { label: 'Awake', key: 'awakeDurationInSeconds' },
            ].map(({ label, key }) => {
              const v = secToDurationLabel(garminSleep[key]);
              return (
                <div
                  key={key}
                  className="rounded-lg border border-gray-100 bg-gray-50/80 px-3 py-2"
                >
                  <p className="text-xs text-gray-500">{label}</p>
                  <p className="font-semibold text-gray-900">{v ?? '—'}</p>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-gray-500 mt-3">
            Sleep stages from your synced Garmin device.
          </p>
        </section>
      ) : null}
    </div>
  );
}
