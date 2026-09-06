'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  CalendarClock,
  CheckCircle2,
  Copy,
  ExternalLink,
  MapPin,
  Route,
} from 'lucide-react';
import GooglePlacesAutocomplete, {
  type GooglePlaceSelectedData,
} from '@/components/RunCrew/GooglePlacesAutocomplete';
import type { CityRunFromWorkoutSuccess } from '@/components/cityruns/CreateCityRunForm';
import api from '@/lib/api';
import { LocalStorageAPI } from '@/lib/localstorage';
import {
  parseGoogleAddressFromComponents,
  generateCitySlugFromParts,
} from '@/lib/parse-google-address';

const PACE_OPTIONS = [
  '6:00-6:30',
  '6:30-7:00',
  '7:00-7:30',
  '7:30-8:00',
  '8:00-8:30',
  '8:30-9:00',
  '9:00-9:30',
  '9:30-10:00',
  '10:00-10:30',
  '10:30-11:00',
  '11:00+',
];

export type RunInvitePrefill = {
  title?: string;
  date?: string;
  totalMiles?: string;
};

type Props = {
  prefill?: RunInvitePrefill | null;
  onCancel?: () => void;
  onDone?: () => void;
  className?: string;
};

function todayYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function hasValidStartTime(hour: string, minute: string, period: 'AM' | 'PM'): boolean {
  const h = parseInt(hour, 10);
  const m = parseInt(minute, 10);
  return (
    hour.trim() !== '' &&
    minute.trim() !== '' &&
    Number.isFinite(h) &&
    h >= 1 &&
    h <= 12 &&
    Number.isFinite(m) &&
    m >= 0 &&
    m <= 59 &&
    (period === 'AM' || period === 'PM')
  );
}

export default function CreateRunInviteForm({
  prefill,
  onCancel,
  onDone,
  className = '',
}: Props) {
  const [title, setTitle] = useState(prefill?.title ?? '');
  const [totalMiles, setTotalMiles] = useState(prefill?.totalMiles ?? '');
  const [pace, setPace] = useState('');
  const [description, setDescription] = useState('');
  const [meetupDate, setMeetupDate] = useState(prefill?.date ?? todayYmd());
  const [startHour, setStartHour] = useState('');
  const [startMinute, setStartMinute] = useState('');
  const [startPeriod, setStartPeriod] = useState<'AM' | 'PM'>('AM');

  const [meetUpPoint, setMeetUpPoint] = useState('');
  const [meetUpStreetAddress, setMeetUpStreetAddress] = useState('');
  const [meetUpCity, setMeetUpCity] = useState('');
  const [meetUpState, setMeetUpState] = useState('');
  const [meetUpZip, setMeetUpZip] = useState('');
  const [meetUpPlaceId, setMeetUpPlaceId] = useState<string | null>(null);
  const [meetUpLat, setMeetUpLat] = useState<number | null>(null);
  const [meetUpLng, setMeetUpLng] = useState<number | null>(null);
  const [meetUpPlaceSet, setMeetUpPlaceSet] = useState(false);
  const [stravaMapUrl, setStravaMapUrl] = useState('');
  const [routeNeighborhood, setRouteNeighborhood] = useState('');

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<CityRunFromWorkoutSuccess | null>(null);
  const [copiedField, setCopiedField] = useState<'rsvp' | 'join' | null>(null);

  useEffect(() => {
    if (!prefill) return;
    if (prefill.title) setTitle(prefill.title);
    if (prefill.date) setMeetupDate(prefill.date);
    if (prefill.totalMiles) setTotalMiles(prefill.totalMiles);
  }, [prefill?.title, prefill?.date, prefill?.totalMiles]);

  const handleStartPlaceSelected = useCallback((placeData: GooglePlaceSelectedData) => {
    const parsed = parseGoogleAddressFromComponents(
      placeData.address,
      placeData.addressComponents
    );
    setMeetUpPoint(placeData.name || placeData.address);
    setMeetUpStreetAddress(parsed.streetAddress || placeData.address);
    setMeetUpCity(parsed.city || '');
    setMeetUpState(parsed.state || '');
    setMeetUpZip(parsed.zip || '');
    setMeetUpPlaceId(placeData.placeId || null);
    setMeetUpLat(placeData.lat);
    setMeetUpLng(placeData.lng);
    setMeetUpPlaceSet(true);
  }, []);

  const meetupConfirmation =
    meetUpPlaceSet && meetUpCity.trim()
      ? `${meetUpCity.trim()}${meetUpState.trim() ? `, ${meetUpState.trim().toUpperCase()}` : ''}`
      : null;

  const canSubmit =
    Boolean(title.trim()) &&
    Boolean(meetupDate.trim()) &&
    Boolean(meetUpPoint.trim()) &&
    Boolean(meetUpCity.trim()) &&
    meetUpPlaceSet &&
    hasValidStartTime(startHour, startMinute, startPeriod);

  const handleSubmit = async () => {
    if (!LocalStorageAPI.getAthleteId()) {
      setError('Sign in to create a run invite.');
      return;
    }
    if (!title.trim()) {
      setError('Add a title for your run invite.');
      return;
    }
    if (!meetUpPoint.trim() || !meetUpPlaceSet) {
      setError('Choose a meetup spot from the search results.');
      return;
    }
    if (!meetUpCity.trim()) {
      setError('We need a city from your meetup pick — select a Places result.');
      return;
    }
    if (!hasValidStartTime(startHour, startMinute, startPeriod)) {
      setError('Add a start time so people know when to meet you.');
      return;
    }

    const citySlug = generateCitySlugFromParts(meetUpCity, meetUpState);
    if (!citySlug) {
      setError('We need a valid city for listings.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const milesNum = parseFloat(totalMiles);
      const meters =
        Number.isFinite(milesNum) && milesNum > 0
          ? Math.round(milesNum * 1609.34)
          : 5000;

      const { data: workoutRes } = await api.post<{ workout?: { id: string } }>('/workouts', {
        title: title.trim(),
        workoutType: 'Easy',
        date: meetupDate,
        segments: [
          {
            stepOrder: 1,
            title: 'Easy run',
            durationType: 'DISTANCE',
            durationValue: meters,
          },
        ],
      });

      const workoutId = workoutRes?.workout?.id;
      if (!workoutId) {
        setError('Could not prepare your run.');
        return;
      }

      const hourNum = Math.min(12, Math.max(1, parseInt(startHour, 10)));
      const minuteNum = Math.min(59, Math.max(0, parseInt(startMinute, 10) || 0));

      const { data } = await api.post<CityRunFromWorkoutSuccess>('/cityrun/from-workout', {
        workoutId,
        title: title.trim(),
        citySlug,
        cityName: meetUpCity.trim(),
        state: meetUpState.trim() || undefined,
        date: meetupDate,
        meetUpPoint: meetUpPoint.trim(),
        meetUpStreetAddress: meetUpStreetAddress.trim() || meetUpPoint.trim(),
        meetUpCity: meetUpCity.trim(),
        meetUpState: meetUpState.trim() || undefined,
        meetUpZip: meetUpZip.trim() || undefined,
        meetUpPlaceId: meetUpPlaceId || undefined,
        meetUpLat: meetUpLat ?? undefined,
        meetUpLng: meetUpLng ?? undefined,
        stravaMapUrl: stravaMapUrl.trim() || undefined,
        routeNeighborhood: routeNeighborhood.trim() || undefined,
        startTimeHour: hourNum,
        startTimeMinute: minuteNum,
        startTimePeriod: startPeriod,
        totalMiles: Number.isFinite(milesNum) && milesNum > 0 ? milesNum : undefined,
        pace: pace.trim() || undefined,
        description: description.trim() || undefined,
      });

      if (data?.cityRunId && data?.path) {
        setSuccess(data);
        onDone?.();
      } else {
        setError('Unexpected response from server.');
      }
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      setError(err.response?.data?.error || 'Could not create invite.');
    } finally {
      setBusy(false);
    }
  };

  const copyToClipboard = async (text: string, field: 'rsvp' | 'join') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      setCopiedField(null);
    }
  };

  if (success) {
    return (
      <div className={`space-y-5 bg-white rounded-xl border border-gray-200 p-5 shadow-sm ${className}`}>
        <p className="text-green-800 font-medium text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          Invite created — share the link so others can RSVP.
        </p>
        {success.joinSignupUrl ? (
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
              Invite link
            </label>
            <input
              type="text"
              readOnly
              value={success.joinSignupUrl}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-gray-50"
            />
            <button
              type="button"
              onClick={() => void copyToClipboard(success.joinSignupUrl!, 'join')}
              className="mt-2 inline-flex items-center gap-2 py-2 px-4 text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 rounded-lg"
            >
              {copiedField === 'join' ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  Copy invite link
                </>
              )}
            </button>
          </div>
        ) : null}
        <Link
          href={success.path.startsWith('/') ? success.path : `/gorun/${success.cityRunId}`}
          className="inline-flex items-center gap-2 text-sm font-semibold text-orange-600 hover:text-orange-700"
        >
          <ExternalLink className="w-4 h-4" />
          Open run hub
        </Link>
      </div>
    );
  }

  return (
    <div className={`grid grid-cols-1 lg:grid-cols-2 gap-6 items-start ${className}`}>
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm h-fit lg:sticky lg:top-6 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Create a Run Invite</h3>
          <p className="text-xs text-gray-600 mt-1">
            Title, pace, and distance — no training plan required.
          </p>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
            Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Saturday morning miles"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
            Total miles
          </label>
          <input
            type="number"
            min={0.1}
            step={0.1}
            value={totalMiles}
            onChange={(e) => setTotalMiles(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
            Pace
          </label>
          <div className="flex flex-wrap gap-2">
            {PACE_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setPace(option)}
                className={`rounded-full px-3 py-1 text-xs font-semibold border transition ${
                  pace === option
                    ? 'border-orange-400 bg-orange-50 text-orange-900'
                    : 'border-gray-200 text-gray-700 hover:border-gray-300'
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="space-y-5 bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 flex items-center gap-2">
            <Route className="w-4 h-4 text-orange-500" />
            Meetup details
          </p>
        </div>

        <div className="space-y-2">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5" />
            Where to meet
          </label>
          <GooglePlacesAutocomplete
            value={meetUpPoint}
            onChange={(e) => {
              setMeetUpPoint(e.target.value);
              setMeetUpPlaceSet(false);
            }}
            onPlaceSelected={handleStartPlaceSelected}
            placeholder="Search for a location…"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
          {meetupConfirmation ? (
            <p className="text-sm text-emerald-800">{meetupConfirmation}</p>
          ) : null}
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 flex items-center gap-1">
            <CalendarClock className="w-3.5 h-3.5" />
            Meetup date
          </label>
          <input
            type="date"
            value={meetupDate}
            onChange={(e) => setMeetupDate(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
            Start time
          </label>
          <div className="flex gap-2 items-center flex-wrap">
            <input
              type="number"
              min={1}
              max={12}
              value={startHour}
              onChange={(e) => setStartHour(e.target.value)}
              className="w-14 border border-gray-300 rounded-lg px-2 py-2 text-sm text-center"
              placeholder="6"
            />
            <span className="text-gray-400">:</span>
            <input
              type="number"
              min={0}
              max={59}
              value={startMinute}
              onChange={(e) => setStartMinute(e.target.value)}
              className="w-14 border border-gray-300 rounded-lg px-2 py-2 text-sm text-center"
              placeholder="00"
            />
            <select
              value={startPeriod}
              onChange={(e) => setStartPeriod(e.target.value as 'AM' | 'PM')}
              className="border border-gray-300 rounded-lg px-2 py-2 text-sm min-w-[5rem]"
            >
              <option value="AM">AM</option>
              <option value="PM">PM</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
            Strava route <span className="font-normal text-gray-400">(optional)</span>
          </label>
          <input
            type="url"
            value={stravaMapUrl}
            onChange={(e) => setStravaMapUrl(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
            Route description <span className="font-normal text-gray-400">(optional)</span>
          </label>
          <input
            type="text"
            value={routeNeighborhood}
            onChange={(e) => setRouteNeighborhood(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>

        {error ? (
          <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
            {error}
          </p>
        ) : null}

        <div className="flex flex-col-reverse sm:flex-row gap-2 pt-2 border-t border-gray-100">
          {onCancel ? (
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={busy || !canSubmit}
            className="flex-1 py-2 text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 rounded-lg disabled:opacity-50"
          >
            {busy ? 'Creating…' : 'Create invite'}
          </button>
        </div>
      </div>
    </div>
  );
}
