'use client';

import { ArrowLeft, Calendar, Clock, Map, MapPin, Repeat } from 'lucide-react';
import CityRunRouteMedia from '@/components/runs/CityRunRouteMedia';
import {
  formatRunDate,
  formatRunTime,
  type CityRunDetails,
  type RunClub,
  type RunSeries,
} from '@/components/runs/city-run-types';

type CityRunDetailsSectionProps = {
  run: CityRunDetails;
  showBackButton?: boolean;
  onBack?: () => void;
  showHostCard?: boolean;
  includeYear?: boolean;
  showRouteMedia?: boolean;
  compact?: boolean;
};

export default function CityRunDetailsSection({
  run,
  showBackButton = false,
  onBack,
  showHostCard = false,
  includeYear = true,
  showRouteMedia = true,
  compact = false,
}: CityRunDetailsSectionProps) {
  const timeLabel = formatRunTime(run.startTimeHour, run.startTimeMinute, run.startTimePeriod);
  const dateLabel = formatRunDate(run.date, includeYear);

  return (
    <div className="space-y-4">
      {showBackButton && onBack ? (
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 text-gray-500 hover:text-gray-900 transition text-sm"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Runs
        </button>
      ) : null}

      {showHostCard && run.runClub ? (
        <div className="bg-white rounded-xl shadow-sm p-5 flex items-center gap-4">
          {run.runClub.logoUrl ? (
            <img
              src={run.runClub.logoUrl}
              alt={run.runClub.name}
              className="w-14 h-14 rounded-full object-cover border-2 border-gray-100"
            />
          ) : null}
          <div>
            <div className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Hosted by</div>
            <div className="font-bold text-gray-900">{run.runClub.name}</div>
            {run.runClub.city ? <div className="text-sm text-gray-500">{run.runClub.city}</div> : null}
          </div>
        </div>
      ) : null}

      <div className={`bg-white rounded-xl shadow-sm ${compact ? 'p-4' : 'p-6'}`}>
        {run.runClub && !showHostCard ? (
          <div className="flex items-center gap-3 mb-4">
            {run.runClub.logoUrl ? (
              <img
                src={run.runClub.logoUrl}
                alt={run.runClub.name}
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : null}
            <span className="text-sm font-medium text-gray-600">{run.runClub.name}</span>
          </div>
        ) : null}

        <h1 className={`font-bold text-gray-900 mb-4 ${compact ? 'text-xl' : 'text-2xl'}`}>{run.title}</h1>

        <div className="space-y-2 sm:space-y-3 text-gray-700">
          <div className="flex items-center gap-2 sm:gap-3">
            <Calendar className="h-4 w-4 text-gray-400 shrink-0" />
            <span>
              {run.dayOfWeek
                ? `Every ${run.dayOfWeek} · Next: ${formatRunDate(run.date, false)}`
                : dateLabel}
            </span>
          </div>
          {timeLabel ? (
            <div className="flex items-center gap-2 sm:gap-3">
              <Clock className="h-4 w-4 text-gray-400 shrink-0" />
              <span>{timeLabel}</span>
            </div>
          ) : null}
          <div className="flex items-start gap-2 sm:gap-3">
            <MapPin className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
            <div>
              <div className="font-medium">{run.meetUpPoint}</div>
              {(run.meetUpStreetAddress || run.meetUpCity) && (
                <div className="text-sm text-gray-500">
                  {[run.meetUpStreetAddress, run.meetUpCity, run.meetUpState].filter(Boolean).join(', ')}
                </div>
              )}
              {run.meetUpLat && run.meetUpLng ? (
                <a
                  href={`https://www.google.com/maps?q=${run.meetUpLat},${run.meetUpLng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-orange-500 hover:text-orange-600"
                >
                  Open in Maps →
                </a>
              ) : null}
            </div>
          </div>
          {(run.totalMiles || run.pace) && (
            <div className="flex gap-4 sm:gap-6 text-sm pt-1">
              {run.totalMiles ? (
                <span>
                  <span className="text-gray-400">Distance</span> {run.totalMiles} mi
                </span>
              ) : null}
              {run.pace ? (
                <span>
                  <span className="text-gray-400">Pace</span> {run.pace}
                </span>
              ) : null}
            </div>
          )}
          {run.stravaMapUrl ? (
            <a
              href={run.stravaMapUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-orange-500 hover:text-orange-600 pt-1"
            >
              <Map className="h-4 w-4" /> View Route
            </a>
          ) : null}
        </div>

        {run.description ? (
          <p className="mt-4 sm:mt-5 text-gray-700 text-sm whitespace-pre-wrap border-t border-gray-100 pt-4 sm:pt-5">
            {run.description}
          </p>
        ) : null}
      </div>

      {showRouteMedia ? (
        <CityRunRouteMedia routePhotos={run.routePhotos} mapImageUrl={run.mapImageUrl} />
      ) : null}
    </div>
  );
}

export function CityRunSeriesPanel({
  series,
  runClub,
}: {
  series: RunSeries;
  runClub?: RunClub | null;
}) {
  const timeStr =
    series.startTimeHour != null
      ? `${series.startTimeHour}:${String(series.startTimeMinute ?? 0).padStart(2, '0')} ${series.startTimePeriod ?? 'AM'}`
      : null;

  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

  return (
    <div className="bg-white rounded-xl shadow-sm p-5 border border-orange-100">
      <div className="flex items-center gap-2 mb-4">
        <div className="p-1.5 bg-orange-50 rounded-lg">
          <Repeat className="h-4 w-4 text-orange-500" />
        </div>
        <div>
          <div className="text-xs text-gray-400 uppercase tracking-wide">Part of a series</div>
          <div className="font-semibold text-gray-900 text-sm">{series.name ?? 'Recurring Run'}</div>
        </div>
      </div>

      <div className="space-y-3 text-sm text-gray-600">
        <div className="flex items-center gap-2">
          <Calendar className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
          <span>Every {capitalize(series.dayOfWeek)}</span>
        </div>
        {timeStr ? (
          <div className="flex items-center gap-2">
            <Clock className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
            <span>{timeStr}</span>
          </div>
        ) : null}
        {series.meetUpPoint ? (
          <div className="flex items-start gap-2">
            <MapPin className="h-3.5 w-3.5 text-gray-400 flex-shrink-0 mt-0.5" />
            <span>
              {series.meetUpPoint}
              {series.meetUpCity ? (
                <span className="text-gray-400">
                  {' '}
                  · {series.meetUpCity}
                  {series.meetUpState ? `, ${series.meetUpState}` : ''}
                </span>
              ) : null}
            </span>
          </div>
        ) : null}
      </div>

      {series.description ? (
        <p className="mt-4 pt-4 border-t border-gray-100 text-sm text-gray-500 leading-relaxed">
          {series.description}
        </p>
      ) : null}

      {runClub ? (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <p className="text-xs text-gray-400 mb-2">Hosted by</p>
          <div className="flex items-center gap-2">
            {runClub.logoUrl ? (
              <img src={runClub.logoUrl} alt={runClub.name} className="w-7 h-7 rounded-full object-cover" />
            ) : null}
            <span className="text-sm font-medium text-gray-700">{runClub.name}</span>
          </div>
        </div>
      ) : null}

      <div className="mt-4 pt-4 border-t border-gray-100">
        <p className="text-xs text-gray-500">
          This is a recurring run — same time, same place every {capitalize(series.dayOfWeek)}.
        </p>
      </div>
    </div>
  );
}

export function CityRunRsvpPanel({
  runIsPast,
  rsvpLoading,
  onRsvp,
  onCheckin,
}: {
  runIsPast: boolean;
  rsvpLoading: boolean;
  onRsvp: (status: 'going' | 'not-going') => void;
  onCheckin: () => void;
}) {
  if (runIsPast) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6">
        <p className="text-sm text-gray-500 mb-4">This run already happened. Were you there?</p>
        <button
          type="button"
          onClick={onCheckin}
          disabled={rsvpLoading}
          className="w-full py-3 bg-orange-500 text-white rounded-xl font-semibold hover:bg-orange-600 disabled:opacity-50 transition"
        >
          {rsvpLoading ? 'Loading…' : "See the crew's recap →"}
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <p className="text-sm text-gray-500 mb-4">
        RSVP to join the run chat and see who&apos;s going.
      </p>
      <button
        type="button"
        onClick={() => onRsvp('going')}
        disabled={rsvpLoading}
        className="w-full py-3 bg-orange-500 text-white rounded-xl font-semibold hover:bg-orange-600 disabled:opacity-50 transition"
      >
        {rsvpLoading ? 'Saving…' : "I'm going"}
      </button>
    </div>
  );
}

export function CityRunGoingBanner({
  rsvpLoading,
  onLeave,
}: {
  rsvpLoading: boolean;
  onLeave: () => void;
}) {
  return (
    <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center gap-3">
      <span className="text-green-800 font-semibold text-sm">You&apos;re going</span>
      <button
        type="button"
        onClick={onLeave}
        disabled={rsvpLoading}
        className="ml-auto text-sm text-gray-500 hover:text-red-500 transition disabled:opacity-50"
      >
        Can&apos;t make it
      </button>
    </div>
  );
}

export function CityRunCheckinCta({
  checkingIn,
  onCheckin,
}: {
  checkingIn: boolean;
  onCheckin: () => void;
}) {
  return (
    <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-4 flex items-center gap-3">
      <div className="min-w-0 flex-1">
        <div className="font-semibold text-orange-900 text-sm">You ran this</div>
        <div className="text-xs text-orange-700">
          Check in to share your shouts and see the crew&apos;s recap
        </div>
      </div>
      <button
        type="button"
        onClick={onCheckin}
        disabled={checkingIn}
        className="ml-auto px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-semibold hover:bg-orange-600 disabled:opacity-50 transition shrink-0"
      >
        {checkingIn ? 'Checking in…' : 'Check in →'}
      </button>
    </div>
  );
}
