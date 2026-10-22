'use client';

import Link from 'next/link';
import { MapPin } from 'lucide-react';
import type { CityRunDetails } from '@/components/runs/city-run-types';

function formatTime(
  hour: number | null | undefined,
  minute: number | null | undefined,
  period: string | null | undefined,
): string {
  if (hour == null || minute == null) return '';
  const minStr = minute.toString().padStart(2, '0');
  return `${hour}:${minStr} ${period || 'AM'}`;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

type Props = {
  run: CityRunDetails;
};

export default function CityRunTogetherMeetupStrip({ run }: Props) {
  const timeLine = formatTime(
    run.startTimeHour,
    run.startTimeMinute,
    run.startTimePeriod,
  );
  const fullAddress = [
    run.meetUpStreetAddress,
    run.meetUpCity,
    run.meetUpState,
  ]
    .filter(Boolean)
    .join(', ');
  const mapsUrl =
    run.meetUpLat != null && run.meetUpLng != null
      ? `https://www.google.com/maps?q=${run.meetUpLat},${run.meetUpLng}`
      : fullAddress
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`
        : null;

  return (
    <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-800">
      <p className="font-semibold text-gray-900">{formatDate(run.date)}</p>
      {timeLine ? <p className="text-gray-700">{timeLine}</p> : null}
      <div className="mt-2 flex gap-2">
        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-orange-600" aria-hidden />
        <div className="min-w-0">
          <p className="font-medium text-gray-900">{run.meetUpPoint}</p>
          {fullAddress ? <p className="text-gray-600">{fullAddress}</p> : null}
          {mapsUrl ? (
            <Link
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-block text-sm font-semibold text-sky-700 hover:underline"
            >
              Open in Maps
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
